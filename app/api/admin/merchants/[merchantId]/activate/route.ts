// ============================================================
// Admin — Activate / Renew Subscription API
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getCustomerLimitForPlan } from '@/lib/plans';

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
    const {
      plan_name,
      price,
      payment_method,
      utr_number,
      start_date,
      notes,
      duration_months = 1,
      customer_limit: customLimit,
      end_date_override,
    } = body;

    if (!plan_name || price === undefined || !start_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate duration_months
    const validDurations = [1, 2, 3, 6];
    const months = validDurations.includes(duration_months) ? duration_months : 1;

    const service = createServiceClient();

    // 1. Calculate end date (start_date + duration_months * 30 days) OR use override
    let endDateStr: string;
    if (end_date_override) {
      endDateStr = end_date_override;
    } else {
      const startDateObj = new Date(start_date);
      const endDateObj = new Date(startDateObj);
      endDateObj.setDate(startDateObj.getDate() + (months * 30));
      endDateStr = endDateObj.toISOString().split('T')[0];
    }

    // 2. Determine customer_limit based on plan
    let customerLimit: number | null;
    if (plan_name === 'custom') {
      customerLimit = customLimit || null;
    } else {
      customerLimit = getCustomerLimitForPlan(plan_name);
    }

    // 3. Expire any current active subscriptions
    await service
      .from('subscriptions')
      .update({ status: 'expired' })
      .eq('merchant_id', merchantId)
      .eq('status', 'active');

    // 4. Insert new subscription record
    const { error: insertError } = await service.from('subscriptions').insert({
      merchant_id: merchantId,
      plan_name,
      price: Number(price),
      duration_months: months,
      start_date,
      end_date: endDateStr,
      status: 'active',
      payment_method: payment_method || 'upi',
      utr_number: utr_number || null,
      notes: notes || null,
    });

    if (insertError) throw insertError;

    // 5. Update merchant record
    await service
      .from('merchants')
      .update({
        subscription_status: 'active',
        subscription_end_date: endDateStr,
        subscription_plan: plan_name,
        customer_limit: customerLimit,
      })
      .eq('id', merchantId);

    // 6. Log status change
    await service.from('merchant_status_log').insert({
      merchant_id: merchantId,
      status: 'active',
      reason: `Subscription activated/renewed: ${plan_name} × ${months}mo (₹${price})`,
    });

    return NextResponse.json({ success: true, end_date: endDateStr });
  } catch (error) {
    console.error('Admin activate merchant error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
