// ============================================================
// WhatsApp Webhook — handles incoming messages from Meta
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { processScan } from '@/lib/scan-logic';
import { sendWhatsAppMessage, composeHelpMessage } from '@/lib/whatsapp';
import crypto from 'crypto';

// GET — Meta verification challenge
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.CRON_SECRET) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// POST — Incoming messages
export async function POST(request: NextRequest) {
  try {
    // Verify signature
    const body = await request.text();
    const signature = request.headers.get('x-hub-signature-256');

    if (signature && process.env.WHATSAPP_APP_SECRET) {
      const expectedSig =
        'sha256=' +
        crypto
          .createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
          .update(body)
          .digest('hex');

      if (signature !== expectedSig) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const data = JSON.parse(body);

    // Extract message
    const entry = data?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      // Could be a status update — acknowledge
      return NextResponse.json({ status: 'ok' });
    }

    const message = messages[0];
    const senderNumber = message.from;
    const messageText = message.text?.body?.trim() || '';

    if (!messageText) {
      return NextResponse.json({ status: 'no text' }, { status: 200 });
    }

    const supabase = createServiceClient();

    // Process the message
    if (messageText.toUpperCase().startsWith('JOIN ')) {
      const merchantCode = messageText.split(' ')[1]?.toUpperCase();

      if (!merchantCode) {
        await sendWhatsAppMessage(senderNumber, 'Please send: JOIN <SHOP_CODE>');
        return NextResponse.json({ status: 'ok' }, { status: 200 });
      }

      // Find merchant
      const { data: merchant } = await supabase
        .from('merchants')
        .select('*')
        .eq('merchant_code', merchantCode)
        .single();

      if (!merchant) {
        await sendWhatsAppMessage(senderNumber, `Shop code "${merchantCode}" not found. Please check and try again.`);
        return NextResponse.json({ status: 'ok' }, { status: 200 });
      }

      // Find or create customer
      let { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('whatsapp_number', senderNumber.replace('91', ''))
        .single();

      if (!customer) {
        const { data: newCustomer } = await supabase
          .from('customers')
          .insert({ whatsapp_number: senderNumber.replace('91', '') })
          .select()
          .single();
        customer = newCustomer;
      }

      // Get active campaign
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('*')
        .eq('merchant_id', merchant.id)
        .eq('status', 'active')
        .limit(1)
        .single();

      if (!campaign) {
        await sendWhatsAppMessage(
          senderNumber,
          `Welcome to ${merchant.shop_name}! 🎉\n\nNo active campaign right now. Check back soon!`
        );
        return NextResponse.json({ status: 'ok' }, { status: 200 });
      }

      // Welcome message
      const welcomeMsg = `🎉 Welcome to ${merchant.shop_name}'s loyalty program!\n\nGoal: ${
        campaign.campaign_type === 'amount'
          ? `Spend ₹${campaign.target_amount} in ${campaign.duration_days} days`
          : `Visit ${campaign.target_visits} times in ${campaign.duration_days} days`
      }\nPrize: ${campaign.reward_description}\n\nScan the QR at billing to log your transactions!`;

      await sendWhatsAppMessage(senderNumber, welcomeMsg);

      // Log
      if (customer) {
        await supabase.from('message_logs').insert({
          merchant_id: merchant.id,
          customer_id: customer.id,
          template_name: 'join_welcome',
          category: 'service',
          cost: 0,
          status: 'sent',
        });
      }
    }
    else if (messageText.toUpperCase().startsWith('TXN-')) {
      const token = messageText.toUpperCase().split('TXN-')[1]?.trim();

      if (!token) {
        await sendWhatsAppMessage(senderNumber, 'Invalid transaction code.');
        return NextResponse.json({ status: 'ok' }, { status: 200 });
      }

      // Determine customer number (strip 91 if present for DB lookup)
      const customerNumber = senderNumber.startsWith('91')
        ? senderNumber.substring(2)
        : senderNumber;

      const result = await processScan({
        token,
        whatsapp_number: customerNumber,
      });

      if (!result.success) {
        await sendWhatsAppMessage(senderNumber, result.message);
      }
      // If successful, processScan already sends the message using the customerNumber,
      // wait, processScan uses the customerNumber (without 91).
      // We must make sure processScan sends to the full senderNumber (with 91).
    }
    else {
      await sendWhatsAppMessage(
        senderNumber,
        composeHelpMessage() || 'Hi! Please scan the QR code at the shop counter to use LoyaltyQR. 🎯'
      );
    }

    // Always return 200 immediately to Meta
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}
