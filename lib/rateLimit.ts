// ============================================================
// LoyaltyQR — Database-Backed + Memory Cache Rate Limiter
// ============================================================

import { createServiceClient } from './supabase';

// High-speed, warm serverless instance in-memory cache
const memoryCache = new Map<string, { count: number; expires: number }>();

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
}

/**
 * Checks if a request key (IP + path) has exceeded the rate limit.
 * Implements a hybrid memory + database approach suitable for Serverless environments:
 * 1. Resolves locally inside warm memory instances to save database roundtrips.
 * 2. Synchronizes globally using the `rate_limit_hits` table on Supabase.
 * 3. Gracefully falls back to allowed (true) if database connectivity fails.
 *
 * @param key Unique key to identify the caller (e.g. `ip:route`)
 * @param limit Maximum number of requests allowed inside the window
 * @param windowSeconds Duration of the rolling window in seconds
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const windowStartIso = new Date(nowMs - windowSeconds * 1000).toISOString();

  // 1. Check local memory cache first
  const memoryRecord = memoryCache.get(key);
  if (memoryRecord && memoryRecord.expires > nowMs) {
    if (memoryRecord.count >= limit) {
      return {
        success: false,
        limit,
        remaining: 0,
      };
    }
    // Increment local memory for fast successive hits
    memoryRecord.count += 1;
  } else {
    // Initialize or refresh memory record
    memoryCache.set(key, { count: 1, expires: nowMs + windowSeconds * 1000 });
  }

  try {
    const supabase = createServiceClient();

    // 2. Perform background cleanup of expired logs to keep database slim
    // Runs asynchronously to avoid blocking the request path
    supabase
      .from('rate_limit_hits')
      .delete()
      .lt('created_at', windowStartIso)
      .then(({ error }) => {
        if (error) console.error('Rate limit prune error:', error);
      });

    // 3. Count current hits inside the window
    const { count, error: countError } = await supabase
      .from('rate_limit_hits')
      .select('*', { count: 'exact', head: true })
      .eq('key', key)
      .gt('created_at', windowStartIso);

    if (countError) {
      console.error('Rate limit query failed:', countError);
      // Fail-open: don't block legitimate users if database fails
      return { success: true, limit, remaining: 1 };
    }

    const currentHits = count || 0;

    if (currentHits >= limit) {
      // Sync memory cache to prevent DB queries for blocked traffic
      memoryCache.set(key, { count: currentHits, expires: nowMs + windowSeconds * 1000 });
      return {
        success: false,
        limit,
        remaining: 0,
      };
    }

    // 4. Log the current request hit
    const { error: insertError } = await supabase
      .from('rate_limit_hits')
      .insert({
        key,
        created_at: nowIso,
      });

    if (insertError) {
      console.error('Failed to log rate limit hit:', insertError);
    }

    const remaining = Math.max(0, limit - (currentHits + 1));
    memoryCache.set(key, { count: currentHits + 1, expires: nowMs + windowSeconds * 1000 });

    return {
      success: true,
      limit,
      remaining,
    };
  } catch (err) {
    console.error('Rate limiting unexpected exception:', err);
    // Fail-open
    return { success: true, limit, remaining: 1 };
  }
}
