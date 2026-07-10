// ============================================================
// Points Config API — GET / POST points configuration
// ============================================================

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { createClient } from '@/lib/supabase';

async function getMerchantFromSession() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const service = createServiceClient();
  const { data: merchant } = await service
    .from('merchants')
    .select('*')
    .eq('email', user.email)
    .single();

  return merchant;
}

export async function GET() {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();
    const { data: config } = await supabase
      .from('points_config')
      .select('*')
      .eq('merchant_id', merchant.id)
      .single();

    return NextResponse.json({ config: config || null });
  } catch (error) {
    console.error('Points config GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (merchant.loyalty_mechanism !== 'points') {
      return NextResponse.json(
        { error: 'This merchant is not using the points system' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      cashback_percentage,
      conversion_rate,
      min_bill_amount,
      min_redeem_points,
      expiry_months,
    } = body;

    // Validate
    if (cashback_percentage === undefined || cashback_percentage <= 0 || cashback_percentage > 100) {
      return NextResponse.json({ error: 'Cashback percentage must be between 0.1 and 100' }, { status: 400 });
    }
    if (conversion_rate === undefined || conversion_rate <= 0) {
      return NextResponse.json({ error: 'Conversion rate must be positive' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Upsert: insert or update
    const { data: existing } = await supabase
      .from('points_config')
      .select('id')
      .eq('merchant_id', merchant.id)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('points_config')
        .update({
          cashback_percentage,
          conversion_rate,
          min_bill_amount: min_bill_amount || 0,
          min_redeem_points: min_redeem_points || 0,
          expiry_months: expiry_months || null,
          updated_at: new Date().toISOString(),
        })
        .eq('merchant_id', merchant.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await supabase
        .from('points_config')
        .insert({
          merchant_id: merchant.id,
          cashback_percentage,
          conversion_rate,
          min_bill_amount: min_bill_amount || 0,
          min_redeem_points: min_redeem_points || 0,
          expiry_months: expiry_months || null,
        });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Points config POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
