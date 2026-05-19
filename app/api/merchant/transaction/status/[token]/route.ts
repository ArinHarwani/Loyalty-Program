// ============================================================
// Transaction Status Polling API
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = createServiceClient();

    const { data: qrToken } = await supabase
      .from('qr_tokens')
      .select('used, expires_at')
      .eq('token', token)
      .single();

    if (!qrToken) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    const expired = new Date(qrToken.expires_at) < new Date();

    let customerMasked: string | undefined;
    if (qrToken.used) {
      const { data: txn } = await supabase
        .from('transactions')
        .select('*, enrollment:enrollments(*, customer:customers(whatsapp_number))')
        .eq('qr_token', token)
        .single();

      if (txn?.enrollment?.customer) {
        const phone = txn.enrollment.customer.whatsapp_number;
        customerMasked = phone.slice(0, 5) + 'XXXXX';
      }
    }

    return NextResponse.json({
      used: qrToken.used,
      expired,
      customer_masked: customerMasked,
    });
  } catch (error) {
    console.error('Status API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
