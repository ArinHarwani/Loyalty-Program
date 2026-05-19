// ============================================================
// LoyaltyQR — Core Scan Logic (shared by API + webhook)
// ============================================================

import { createServiceClient } from './supabase';
import {
  generateClaimCode,
  calcPercentage,
  daysRemaining,
  formatDate,
  getCampaignDescription,
} from './utils';
import {
  sendWhatsAppMessage,
  composeWelcomeMessage,
  composeWelcomeVisitMessage,
  composeTransactionMessage,
  composeVisitMessage,
  composeCompletionMessage,
} from './whatsapp';
import type { ScanResult } from '@/types';

interface ScanInput {
  token: string;
  whatsapp_number: string;
  birth_month?: number;
  birth_day?: number;
}

/**
 * Core scan processing — 10-step flow from PRD.
 * Called from both the scan page API and the WhatsApp webhook.
 */
export async function processScan(input: ScanInput): Promise<ScanResult> {
  const supabase = createServiceClient();

  // Step 1: Validate token (not used, not expired)
  const { data: qrToken, error: tokenError } = await supabase
    .from('qr_tokens')
    .select('*')
    .eq('token', input.token)
    .single();

  if (tokenError || !qrToken) {
    return {
      success: false,
      message: 'Invalid QR code. Please ask the shop to generate a new one.',
      isNewCustomer: false,
      isCompleted: false,
      progress: { current: 0, target: 0, percentage: 0, daysRemaining: 0 },
      shopName: '',
      reward: '',
    };
  }

  if (qrToken.used) {
    return {
      success: false,
      message: 'This QR code has already been used.',
      isNewCustomer: false,
      isCompleted: false,
      progress: { current: 0, target: 0, percentage: 0, daysRemaining: 0 },
      shopName: '',
      reward: '',
    };
  }

  if (new Date(qrToken.expires_at) < new Date()) {
    return {
      success: false,
      message: 'This QR code has expired. Please ask the shop for a new one.',
      isNewCustomer: false,
      isCompleted: false,
      progress: { current: 0, target: 0, percentage: 0, daysRemaining: 0 },
      shopName: '',
      reward: '',
    };
  }

  // Step 2: Get merchant + campaign from token
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
    return {
      success: false,
      message: 'Campaign not found.',
      isNewCustomer: false,
      isCompleted: false,
      progress: { current: 0, target: 0, percentage: 0, daysRemaining: 0 },
      shopName: '',
      reward: '',
    };
  }

  if (campaign.status === 'ended') {
    return {
      success: false,
      message: 'This campaign has ended.',
      isNewCustomer: false,
      isCompleted: false,
      progress: { current: 0, target: 0, percentage: 0, daysRemaining: 0 },
      shopName: merchant.shop_name,
      reward: '',
    };
  }

  // Step 3: Find or create customer by whatsapp_number
  let isNewCustomer = false;
  let { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('whatsapp_number', input.whatsapp_number)
    .single();

  if (!customer) {
    isNewCustomer = true;
    const { data: newCustomer, error: createError } = await supabase
      .from('customers')
      .insert({
        whatsapp_number: input.whatsapp_number,
        birth_month: input.birth_month || null,
        birth_day: input.birth_day || null,
      })
      .select()
      .single();

    if (createError || !newCustomer) {
      return {
        success: false,
        message: 'Failed to register customer.',
        isNewCustomer: false,
        isCompleted: false,
        progress: { current: 0, target: 0, percentage: 0, daysRemaining: 0 },
        shopName: merchant.shop_name,
        reward: campaign.reward_description,
      };
    }
    customer = newCustomer;
  } else if (input.birth_month && input.birth_day && (!customer.birth_month || !customer.birth_day)) {
    // Update birthday if not set before
    await supabase
      .from('customers')
      .update({ birth_month: input.birth_month, birth_day: input.birth_day })
      .eq('id', customer.id);
  }

  // Step 4: Find or create enrollment
  let { data: enrollment } = await supabase
    .from('enrollments')
    .select('*')
    .eq('customer_id', customer.id)
    .eq('campaign_id', campaign.id)
    .eq('merchant_id', merchant.id)
    .in('status', ['active'])
    .single();

  if (!enrollment) {
    // Check if max winners reached
    if (campaign.max_winners) {
      const { count } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .eq('status', 'completed');

      if (count !== null && count >= campaign.max_winners) {
        return {
          success: false,
          message: 'This campaign has reached its maximum number of winners.',
          isNewCustomer,
          isCompleted: false,
          progress: { current: 0, target: 0, percentage: 0, daysRemaining: 0 },
          shopName: merchant.shop_name,
          reward: campaign.reward_description,
        };
      }
    }

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + campaign.duration_days);

    const { data: newEnrollment, error: enrollError } = await supabase
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

    if (enrollError || !newEnrollment) {
      return {
        success: false,
        message: 'Failed to enroll in campaign.',
        isNewCustomer,
        isCompleted: false,
        progress: { current: 0, target: 0, percentage: 0, daysRemaining: 0 },
        shopName: merchant.shop_name,
        reward: campaign.reward_description,
      };
    }
    enrollment = newEnrollment;
  }

  // Check if enrollment has expired
  if (new Date(enrollment.deadline_at) < new Date()) {
    await supabase
      .from('enrollments')
      .update({ status: 'expired' })
      .eq('id', enrollment.id);

    return {
      success: false,
      message: 'Your enrollment has expired. Scan again to start fresh!',
      isNewCustomer: false,
      isCompleted: false,
      progress: { current: 0, target: 0, percentage: 0, daysRemaining: 0 },
      shopName: merchant.shop_name,
      reward: campaign.reward_description,
    };
  }

  // Step 5: Insert transaction
  await supabase.from('transactions').insert({
    enrollment_id: enrollment.id,
    merchant_id: merchant.id,
    amount: qrToken.amount,
    qr_token: input.token,
  });

  // Step 6: Update total_spent / total_visits
  const newTotalSpent = Number(enrollment.total_spent) + Number(qrToken.amount);
  const newTotalVisits = Number(enrollment.total_visits) + 1;

  await supabase
    .from('enrollments')
    .update({
      total_spent: newTotalSpent,
      total_visits: newTotalVisits,
    })
    .eq('id', enrollment.id);

  // Step 7: Check completion condition
  let isCompleted = false;
  let claimCode: string | undefined;

  if (campaign.campaign_type === 'amount' && campaign.target_amount) {
    isCompleted = newTotalSpent >= campaign.target_amount;
  } else if (campaign.campaign_type === 'visits' && campaign.target_visits) {
    isCompleted = newTotalVisits >= campaign.target_visits;
  }

  // Step 8: If completed, generate claim code
  if (isCompleted) {
    claimCode = generateClaimCode();
    await supabase
      .from('enrollments')
      .update({
        status: 'completed',
        claim_code: claimCode,
      })
      .eq('id', enrollment.id);
  }

  // Step 9: Mark token used
  await supabase
    .from('qr_tokens')
    .update({ used: true })
    .eq('token', input.token);

  // Calculate progress
  const target =
    campaign.campaign_type === 'amount'
      ? campaign.target_amount || 0
      : campaign.target_visits || 0;
  const current =
    campaign.campaign_type === 'amount' ? newTotalSpent : newTotalVisits;
  const percentage = calcPercentage(current, target);
  const daysLeft = daysRemaining(enrollment.deadline_at);

  // Step 10: Log to message_logs + compose reply
  const campaignDesc = getCampaignDescription(
    campaign.campaign_type,
    campaign.target_amount,
    campaign.target_visits,
    campaign.duration_days
  );

  let messageText: string;

  if (isCompleted) {
    messageText = composeCompletionMessage(
      merchant.shop_name,
      campaign.reward_description,
      claimCode!
    );
  } else if (isNewCustomer || (newTotalVisits === 1 && newTotalSpent === qrToken.amount)) {
    // First transaction in this enrollment
    if (campaign.campaign_type === 'amount') {
      messageText = composeWelcomeMessage(
        merchant.shop_name,
        campaignDesc,
        campaign.reward_description,
        formatDate(enrollment.deadline_at),
        qrToken.amount,
        newTotalSpent,
        campaign.target_amount || 0,
        percentage,
        daysLeft
      );
    } else {
      messageText = composeWelcomeVisitMessage(
        merchant.shop_name,
        campaignDesc,
        campaign.reward_description,
        formatDate(enrollment.deadline_at),
        newTotalVisits,
        campaign.target_visits || 0,
        percentage,
        daysLeft
      );
    }
  } else {
    if (campaign.campaign_type === 'amount') {
      messageText = composeTransactionMessage(
        merchant.shop_name,
        qrToken.amount,
        newTotalSpent,
        campaign.target_amount || 0,
        daysLeft,
        percentage
      );
    } else {
      messageText = composeVisitMessage(
        merchant.shop_name,
        newTotalVisits,
        campaign.target_visits || 0,
        daysLeft,
        percentage
      );
    }
  }

  // Send WhatsApp message
  const sendResult = await sendWhatsAppMessage(input.whatsapp_number, messageText);

  // Log the message
  await supabase.from('message_logs').insert({
    merchant_id: merchant.id,
    customer_id: customer.id,
    template_name: isCompleted ? 'goal_completed' : isNewCustomer ? 'welcome' : 'transaction_update',
    category: 'service',
    cost: 0,
    status: sendResult.success ? 'sent' : 'failed',
  });

  return {
    success: true,
    message: messageText,
    isNewCustomer,
    isCompleted,
    claimCode,
    progress: {
      current,
      target,
      percentage,
      daysRemaining: daysLeft,
    },
    shopName: merchant.shop_name,
    reward: campaign.reward_description,
  };
}
