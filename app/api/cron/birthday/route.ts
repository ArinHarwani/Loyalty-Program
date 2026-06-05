// ============================================================
// Cron: Birthday — runs daily at 9 AM IST
// Sends birthday wishes to customers via approved Meta template
// Template name: "birthday" (Marketing)
// Variables: {{1}} = customer name, {{2}} = shop name
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
  let sent = 0;
  let failed = 0;

  try {
    // Ensure we calculate the date in Indian Standard Time (IST)
    // Vercel servers run in UTC, which could cause date mismatches
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const currentMonth = today.getMonth() + 1; // 1-12
    const currentDay = today.getDate();         // 1-31

    // Find customers with today's birthday
    // Join enrollments → merchants so we can send from each active merchant
    const { data: birthdayCustomers } = await supabase
      .from('customers')
      .select('*, enrollments(*, merchants(*))')
      .eq('birth_month', currentMonth)
      .eq('birth_day', currentDay);

    for (const customer of birthdayCustomers || []) {
      // Skip if customer has no WhatsApp number
      if (!customer.whatsapp_number) continue;

      const waNumber = customer.whatsapp_number.startsWith('91')
        ? customer.whatsapp_number
        : `91${customer.whatsapp_number}`;

      // For each of their ACTIVE enrollments with ACTIVE merchants
      for (const enrollment of customer.enrollments || []) {
        if (enrollment.status !== 'active') continue;
        if (!enrollment.merchants) continue;
        if (enrollment.merchants.subscription_status !== 'active') continue;

        try {
          await sendWhatsAppTemplate(
            waNumber,
            'birthday',
            [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: customer.name || 'there' },      // {{1}} = customer name
                  { type: 'text', text: enrollment.merchants.shop_name }  // {{2}} = shop name
                  // Note: Meta automatically fills BOTH occurrences of {{2}}
                ]
              }
            ]
          );

          // Log as sent
          await supabase.from('message_logs').insert({
            merchant_id: enrollment.merchant_id,
            customer_id: customer.id,
            template_name: 'birthday',
            category: 'marketing',
            cost: 0.8631,
            status: 'sent',
          });

          sent++;
        } catch (error) {
          console.error(`Birthday send failed for customer ${customer.id}, merchant ${enrollment.merchant_id}:`, error);

          // Log as failed — one failure should not stop the entire loop
          await supabase.from('message_logs').insert({
            merchant_id: enrollment.merchant_id,
            customer_id: customer.id,
            template_name: 'birthday',
            category: 'marketing',
            cost: 0.8631,
            status: 'failed',
          });

          failed++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      birthday_messages_sent: sent,
      birthday_messages_failed: failed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Birthday cron error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
