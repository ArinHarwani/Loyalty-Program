// ============================================================
// WhatsApp Webhook — handles incoming messages from Meta
// Branches between Milestone (processTransaction) and Points
// (processPointsEarn) based on the merchant's loyalty_mechanism.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { processJoin, processTransaction, handleStatusCheck } from '@/lib/scan-logic';
import { processPointsEarn, handlePointsStatusCheck } from '@/lib/points-logic';
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
    // Verify signature — MANDATORY when WHATSAPP_APP_SECRET is configured
    const body = await request.text();
    const signature = request.headers.get('x-hub-signature-256');

    if (process.env.WHATSAPP_APP_SECRET) {
      if (!signature) {
        console.error('Webhook rejected: missing x-hub-signature-256 header');
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
      }

      let expectedSig: string;
      try {
        expectedSig =
          'sha256=' +
          crypto
            .createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
            .update(body)
            .digest('hex');
      } catch (cryptoError) {
        console.error('Webhook crypto error during signature verification:', cryptoError);
        // Fail-closed: If we cannot verify, we must reject the request to prevent malicious bypass
        return NextResponse.json({ error: 'Internal signature computation failed' }, { status: 500 });
      }

      if (
        signature.length !== expectedSig.length ||
        !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
      ) {
        console.error('Webhook rejected: invalid signature');
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

    // Check for button reply (Quick Reply from templates like account_update)
    const buttonReply = message?.interactive?.button_reply;
    const buttonPayload = message?.button?.payload; // some API versions use this
    const payload = buttonReply?.id || buttonPayload;

    if (payload && payload.startsWith('STATUS-')) {
      const enrollmentId = payload.replace('STATUS-', '').trim();
      const supabase = createServiceClient();
      await handleStatusCheck(enrollmentId, senderNumber, supabase);
      return NextResponse.json({ status: 'ok' }, { status: 200 });
    }

    if (payload && payload.startsWith('POINTS-')) {
      const parts = payload.split('-');
      if (parts.length >= 3) {
        const merchantId = parts[1];
        const customerId = parts.slice(2).join('-');
        const supabase = createServiceClient();
        await handlePointsStatusCheck(merchantId, customerId, senderNumber, supabase);
      }
      return NextResponse.json({ status: 'ok' }, { status: 200 });
    }

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
    // Match TXN token from anywhere in the message (supports new pre-fill text format)
    else if (messageText.toUpperCase().includes('TXN-')) {
      // Extract the actual token preserving original case
      const txnMatch = messageText.match(/TXN-([A-Za-z0-9_-]+)/i);
      const txnToken = txnMatch?.[1]?.trim();
      if (!txnToken) {
        await sendWhatsAppMessage(senderNumber, 'Invalid transaction code.');
        return NextResponse.json({ status: 'ok' }, { status: 200 });
      }

      // --- Branch on merchant's loyalty mechanism ---
      const { data: qrToken } = await supabase
        .from('qr_tokens')
        .select('merchant_id')
        .eq('token', txnToken)
        .single();

      if (qrToken) {
        const { data: merchant } = await supabase
          .from('merchants')
          .select('loyalty_mechanism')
          .eq('id', qrToken.merchant_id)
          .single();

        if (merchant?.loyalty_mechanism === 'points') {
          await processPointsEarn(txnToken, senderNumber, customerNumber, supabase);
        } else {
          await processTransaction(txnToken, senderNumber, customerNumber, supabase);
        }
      } else {
        await sendWhatsAppMessage(senderNumber, 'This QR is no longer valid. Please ask the shopkeeper for a new one.');
      }
    }
    // ===================== DEFAULT HELP =====================
    else {
      await sendWhatsAppMessage(senderNumber, 'Hello! Please scan a shop QR code to join their loyalty program or check your progress. 😊');
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}
