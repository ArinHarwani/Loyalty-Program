// ============================================================
// Admin — Unblock Merchant API
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(
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
    const service = createServiceClient();

    const { data: merchant } = await service
      .from('merchants')
      .select('subscription_end_date')
      .eq('id', merchantId)
      .single();

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // Determine new status based on sub end date
    const today = new Date().toISOString().split('T')[0];
    const newStatus = (merchant.subscription_end_date && merchant.subscription_end_date >= today)
      ? 'active'
      : 'inactive';

    await service
      .from('merchants')
      .update({ subscription_status: newStatus })
      .eq('id', merchantId);

    await service.from('merchant_status_log').insert({
      merchant_id: merchantId,
      status: newStatus,
      reason: 'Admin manually unblocked access',
    });

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    console.error('Admin unblock merchant error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
