import { SupabaseClient } from '@supabase/supabase-js';
import {
  sendWhatsAppMessage,
  composeWelcomeMessage,
  composeWelcomeVisitMessage,
  composeTransactionMessage,
  composeVisitMessage,
  composeCompletionMessage,
} from '@/lib/whatsapp';
import {
  generateClaimCode,
  calcPercentage,
  daysRemaining,
  formatDate,
  getCampaignDescription,
} from '@/lib/utils';

export async function processJoin(
  merchantCode: string,
  senderNumber: string,
  customerNumber: string,
  supabase: SupabaseClient
): Promise<void> {
  const { data: merchant } = await supabase
    .from('merchants')
    .select('*')
    .eq('merchant_code', merchantCode)
    .single();

  if (!merchant) {
    await sendWhatsAppMessage(senderNumber, `Shop code "${merchantCode}" not found. Please check and try again.`);
    return;
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
    return;
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

export async function processTransaction(
  txnToken: string,
  senderNumber: string,
  customerNumber: string,
  supabase: SupabaseClient
): Promise<void> {
  // 1. Validate token
  const { data: qrToken } = await supabase
    .from('qr_tokens')
    .select('*')
    .eq('token', txnToken)
    .single();

  if (!qrToken) {
    await sendWhatsAppMessage(senderNumber, 'This QR is no longer valid. Please ask the shopkeeper for a new one.');
    return;
  }

  if (qrToken.used) {
    await sendWhatsAppMessage(senderNumber, 'This QR code has already been used.');
    return;
  }

  if (new Date(qrToken.expires_at) < new Date()) {
    await sendWhatsAppMessage(senderNumber, 'This QR code has expired. Please ask the shopkeeper for a new one.');
    return;
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
    return;
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
    return;
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
    return;
  }

  // For completed enrollments: only returns are allowed (to adjust the total).
  // Purchases after completion just replay the completion message.
  if (enrollment.status === 'completed' && qrToken.amount >= 0) {
    await sendWhatsAppMessage(
      senderNumber,
      `🎉 You've already completed your goal at ${merchant.shop_name}!\n\nClaim Code: ${enrollment.claim_code}\nShow this to the shopkeeper!`
    );
    // Still mark token used
    await supabase.from('qr_tokens').update({ used: true }).eq('token', txnToken);
    return;
  }

  // Check if deadline passed
  if (new Date(enrollment.deadline_at) < new Date()) {
    await supabase.from('enrollments').update({ status: 'expired' }).eq('id', enrollment.id);
    await sendWhatsAppMessage(
      senderNumber,
      `⏰ Your loyalty enrollment at ${merchant.shop_name} has expired.\n\nScan the QR at your next visit to start fresh!`
    );
    await supabase.from('qr_tokens').update({ used: true }).eq('token', txnToken);
    return;
  }

  const isReturnTxn = Number(qrToken.amount) < 0;

  // 5. Insert transaction
  await supabase.from('transactions').insert({
    enrollment_id: enrollment.id,
    merchant_id: merchant.id,
    amount: qrToken.amount,
    qr_token: txnToken,
  });

  // 6. Update totals
  // For returns: clamp total_spent at 0; never go negative.
  // For returns: do NOT increment total_visits.
  const newTotalSpent = Math.max(0, Number(enrollment.total_spent) + Number(qrToken.amount));
  const newTotalVisits = isReturnTxn
    ? Number(enrollment.total_visits)
    : Number(enrollment.total_visits) + 1;

  await supabase
    .from('enrollments')
    .update({ total_spent: newTotalSpent, total_visits: newTotalVisits })
    .eq('id', enrollment.id);

  // 7. Check completion — returns never trigger completion, and don't revoke it
  let isCompleted = false;
  let claimCode: string | undefined;

  if (!isReturnTxn && enrollment.status !== 'completed') {
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
  const isFirstTransaction = !isReturnTxn && newTotalVisits === 1;
  const customerName = customer.name || '';

  if (isReturnTxn) {
    const returnAmount = Math.abs(Number(qrToken.amount));
    const returnReply = `${merchant.shop_name} — Return Processed ↩\n\n−₹${returnAmount} adjusted from your total.\nUpdated total: ₹${newTotalSpent} / ₹${target}\n${daysLeft} days remaining`;
    await sendWhatsAppMessage(senderNumber, returnReply);
    await supabase.from('qr_tokens').update({ used: true }).eq('token', txnToken);
    await supabase.from('message_logs').insert({
      merchant_id: merchant.id,
      customer_id: customer.id,
      template_name: 'return_processed',
      category: 'service',
      cost: 0,
      status: 'sent',
    });
    return;
  }

  const campaignDesc = getCampaignDescription(
    campaign.campaign_type,
    campaign.target_amount,
    campaign.target_visits,
    campaign.duration_days
  );

  let replyText: string;

  if (isCompleted) {
    replyText = composeCompletionMessage(customerName, merchant.shop_name, campaign.reward_description, claimCode!);
  } else if (isFirstTransaction) {
    if (campaign.campaign_type === 'amount') {
      replyText = composeWelcomeMessage(
        customerName, merchant.shop_name, campaignDesc, campaign.reward_description,
        formatDate(enrollment.deadline_at), qrToken.amount,
        newTotalSpent, campaign.target_amount || 0, percentage, daysLeft
      );
    } else {
      replyText = composeWelcomeVisitMessage(
        customerName, merchant.shop_name, campaignDesc, campaign.reward_description,
        formatDate(enrollment.deadline_at), newTotalVisits,
        campaign.target_visits || 0, percentage, daysLeft
      );
    }
  } else {
    if (campaign.campaign_type === 'amount') {
      replyText = composeTransactionMessage(
        customerName, merchant.shop_name, qrToken.amount, newTotalSpent,
        campaign.target_amount || 0, daysLeft, percentage
      );
    } else {
      replyText = composeVisitMessage(
        customerName, merchant.shop_name, newTotalVisits,
        campaign.target_visits || 0, daysLeft, percentage
      );
    }
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

export async function handleStatusCheck(
  enrollmentId: string,
  senderNumber: string,
  supabase: SupabaseClient
): Promise<void> {
  // Fetch enrollment with campaign and merchant data
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('*, campaigns(*), merchants(shop_name)')
    .eq('id', enrollmentId)
    .single();

  if (!enrollment) {
    await sendWhatsAppMessage(
      senderNumber,
      'Sorry, we could not find your account details. Please scan the QR at the shop.'
    );
    return;
  }

  const daysLeft = daysRemaining(enrollment.deadline_at);
  const campaign = enrollment.campaigns;
  const shopName = enrollment.merchants.shop_name;

  let progressText = '';
  if (campaign.campaign_type === 'amount') {
    const percentage = calcPercentage(enrollment.total_spent, campaign.target_amount);
    progressText = `₹${enrollment.total_spent} / ₹${campaign.target_amount} (${percentage}%)`;
  } else {
    const percentage = calcPercentage(enrollment.total_visits, campaign.target_visits);
    progressText = `${enrollment.total_visits} / ${campaign.target_visits} visits (${percentage}%)`;
  }

  const message = `${shopName} — Account Status 📊

Progress: ${progressText}
Days remaining: ${daysLeft}
Reward: ${campaign.reward_description}

${daysLeft <= 3 ? '⚠️ Your period ends very soon!' : 'Keep going! 🎯'}`;

  await sendWhatsAppMessage(senderNumber, message);

  // Strip country code for DB lookup (DB stores 10-digit numbers)
  const customerNumber = senderNumber.startsWith('91')
    ? senderNumber.substring(2)
    : senderNumber;

  // Update last_whatsapp_at since customer initiated
  await supabase
    .from('customers')
    .update({ last_whatsapp_at: new Date().toISOString() })
    .eq('whatsapp_number', customerNumber);

  // Log as service message (free — customer initiated by tapping button)
  await supabase.from('message_logs').insert({
    customer_id: enrollment.customer_id,
    merchant_id: enrollment.merchant_id,
    template_name: 'status_check',
    category: 'service',
    cost: 0,
    status: 'sent',
  });
}
