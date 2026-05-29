// ============================================================
// Merchant Transaction API — create QR tokens
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { generateQrToken } from '@/lib/utils';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

    // Get merchant
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
    const { amount, campaign_id } = body;

    if (!campaign_id) {
      return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 });
    }

    // Verify campaign belongs to merchant
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaign_id)
      .eq('merchant_id', merchant.id)
      .eq('status', 'active')
      .single();

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found or inactive' }, { status: 404 });
    }

    const token = generateQrToken();
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();

    const { error: insertError } = await supabase.from('qr_tokens').insert({
      token,
      merchant_id: merchant.id,
      campaign_id: campaign.id,
      amount: amount || 0,
      expires_at: expiresAt,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ token, expires_at: expiresAt });
  } catch (error) {
    console.error('Transaction API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
