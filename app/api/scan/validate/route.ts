import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    
    // Fetch QR token with relations using service role to bypass RLS
    const { data: qrToken, error } = await supabase
      .from('qr_tokens')
      .select('*, merchant:merchants(*), campaign:campaigns(*)')
      .eq('token', token)
      .single();

    if (error || !qrToken) {
      return NextResponse.json({ error: 'Invalid QR code' }, { status: 400 });
    }

    if (qrToken.used) {
      return NextResponse.json({ error: 'QR code already used' }, { status: 400 });
    }

    if (new Date(qrToken.expires_at) < new Date()) {
      return NextResponse.json({ error: 'QR code expired' }, { status: 400 });
    }

    // Return ONLY the fields the scan page needs — never leak merchant email,
    // subscription status, internal IDs, or campaign max_winners.
    return NextResponse.json({
      success: true,
      qrToken: {
        token: qrToken.token,
        amount: qrToken.amount,
        expires_at: qrToken.expires_at,
        merchant: qrToken.merchant ? {
          id: qrToken.merchant.id,
          shop_name: qrToken.merchant.shop_name,
          loyalty_mechanism: qrToken.merchant.loyalty_mechanism,
        } : null,
        campaign: qrToken.campaign ? {
          id: qrToken.campaign.id,
          name: qrToken.campaign.name,
          campaign_type: qrToken.campaign.campaign_type,
          target_amount: qrToken.campaign.target_amount,
          target_visits: qrToken.campaign.target_visits,
          reward_description: qrToken.campaign.reward_description,
          duration_days: qrToken.campaign.duration_days,
        } : null,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
