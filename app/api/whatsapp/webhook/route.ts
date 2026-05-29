// ============================================================
// WhatsApp Webhook — handles incoming messages from Meta
// Transaction processing is done inline here (no scan-logic dependency).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import {
  sendWhatsAppMessage,
  composeWelcomeMessage,
  composeWelcomeVisitMessage,
  composeTransactionMessage,
  composeVisitMessage,
  composeCompletionMessage,
  composeHelpMessage,
} from '@/lib/whatsapp';
import { processJoin, processTransaction } from '@/lib/scan-logic';
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
      return NextResponse.json({ status: 'ok' });
    }

    const message = messages[0];
    const senderNumber = message.from; // e.g. "919876543210"
    const messageText = message.text?.body?.trim() || '';

    if (!messageText) {
      return NextResponse.json({ status: 'no text' }, { status: 200 });
    }

    const supabase = createServiceClient();

    // Strip country code for DB lookup (DB stores 10-digit numbers)
    const customerNumber = senderNumber.startsWith('91')
      ? senderNumber.substring(2)
      : senderNumber;

    // ===================== JOIN FLOW =====================
    if (messageText.toUpperCase().startsWith('JOIN ')) {
      const merchantCode = messageText.split(' ')[1]?.toUpperCase();
      if (!merchantCode) {
        await sendWhatsAppMessage(senderNumber, 'Please send: JOIN <SHOP_CODE>');
        return NextResponse.json({ status: 'ok' }, { status: 200 });
      }
      await processJoin(merchantCode, senderNumber, customerNumber, supabase);
    }
    // ===================== TXN FLOW =====================
    else if (messageText.toUpperCase().startsWith('TXN-')) {
      const txnToken = messageText.toUpperCase().split('TXN-')[1]?.trim();
      if (!txnToken) {
        await sendWhatsAppMessage(senderNumber, 'Invalid transaction code.');
        return NextResponse.json({ status: 'ok' }, { status: 200 });
      }
      await processTransaction(txnToken, senderNumber, customerNumber, supabase);
    }
    // ===================== DEFAULT HELP =====================
    else {
      await sendWhatsAppMessage(senderNumber, composeHelpMessage());
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}
