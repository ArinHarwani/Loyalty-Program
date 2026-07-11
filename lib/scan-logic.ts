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
    .order('enrolled_at', { ascending: false })
    .limit(1)
    .single();

  let activeEnrollment = (enrollment && enrollment.status === 'active') ? enrollment : null;
  let latestCycleNumber = enrollment ? (enrollment.cycle_number || 1) : 0;

  // Helper to create a new cycle
  const createNewEnrollment = async (cycleNum: number) => {
    // Check if the merchant has reached their customer limit (only for first ever enrollment)
    if (cycleNum === 1 && merchant.customer_limit) {
      const { count, error: countError } = await supabase
        .from('enrollments')
        .select('customer_id', { count: 'exact', head: true })
        .eq('merchant_id', merchant.id);

      if (!countError && count !== null && count >= merchant.customer_limit) {
        throw new Error("We're sorry, but this shop has reached its maximum loyalty capacity at the moment. Please ask the shopkeeper to upgrade their plan.");
      }
    }

    let deadline: Date;
    if (campaign.window_mode === 'rolling' && campaign.window_duration_days) {
      deadline = new Date();
      deadline.setDate(deadline.getDate() + campaign.window_duration_days);
    } else if (campaign.end_date) {
      deadline = new Date(campaign.end_date);
      deadline.setHours(23, 59, 59, 999);
    } else {
      deadline = new Date();
      deadline.setDate(deadline.getDate() + campaign.duration_days);
    }

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
        cycle_number: cycleNum,
        config_snapshot: campaign.window_mode === 'rolling' ? {
          target_amount: campaign.target_amount,
          target_visits: campaign.target_visits,
          duration_days: campaign.duration_days,
          reward_description: campaign.reward_description,
        } : null,
      })
      .select()
      .single();
    
    return newEnrollment;
  };

  const isReturnTxn = Number(qrToken.amount) < 0;

  if (isReturnTxn) {
    if (!activeEnrollment) {
      await sendWhatsAppMessage(senderNumber, 'No active goal found to return from.');
      return;
    }
    const returnAmount = Math.abs(Number(qrToken.amount));
    const newTotalSpent = Math.max(0, Number(activeEnrollment.total_spent) - returnAmount);

    // 5. Insert transaction
    await supabase.from('transactions').insert({
      enrollment_id: activeEnrollment.id,
      merchant_id: merchant.id,
      amount: qrToken.amount,
      qr_token: txnToken,
    });

    await supabase
      .from('enrollments')
      .update({ total_spent: newTotalSpent })
      .eq('id', activeEnrollment.id);

    const target = campaign.campaign_type === 'amount'
      ? activeEnrollment.config_snapshot?.target_amount || campaign.target_amount || 0
      : activeEnrollment.config_snapshot?.target_visits || campaign.target_visits || 0;
    const daysLeft = daysRemaining(activeEnrollment.deadline_at);
    
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

  // Handle active enrollment deadline
  if (activeEnrollment && new Date(activeEnrollment.deadline_at) < new Date()) {
    await supabase.from('enrollments').update({ status: 'expired' }).eq('id', activeEnrollment.id);
    await sendWhatsAppMessage(
      senderNumber,
      `⏰ Your loyalty enrollment at ${merchant.shop_name} has expired.\n\nScan the QR at your next visit to start fresh!`
    );
    await supabase.from('qr_tokens').update({ used: true }).eq('token', txnToken);
    return;
  }

  let remainingPurchaseAmount = Number(qrToken.amount);
  let cycleCompletions: Array<{ claimCode: string; reward: string }> = [];
  let isFirstTransaction = false;
  let finalEnrollment = null;

  try {
    if (campaign.campaign_type === 'amount') {
      // Amount Campaign: cascade through targets
      while (remainingPurchaseAmount > 0) {
        if (!activeEnrollment) {
          latestCycleNumber++;
          activeEnrollment = await createNewEnrollment(latestCycleNumber);
          if (activeEnrollment && activeEnrollment.total_visits === 0 && remainingPurchaseAmount === Number(qrToken.amount)) {
             isFirstTransaction = true;
          }
        }
        
        if (!activeEnrollment) throw new Error('Could not create enrollment');

        const target = activeEnrollment.config_snapshot?.target_amount || campaign.target_amount || 0;
        const remainingToTarget = Math.max(0, target - activeEnrollment.total_spent);
        
        const appliedAmount = Math.min(remainingPurchaseAmount, remainingToTarget);
        remainingPurchaseAmount -= appliedAmount;
        
        if (appliedAmount > 0) {
          await supabase.from('transactions').insert({
            enrollment_id: activeEnrollment.id,
            merchant_id: merchant.id,
            amount: appliedAmount,
            qr_token: txnToken,
          });
        }
        
        const newTotalSpent = activeEnrollment.total_spent + appliedAmount;
        // Visits increment once per scan on the first cycle it touches
        const newTotalVisits = activeEnrollment.total_visits === 0 ? 1 : activeEnrollment.total_visits;

        if (newTotalSpent >= target && target > 0) {
          const claimCode = generateClaimCode();
          await supabase.from('enrollments').update({
            total_spent: newTotalSpent,
            total_visits: newTotalVisits,
            status: 'completed',
            claim_code: claimCode
          }).eq('id', activeEnrollment.id);
          
          cycleCompletions.push({ claimCode, reward: activeEnrollment.config_snapshot?.reward_description || campaign.reward_description || '' });
          activeEnrollment = null; 
        } else {
          await supabase.from('enrollments').update({
            total_spent: newTotalSpent,
            total_visits: newTotalVisits
          }).eq('id', activeEnrollment.id);
          activeEnrollment.total_spent = newTotalSpent;
          activeEnrollment.total_visits = newTotalVisits;
          finalEnrollment = activeEnrollment;
        }
      }
    } else {
      // Visits Campaign: +1 visit, never cascades to multiple targets from a single scan
      if (!activeEnrollment) {
        latestCycleNumber++;
        activeEnrollment = await createNewEnrollment(latestCycleNumber);
        isFirstTransaction = true;
      }
      
      if (!activeEnrollment) throw new Error('Could not create enrollment');
      
      const target = activeEnrollment.config_snapshot?.target_visits || campaign.target_visits || 0;
      const newTotalVisits = activeEnrollment.total_visits + 1;
      
      await supabase.from('transactions').insert({
        enrollment_id: activeEnrollment.id,
        merchant_id: merchant.id,
        amount: qrToken.amount,
        qr_token: txnToken,
      });

      if (newTotalVisits >= target && target > 0) {
        const claimCode = generateClaimCode();
        await supabase.from('enrollments').update({
          total_visits: newTotalVisits,
          status: 'completed',
          claim_code: claimCode
        }).eq('id', activeEnrollment.id);
        
        cycleCompletions.push({ claimCode, reward: activeEnrollment.config_snapshot?.reward_description || campaign.reward_description || '' });
        finalEnrollment = null;
      } else {
        await supabase.from('enrollments').update({
          total_visits: newTotalVisits
        }).eq('id', activeEnrollment.id);
        activeEnrollment.total_visits = newTotalVisits;
        finalEnrollment = activeEnrollment;
      }
    }
  } catch (err: any) {
    await sendWhatsAppMessage(senderNumber, err.message || 'Could not process your transaction.');
    return;
  }

  // 8. Mark token used
  await supabase.from('qr_tokens').update({ used: true }).eq('token', txnToken);

  const customerName = customer.name || '';
  const campaignDesc = getCampaignDescription(
    campaign.campaign_type,
    campaign.target_amount,
    campaign.target_visits,
    campaign.duration_days
  );

  // Send completion messages for every completed cycle
  for (const comp of cycleCompletions) {
    const replyText = composeCompletionMessage(customerName, merchant.shop_name, comp.reward, comp.claimCode);
    await sendWhatsAppMessage(senderNumber, replyText);
    await supabase.from('message_logs').insert({
      merchant_id: merchant.id,
      customer_id: customer.id,
      template_name: 'goal_completed',
      category: 'service',
      cost: 0,
      status: 'sent',
    });
  }

  // Send progress message if there is an active cycle left over (or if they didn't complete any)
  if (finalEnrollment) {
    const target = campaign.campaign_type === 'amount'
      ? finalEnrollment.config_snapshot?.target_amount || campaign.target_amount || 0
      : finalEnrollment.config_snapshot?.target_visits || campaign.target_visits || 0;
    const current = campaign.campaign_type === 'amount' ? finalEnrollment.total_spent : finalEnrollment.total_visits;
    const percentage = calcPercentage(current, target);
    const daysLeft = daysRemaining(finalEnrollment.deadline_at);
    
    const isFirstWelcome = isFirstTransaction && cycleCompletions.length === 0;

    let replyText: string;
    if (isFirstWelcome) {
      if (campaign.campaign_type === 'amount') {
        replyText = composeWelcomeMessage(
          customerName, merchant.shop_name, campaignDesc, campaign.reward_description,
          formatDate(finalEnrollment.deadline_at), qrToken.amount,
          finalEnrollment.total_spent, target, percentage, daysLeft
        );
      } else {
        replyText = composeWelcomeVisitMessage(
          customerName, merchant.shop_name, campaignDesc, campaign.reward_description,
          formatDate(finalEnrollment.deadline_at), finalEnrollment.total_visits,
          target, percentage, daysLeft
        );
      }
    } else {
      if (campaign.campaign_type === 'amount') {
        replyText = composeTransactionMessage(
          customerName, merchant.shop_name, qrToken.amount, finalEnrollment.total_spent,
          target, daysLeft, percentage
        );
      } else {
        replyText = composeVisitMessage(
          customerName, merchant.shop_name, finalEnrollment.total_visits,
          target, daysLeft, percentage
        );
      }
    }

    await sendWhatsAppMessage(senderNumber, replyText);
    await supabase.from('message_logs').insert({
      merchant_id: merchant.id,
      customer_id: customer.id,
      template_name: isFirstWelcome ? 'welcome' : 'transaction_update',
      category: 'service',
      cost: 0,
      status: 'sent',
    });
  }
}

