// ============================================================
// Cron: Birthday — runs daily at 9 AM IST
// Sends birthday wishes to customers
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
  let sent = 0;

  try {
    const today = new Date();
    const month = today.getMonth() + 1; // 1-indexed
    const day = today.getDate();

    // Find customers with today's birthday
    const { data: birthdayCustomers } = await supabase
      .from('customers')
      .select('*')
      .eq('birth_month', month)
      .eq('birth_day', day);

    for (const customer of birthdayCustomers || []) {
      // Get merchants this customer has engaged with
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('*, merchant:merchants(*)')
        .eq('customer_id', customer.id);

      // Get unique merchants
      const merchants = new Map();
      (enrollments || []).forEach((e: { merchant?: { id: string; shop_name: string } }) => {
        if (e.merchant) {
          merchants.set(e.merchant.id, e.merchant);
        }
      });

      // Send birthday wish from each merchant
      for (const [, merchant] of merchants) {
        await sendWhatsAppMessage(
          customer.whatsapp_number,
          `🎂 Happy Birthday from ${merchant.shop_name}!\n\nWishing you a wonderful day! 🎉\nVisit us today for a special birthday treat! 🎁`
        );

        await supabase.from('message_logs').insert({
          merchant_id: merchant.id,
          customer_id: customer.id,
          template_name: 'loyalty_birthday',
          category: 'marketing',
          cost: 0.9,
          status: 'sent',
        });

        sent++;
      }
    }

    return NextResponse.json({
      success: true,
      birthday_messages_sent: sent,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Birthday cron error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
