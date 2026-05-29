// ============================================================
// Campaign API — create and manage campaigns
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { CampaignSchema } from '@/lib/validation';

async function getAuthUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, subscription_status')
      .eq('email', user.email)
      .single();

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    if (merchant.subscription_status === 'inactive' || merchant.subscription_status === 'blocked') {
      return NextResponse.json(
        { error: 'Account not active. Please contact support.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validationResult = CampaignSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors[0]?.message || 'Invalid campaign data' },
        { status: 400 }
      );
    }

    const {
      name,
      campaign_type,
      target_amount,
      target_visits,
      duration_days,
      reward_description,
      max_winners,
    } = validationResult.data;

    const { data: campaign, error: insertError } = await supabase
      .from('campaigns')
      .insert({
        merchant_id: merchant.id,
        name,
        campaign_type,
        target_amount: campaign_type === 'amount' ? target_amount : null,
        target_visits: campaign_type === 'visits' ? target_visits : null,
        duration_days,
        reward_description,
        max_winners: max_winners || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Campaign creation failed in database:', insertError);
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
    }

    return NextResponse.json(campaign);
  } catch (error) {
    console.error('Campaign API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
