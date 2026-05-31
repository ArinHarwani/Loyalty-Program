// ============================================================
// Cron: Expire — runs daily at 1 AM IST
// Marks expired enrollments, sends warnings
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  let expired = 0;
  let warnings = 0;

  try {
    // 1. Mark expired enrollments
    const now = new Date().toISOString();
    const { data: expiredEnrollments } = await supabase
      .from('enrollments')
      .select('*, customer:customers(*), merchant:merchants(*)')
      .eq('status', 'active')
      .lt('deadline_at', now);

    for (const enrollment of expiredEnrollments || []) {
      await supabase
        .from('enrollments')
        .update({ status: 'expired' })
        .eq('id', enrollment.id);

      expired++;
    }

    // 2. Send 3-day warning (only if warning_sent = false)
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: warningEnrollments } = await supabase
      .from('enrollments')
      .select('*, customer:customers(*), merchant:merchants(*), campaign:campaigns(*)')
      .eq('status', 'active')
      .eq('warning_sent', false)
      .lt('deadline_at', threeDaysFromNow)
      .gt('deadline_at', now);

    for (const enrollment of warningEnrollments || []) {
      if (enrollment.customer && enrollment.merchant && enrollment.campaign) {
        const target = enrollment.campaign.campaign_type === 'amount'
          ? `₹${enrollment.campaign.target_amount}`
          : `${enrollment.campaign.target_visits} visits`;
        const current = enrollment.campaign.campaign_type === 'amount'
          ? `₹${enrollment.total_spent}`
          : `${enrollment.total_visits} visits`;

        const waNumber = enrollment.customer.whatsapp_number.startsWith('91')
          ? enrollment.customer.whatsapp_number
          : `91${enrollment.customer.whatsapp_number}`;

        await sendWhatsAppMessage(
          waNumber,
          `⚠️ Your loyalty goal at ${enrollment.merchant.shop_name} expires soon!\n\nProgress: ${current} / ${target}\n🎁 Prize: ${enrollment.campaign.reward_description}\n\nVisit the shop before it's too late!`
        );

        // Mark warning sent
        await supabase
          .from('enrollments')
          .update({ warning_sent: true })
          .eq('id', enrollment.id);

        await supabase.from('message_logs').insert({
          merchant_id: enrollment.merchant_id,
          customer_id: enrollment.customer_id,
          template_name: 'loyalty_expiry_warning',
          category: 'utility',
          cost: 0.11,
          status: 'sent',
        });

        warnings++;
      }
    }

    return NextResponse.json({
      success: true,
      expired,
      warnings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Expire cron error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
