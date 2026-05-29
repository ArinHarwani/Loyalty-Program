// ============================================================
// Admin — Activate / Renew Subscription API
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
    const body = await request.json();
    const { plan_name, price, payment_method, utr_number, start_date, notes } = body;

    if (!plan_name || price === undefined || !start_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const service = createServiceClient();

    // 1. Calculate end date (start_date + 30 days)
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(startDateObj);
    endDateObj.setDate(startDateObj.getDate() + 30);
    const endDateStr = endDateObj.toISOString().split('T')[0];

    // 2. Expire any current active subscriptions
    await service
      .from('subscriptions')
      .update({ status: 'expired' })
      .eq('merchant_id', merchantId)
      .eq('status', 'active');

    // 3. Insert new subscription record
    const { error: insertError } = await service.from('subscriptions').insert({
      merchant_id: merchantId,
      plan_name,
      price: Number(price),
      start_date,
      end_date: endDateStr,
      status: 'active',
      payment_method: payment_method || 'upi',
      utr_number: utr_number || null,
      notes: notes || null,
    });

    if (insertError) throw insertError;

    // 4. Update merchant record
    await service
      .from('merchants')
      .update({
        subscription_status: 'active',
        subscription_end_date: endDateStr,
        subscription_plan: plan_name,
      })
      .eq('id', merchantId);

    // 5. Log status change
    await service.from('merchant_status_log').insert({
      merchant_id: merchantId,
      status: 'active',
      reason: `Subscription activated/renewed: ${plan_name} (${price})`,
    });

    return NextResponse.json({ success: true, end_date: endDateStr });
  } catch (error) {
    console.error('Admin activate merchant error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
