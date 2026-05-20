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
import {
  generateClaimCode,
  calcPercentage,
  daysRemaining,
  formatDate,
  getCampaignDescription,
} from '@/lib/utils';
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

      const { data: merchant } = await supabase
        .from('merchants')
        .select('*')
        .eq('merchant_code', merchantCode)
        .single();

      if (!merchant) {
        await sendWhatsAppMessage(senderNumber, `Shop code "${merchantCode}" not found. Please check and try again.`);
        return NextResponse.json({ status: 'ok' }, { status: 200 });
      }

      let { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('whatsapp_number', customerNumber)
        .single();

      if (!customer) {
        const { data: newCustomer } = await supabase
          .from('customers')
          .insert({ whatsapp_number: customerNumber })
          .select()
          .single();
        customer = newCustomer;
      }

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

      const welcomeMsg = `🎉 Welcome to ${merchant.shop_name}'s loyalty program!\n\nGoal: ${
        campaign.campaign_type === 'amount'
          ? `Spend ₹${campaign.target_amount} in ${campaign.duration_days} days`
          : `Visit ${campaign.target_visits} times in ${campaign.duration_days} days`
      }\nPrize: ${campaign.reward_description}\n\nScan the QR at billing to log your transactions!`;

      await sendWhatsAppMessage(senderNumber, welcomeMsg);

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

    // ===================== TXN FLOW =====================
    else if (messageText.toUpperCase().startsWith('TXN-')) {
      const txnToken = messageText.toUpperCase().split('TXN-')[1]?.trim();

      if (!txnToken) {
        await sendWhatsAppMessage(senderNumber, 'Invalid transaction code.');
        return NextResponse.json({ status: 'ok' }, { status: 200 });
      }

      // 1. Validate token
      const { data: qrToken } = await supabase
        .from('qr_tokens')
        .select('*')
        .eq('token', txnToken)
        .single();

      if (!qrToken) {
        await sendWhatsAppMessage(senderNumber, 'This QR is no longer valid. Please ask the shopkeeper for a new one.');
        return NextResponse.json({ status: 'ok' }, { status: 200 });
      }

      if (qrToken.used) {
        await sendWhatsAppMessage(senderNumber, 'This QR code has already been used.');
        return NextResponse.json({ status: 'ok' }, { status: 200 });
      }

      if (new Date(qrToken.expires_at) < new Date()) {
        await sendWhatsAppMessage(senderNumber, 'This QR code has expired. Please ask the shopkeeper for a new one.');
        return NextResponse.json({ status: 'ok' }, { status: 200 });
      }

      // 2. Get merchant + campaign
      const { data: merchant } = await supabase
        .from('merchants')
        .select('*')
        .eq('id', qrToken.merchant_id)
        .single();

      const { data: campaign } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', qrToken.campaign_id)
        .single();

      if (!merchant || !campaign) {
        await sendWhatsAppMessage(senderNumber, 'Campaign not found.');
        return NextResponse.json({ status: 'ok' }, { status: 200 });
      }

      // 3. Find customer
      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('whatsapp_number', customerNumber)
        .single();

      if (!customer) {
        await sendWhatsAppMessage(
          senderNumber,
          'Please scan the QR code at the shop first to register. 📱'
        );
        return NextResponse.json({ status: 'ok' }, { status: 200 });
      }

      // 4. Find enrollment
      let { data: enrollment } = await supabase
        .from('enrollments')
        .select('*')
        .eq('customer_id', customer.id)
        .eq('campaign_id', campaign.id)
        .eq('merchant_id', merchant.id)
        .in('status', ['active', 'completed'])
        .order('enrolled_at', { ascending: false })
        .limit(1)
        .single();

      if (!enrollment) {
        // Edge case: customer exists but no enrollment — auto-create one
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + campaign.duration_days);

        const { data: newEnrollment } = await supabase
          .from('enrollments')
          .insert({
            customer_id: customer.id,
            campaign_id: campaign.id,
            merchant_id: merchant.id,
            total_spent: 0,
            total_visits: 0,
            deadline_at: deadline.toISOString(),
            status: 'active',
          })
          .select()
          .single();
        enrollment = newEnrollment;
      }

      if (!enrollment) {
        await sendWhatsAppMessage(senderNumber, 'Could not process your transaction. Please try again.');
        return NextResponse.json({ status: 'ok' }, { status: 200 });
      }

      if (enrollment.status === 'completed') {
        await sendWhatsAppMessage(
          senderNumber,
          `🎉 You've already completed your goal at ${merchant.shop_name}!\n\nClaim Code: ${enrollment.claim_code}\nShow this to the shopkeeper!`
        );
        // Still mark token used
        await supabase.from('qr_tokens').update({ used: true }).eq('token', txnToken);
        return NextResponse.json({ status: 'ok' }, { status: 200 });
      }

      // Check if deadline passed
      if (new Date(enrollment.deadline_at) < new Date()) {
        await supabase.from('enrollments').update({ status: 'expired' }).eq('id', enrollment.id);
        await sendWhatsAppMessage(
          senderNumber,
          `⏰ Your loyalty enrollment at ${merchant.shop_name} has expired.\n\nScan the QR at your next visit to start fresh!`
        );
        await supabase.from('qr_tokens').update({ used: true }).eq('token', txnToken);
        return NextResponse.json({ status: 'ok' }, { status: 200 });
      }

      // 5. Insert transaction
      await supabase.from('transactions').insert({
        enrollment_id: enrollment.id,
        merchant_id: merchant.id,
        amount: qrToken.amount,
        qr_token: txnToken,
      });

      // 6. Update totals
      const newTotalSpent = Number(enrollment.total_spent) + Number(qrToken.amount);
      const newTotalVisits = Number(enrollment.total_visits) + 1;

      await supabase
        .from('enrollments')
        .update({ total_spent: newTotalSpent, total_visits: newTotalVisits })
        .eq('id', enrollment.id);

      // 7. Check completion
      let isCompleted = false;
      let claimCode: string | undefined;

      if (campaign.campaign_type === 'amount' && campaign.target_amount) {
        isCompleted = newTotalSpent >= campaign.target_amount;
      } else if (campaign.campaign_type === 'visits' && campaign.target_visits) {
        isCompleted = newTotalVisits >= campaign.target_visits;
      }

      if (isCompleted) {
        claimCode = generateClaimCode();
        await supabase
          .from('enrollments')
          .update({ status: 'completed', claim_code: claimCode })
          .eq('id', enrollment.id);
      }

      // 8. Mark token used
      await supabase.from('qr_tokens').update({ used: true }).eq('token', txnToken);

      // 9. Compose reply
      const target = campaign.campaign_type === 'amount'
        ? campaign.target_amount || 0
        : campaign.target_visits || 0;
      const current = campaign.campaign_type === 'amount' ? newTotalSpent : newTotalVisits;
      const percentage = calcPercentage(current, target);
      const daysLeft = daysRemaining(enrollment.deadline_at);
      const isFirstTransaction = newTotalVisits === 1;

      const campaignDesc = getCampaignDescription(
        campaign.campaign_type,
        campaign.target_amount,
        campaign.target_visits,
        campaign.duration_days
      );

      let replyText: string;

      if (isCompleted) {
        replyText = composeCompletionMessage(merchant.shop_name, campaign.reward_description, claimCode!);
      } else if (isFirstTransaction) {
        if (campaign.campaign_type === 'amount') {
          replyText = composeWelcomeMessage(
            merchant.shop_name, campaignDesc, campaign.reward_description,
            formatDate(enrollment.deadline_at), qrToken.amount,
            newTotalSpent, campaign.target_amount || 0, percentage, daysLeft
          );
        } else {
          replyText = composeWelcomeVisitMessage(
            merchant.shop_name, campaignDesc, campaign.reward_description,
            formatDate(enrollment.deadline_at), newTotalVisits,
            campaign.target_visits || 0, percentage, daysLeft
          );
        }
      } else {
        if (campaign.campaign_type === 'amount') {
          replyText = composeTransactionMessage(
            merchant.shop_name, qrToken.amount, newTotalSpent,
            campaign.target_amount || 0, daysLeft, percentage
          );
        } else {
          replyText = composeVisitMessage(
            merchant.shop_name, newTotalVisits,
            campaign.target_visits || 0, daysLeft, percentage
          );
        }
      }

      // Add progress URL
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      if (appUrl) {
        replyText += `\n\nView progress: ${appUrl}/progress/${merchant.id}/${customerNumber}`;
      }

      // 10. Send reply
      await sendWhatsAppMessage(senderNumber, replyText);

      // 11. Log
      await supabase.from('message_logs').insert({
        merchant_id: merchant.id,
        customer_id: customer.id,
        template_name: isCompleted ? 'goal_completed' : isFirstTransaction ? 'welcome' : 'transaction_update',
        category: 'service',
        cost: 0,
        status: 'sent',
      });
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
