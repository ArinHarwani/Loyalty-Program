import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { checkRateLimit } from './lib/rateLimit';

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Enforce server-side rate limits on API endpoints
  if (path.startsWith('/api/')) {
    // Exclude webhook (Meta verified signature) and cron triggers (secret verified token)
    if (
      !path.startsWith('/api/whatsapp/webhook') &&
      !path.startsWith('/api/cron/')
    ) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || (request as NextRequest & { ip?: string }).ip || '127.0.0.1';
      const rateLimitKey = `rl:${ip}:${path}`;
      
      // Limit to 60 requests per minute per IP per API route
      const limitResult = await checkRateLimit(rateLimitKey, 60, 60);
      
      if (!limitResult.success) {
        return new NextResponse(
          JSON.stringify({ error: 'Too many requests. Please try again later.' }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '60',
              'X-RateLimit-Limit': String(limitResult.limit),
              'X-RateLimit-Remaining': String(limitResult.remaining),
            },
          }
        );
      }
    }
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh session if expired - required for Server Components
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