export async function handleStatusCheck(
  enrollmentId: string,
  senderNumber: string,
  supabase: SupabaseClient
): Promise<void> {
  // Fetch enrollment with all related data
  // Use alias syntax (merchant:merchants) so Supabase returns a single object, not an array
  const { data: enrollment, error } = await supabase
    .from('enrollments')
    .select(`
      id,
      total_spent,
      total_visits,
      deadline_at,
      status,
      merchant_id,
      customer_id,
      campaign:campaigns (
        campaign_type,
        target_amount,
        target_visits,
        reward_description
      ),
      merchant:merchants (
        shop_name
      )
    `)
    .eq('id', enrollmentId)
    .single();

  if (error || !enrollment || !enrollment.campaign || !enrollment.merchant) {
    await sendWhatsAppMessage(
      senderNumber,
      'Sorry, we could not find your account details. Please scan the QR at the shop counter.'
    );
    return;
  }

  const daysLeft = daysRemaining(enrollment.deadline_at);
  const campaign = enrollment.campaign as unknown as import('@/types').Campaign;
  const shopName = (enrollment.merchant as unknown as import('@/types').Merchant).shop_name;
  const customerNumber = senderNumber.startsWith('91')
    ? senderNumber.substring(2)
    : senderNumber;

  // Build progress text based on campaign type
  let progressText = '';

  if (campaign.campaign_type === 'amount') {
    const percentageDone = calcPercentage(enrollment.total_spent, campaign.target_amount ?? 0);
    progressText = `₹${Number(enrollment.total_spent).toLocaleString('en-IN')} / ₹${Number(campaign.target_amount ?? 0).toLocaleString('en-IN')} (${percentageDone}%)`;
  } else {
    const percentageDone = calcPercentage(enrollment.total_visits, campaign.target_visits ?? 0);
    progressText = `${enrollment.total_visits} / ${campaign.target_visits ?? 0} visits (${percentageDone}%)`;
  }

  // Build reply message
  const message =
`${shopName} — Account Status 📊

Progress: ${progressText}
Days remaining: ${daysLeft}
Reward: ${campaign.reward_description}

${daysLeft <= 3 ? '⚠️ Hurry! Your period ends very soon.' : 'Keep it up! 🎯'}`;

  // Send free service window reply (not a template)
  await sendWhatsAppMessage(senderNumber, message);

  // Update last_whatsapp_at — customer just messaged us
  await supabase
    .from('customers')
    .update({ last_whatsapp_at: new Date().toISOString() })
    .eq('whatsapp_number', customerNumber);

  // Log as service (free — customer initiated by tapping button)
  await supabase.from('message_logs').insert({
    merchant_id: enrollment.merchant_id,
    customer_id: enrollment.customer_id,
    template_name: 'status_check_reply',
    category: 'service',
    cost: 0,
    status: 'sent',
  });
}


