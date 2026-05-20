// ============================================================
// Admin — Update Merchant Details (PATCH)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ merchantId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email || user.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { merchantId } = await params;
    const body = await request.json();
    const { package_name, status, notes } = body;

    const service = createServiceClient();

    // Update merchant record
    const updates: Record<string, unknown> = {};
    if (package_name) updates.current_package = package_name;
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes;

    if (Object.keys(updates).length > 0) {
      await service.from('merchants').update(updates).eq('id', merchantId);
    }

    // If package changed, create package record
    if (package_name) {
      // Mark old packages as not current
      await service
        .from('merchant_packages')
        .update({ is_current: false, ended_at: new Date().toISOString() })
        .eq('merchant_id', merchantId)
        .eq('is_current', true);

      // Insert new package record
      const prices: Record<string, number> = { trial: 0, starter: 999, growth: 1499 };
      await service.from('merchant_packages').insert({
        merchant_id: merchantId,
        package_name,
        price: prices[package_name] || 0,
        is_current: true,
      });
    }

    // If status changed, log it
    if (status) {
      await service.from('merchant_status_log').insert({
        merchant_id: merchantId,
        status,
        reason: notes || null,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin update merchant error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
