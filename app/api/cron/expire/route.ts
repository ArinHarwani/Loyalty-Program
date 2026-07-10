// ============================================================
// Cron: Expire — runs daily at 1 AM IST
// 1. Marks past-deadline enrollments as expired
// 2. Sends 3-day warning via approved Meta template "account_update"
// Template name: "account_update" (Utility)
// Variables: {{1}} = shop name
// Button: Quick Reply "Check Status" with payload STATUS-{enrollmentId}
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { sendWhatsAppTemplate } from '@/lib/whatsapp';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  let expired = 0;
  let warnings = 0;
  let warningsFailed = 0;

  try {
    // 1. Mark expired enrollments
    const now = new Date().toISOString();
    const { data: expiredEnrollments } = await supabase
      .from('enrollments')
      .select('*')
      .eq('status', 'active')
      .lt('deadline_at', now);

    for (const enrollment of expiredEnrollments || []) {
      await supabase
        .from('enrollments')
        .update({ status: 'expired' })
        .eq('id', enrollment.id);

      expired++;
    }

    // 2. Send 3-day warning via account_update template
    // Only send if warning_sent = false (prevents duplicates)
    const { data: warningEnrollments } = await supabase
      .from('enrollments')
      .select('*, customers(*), merchants(*), campaigns(*)')
      .eq('status', 'active')
      .eq('warning_sent', false)
      .lt('deadline_at', new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString())
      .gt('deadline_at', now);

    for (const enrollment of warningEnrollments || []) {
      // Guard: skip if any required relation is missing
      if (!enrollment.customers || !enrollment.merchants || !enrollment.campaigns) continue;

      // Guard: skip inactive/blocked merchants
      if (enrollment.merchants.subscription_status !== 'active') continue;

      // Guard: skip if customer has no WhatsApp number
      if (!enrollment.customers.whatsapp_number) continue;

      const waNumber = enrollment.customers.whatsapp_number.startsWith('91')
        ? enrollment.customers.whatsapp_number
        : `91${enrollment.customers.whatsapp_number}`;

      try {
        await sendWhatsAppTemplate(
          waNumber,
          'account_update',
          [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: enrollment.merchants.shop_name }  // {{1}} = shop name
              ]
            },
            {
              type: 'button',
              sub_type: 'quick_reply',
              index: '0',
              parameters: [
                {
                  type: 'payload',
                  payload: `STATUS-${enrollment.id}`
                }
              ]
            }
          ]
        );

        // Mark warning as sent — CRITICAL: prevents sending twice
        await supabase
          .from('enrollments')
          .update({ warning_sent: true })
          .eq('id', enrollment.id);

        // Log as sent
        await supabase.from('message_logs').insert({
          merchant_id: enrollment.merchant_id,
          customer_id: enrollment.customer_id,
          template_name: 'account_update',
          category: 'utility',
          cost: 0.115,
          status: 'sent',
        });

        warnings++;
      } catch (error) {
        console.error(`Expiry warning failed for enrollment ${enrollment.id}:`, error);

        // Log as failed — one failure should not stop the entire loop
        await supabase.from('message_logs').insert({
          merchant_id: enrollment.merchant_id,
          customer_id: enrollment.customer_id,
          template_name: 'account_update',
          category: 'utility',
          cost: 0.115,
          status: 'failed',
        });

        warningsFailed++;
      }
    }

    // ==========================================
    // 3. Points Expiry Warnings
    // ==========================================
    
    // Find all points configurations that have an expiry set
    const { data: pointConfigs } = await supabase
      .from('points_config')
      .select('merchant_id, expiry_months')
      .not('expiry_months', 'is', null);

    for (const config of pointConfigs || []) {
      const expiryMonths = config.expiry_months;
      if (!expiryMonths) continue;

      // Find the latest ledger entries for each customer for this merchant
      const { data: balances } = await supabase
        .from('current_points_balances')
        .select('*')
        .eq('merchant_id', config.merchant_id)
        .eq('warning_sent', false)
        .gt('balance', 0);

      for (const balance of balances || []) {
        // Calculate expiry date (last activity + expiry_months)
        const lastActivityDate = new Date(balance.last_activity_at);
        const expiryDate = new Date(lastActivityDate);
        expiryDate.setMonth(expiryDate.getMonth() + expiryMonths);

        const msUntilExpiry = expiryDate.getTime() - Date.now();
        const daysUntilExpiry = msUntilExpiry / (1000 * 60 * 60 * 24);

        // If exactly between 2 and 3 days away
        if (daysUntilExpiry > 2 && daysUntilExpiry <= 3) {
          // Fetch customer and merchant
          const { data: customer } = await supabase.from('customers').select('*').eq('id', balance.customer_id).single();
          const { data: merchant } = await supabase.from('merchants').select('*').eq('id', balance.merchant_id).single();

          if (!customer || !customer.whatsapp_number || !merchant || merchant.subscription_status !== 'active') {
            continue;
          }

          const waNumber = customer.whatsapp_number.startsWith('91')
            ? customer.whatsapp_number
            : `91${customer.whatsapp_number}`;

          try {
            await sendWhatsAppTemplate(
              waNumber,
              'account_update',
              [
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: merchant.shop_name }  // {{1}} = shop name
                  ]
                },
                {
                  type: 'button',
                  sub_type: 'quick_reply',
                  index: '0',
                  parameters: [
                    {
                      type: 'payload',
                      payload: `POINTS-${merchant.id}-${customer.id}`
                    }
                  ]
                }
              ]
            );

            // Mark warning as sent on the specific ledger row
            await supabase
              .from('points_ledger')
              .update({ warning_sent: true })
              .eq('id', balance.ledger_id);

            // Log as sent
            await supabase.from('message_logs').insert({
              merchant_id: merchant.id,
              customer_id: customer.id,
              template_name: 'account_update',
              category: 'utility',
              cost: 0.115,
              status: 'sent',
            });

            warnings++;
          } catch (error) {
            console.error(`Points expiry warning failed for customer ${customer.id}:`, error);

            await supabase.from('message_logs').insert({
              merchant_id: merchant.id,
              customer_id: customer.id,
              template_name: 'account_update',
              category: 'utility',
              cost: 0.115,
              status: 'failed',
            });

            warningsFailed++;
          }
        }
      }
    }


    return NextResponse.json({
      success: true,
      expired,
      warnings_sent: warnings,
      warnings_failed: warningsFailed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Expire cron error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
