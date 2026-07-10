// ============================================================
// Points Redeem API — merchant-initiated redemption
// ============================================================

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { createClient } from '@/lib/supabase';
import { processPointsRedeem } from '@/lib/points-logic';

export async function POST(request: Request) {
  try {
    // Auth check
    const authSupabase = createClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, loyalty_mechanism')
      .eq('email', user.email)
      .single();

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    if (merchant.loyalty_mechanism !== 'points') {
      return NextResponse.json({ error: 'Not a points merchant' }, { status: 400 });
    }

    const body = await request.json();
    const { customer_id, points_to_redeem } = body;

    if (!customer_id || !points_to_redeem) {
      return NextResponse.json(
        { error: 'customer_id and points_to_redeem are required' },
        { status: 400 }
      );
    }

    if (points_to_redeem <= 0) {
      return NextResponse.json(
        { error: 'Points to redeem must be positive' },
        { status: 400 }
      );
    }

    const result = await processPointsRedeem(
      merchant.id,
      customer_id,
      Number(points_to_redeem),
      supabase
    );

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      currency_value: result.currencyValue,
      new_balance: result.newBalance,
    });
  } catch (error) {
    console.error('Points redeem error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
