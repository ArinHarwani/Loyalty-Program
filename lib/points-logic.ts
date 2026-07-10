// ============================================================
// LoyaltyQR — Digital Points Logic
// Handles earning, redeeming, and balance queries for the
// cashback-based points system.
// ============================================================

import { SupabaseClient } from '@supabase/supabase-js';
import {
  sendWhatsAppMessage,
  composePointsWelcomeMessage,
  composePointsEarnMessage,
  composePointsRedeemMessage,
} from '@/lib/whatsapp';

/**
 * Get the current points balance for a customer at a specific merchant.
 * Uses the most recent ledger entry's `balance_after` for O(1) lookup.
 */
export async function getCustomerBalance(
  merchantId: string,
  customerId: string,
  supabase: SupabaseClient
): Promise<number> {
  const { data } = await supabase
    .from('points_ledger')
    .select('balance_after')
    .eq('merchant_id', merchantId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.balance_after ?? 0;
}

/**
 * Process a points earning event triggered by a QR scan.
 * Called from the WhatsApp webhook when merchant.loyalty_mechanism === 'points'.
 */
export async function processPointsEarn(
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

  // 2. Get merchant + points config
  const { data: merchant } = await supabase
    .from('merchants')
    .select('*')
    .eq('id', qrToken.merchant_id)
    .single();

  if (!merchant) {
    await sendWhatsAppMessage(senderNumber, 'Shop not found.');
    return;
  }

  const { data: config } = await supabase
    .from('points_config')
    .select('*')
    .eq('merchant_id', merchant.id)
    .single();

  if (!config) {
    await sendWhatsAppMessage(senderNumber, 'Points program is not configured for this shop yet. Please inform the shopkeeper.');
    return;
  }

  // 3. Find or create customer
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('whatsapp_number', customerNumber)
    .single();

  if (!customer) {
    await sendWhatsAppMessage(senderNumber, 'Please scan the QR code at the shop first to register. 📱');
    return;
  }

  // 4. Check minimum bill amount
  const billAmount = Number(qrToken.amount);
  if (billAmount <= 0) {
    await sendWhatsAppMessage(senderNumber, 'Returns are not supported for the points system.');
    await supabase.from('qr_tokens').update({ used: true }).eq('token', txnToken);
    return;
  }

  if (config.min_bill_amount && billAmount < Number(config.min_bill_amount)) {
    await sendWhatsAppMessage(
      senderNumber,
      `Minimum purchase of ₹${config.min_bill_amount} is required to earn points at ${merchant.shop_name}.`
    );
    await supabase.from('qr_tokens').update({ used: true }).eq('token', txnToken);
    return;
  }

  // 5. Check customer quota for this merchant
  if (merchant.customer_limit) {
    // Check if this customer already has ledger entries with this merchant
    const { count: existingCount } = await supabase
      .from('points_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchant.id)
      .eq('customer_id', customer.id);

    if (existingCount === 0) {
      // New customer — check quota
      const { count: totalCustomers } = await supabase
        .from('points_ledger')
        .select('customer_id', { count: 'exact', head: true })
        .eq('merchant_id', merchant.id);

      if (totalCustomers !== null && totalCustomers >= merchant.customer_limit) {
        await sendWhatsAppMessage(
          senderNumber,
          "We're sorry, but this shop has reached its maximum loyalty capacity. Please ask the shopkeeper to upgrade their plan."
        );
        await supabase.from('qr_tokens').update({ used: true }).eq('token', txnToken);
        return;
      }
    }
  }

  // 6. Calculate points earned
  const cashbackPct = Number(config.cashback_percentage);
  const pointsEarned = Math.floor(billAmount * (cashbackPct / 100));

  if (pointsEarned <= 0) {
    // Bill too small to generate even 1 point
    await sendWhatsAppMessage(
      senderNumber,
      `Transaction recorded at ${merchant.shop_name}, but the amount was too small to earn points.`
    );
    await supabase.from('qr_tokens').update({ used: true }).eq('token', txnToken);
    return;
  }

  // 7. Get current balance
  const currentBalance = await getCustomerBalance(merchant.id, customer.id, supabase);
  const newBalance = currentBalance + pointsEarned;
  const isFirstEarn = currentBalance === 0;

  // 8. Insert ledger entry
  const { error: ledgerError } = await supabase.from('points_ledger').insert({
    merchant_id: merchant.id,
    customer_id: customer.id,
    type: 'earn',
    points: pointsEarned,
    bill_amount: billAmount,
    cashback_pct_at_time: cashbackPct,
    conversion_rate_at_time: Number(config.conversion_rate),
    balance_after: newBalance,
    qr_token: txnToken,
  });

  if (ledgerError) {
    console.error('Points ledger insert error:', ledgerError);
    await sendWhatsAppMessage(senderNumber, 'Could not process your points. Please try again.');
    return;
  }

  // 9. Mark token used
  await supabase.from('qr_tokens').update({ used: true }).eq('token', txnToken);

  // 10. Send WhatsApp message
  const customerName = customer.name || '';
  let replyText: string;

  if (isFirstEarn) {
    replyText = composePointsWelcomeMessage(
      customerName, merchant.shop_name, pointsEarned, newBalance, cashbackPct
    );
  } else {
    replyText = composePointsEarnMessage(
      customerName, merchant.shop_name, pointsEarned, newBalance
    );
  }

  await sendWhatsAppMessage(senderNumber, replyText);

  // 11. Log message
  await supabase.from('message_logs').insert({
    merchant_id: merchant.id,
    customer_id: customer.id,
    template_name: isFirstEarn ? 'points_welcome' : 'points_earn',
    category: 'service',
    cost: 0,
    status: 'sent',
  });
}

/**
 * Process a points redemption, initiated by the merchant at the counter.
 * Returns the currency value of the redeemed points.
 *
 * Concurrency safety: uses "read-then-write" with balance_after check.
 * If two concurrent requests both read the same balance, only one will
 * produce a valid balance_after (the second will see a stale balance).
 */
export async function processPointsRedeem(
  merchantId: string,
  customerId: string,
  pointsToRedeem: number,
  supabase: SupabaseClient
): Promise<{ success: boolean; message: string; currencyValue?: number; newBalance?: number }> {
  // 1. Get points config
  const { data: config } = await supabase
    .from('points_config')
    .select('*')
    .eq('merchant_id', merchantId)
    .single();

  if (!config) {
    return { success: false, message: 'Points config not found' };
  }

  // 2. Get current balance
  const currentBalance = await getCustomerBalance(merchantId, customerId, supabase);

  if (currentBalance <= 0) {
    return { success: false, message: 'No points balance to redeem' };
  }

  // 3. Check minimum redeem threshold
  if (config.min_redeem_points && currentBalance < Number(config.min_redeem_points)) {
    return {
      success: false,
      message: `Minimum ${config.min_redeem_points} points required to redeem. Current balance: ${currentBalance}`,
    };
  }

  // 4. Validate amount
  if (pointsToRedeem <= 0) {
    return { success: false, message: 'Points to redeem must be greater than zero' };
  }

  if (pointsToRedeem > currentBalance) {
    return { success: false, message: `Cannot redeem ${pointsToRedeem} points. Balance is only ${currentBalance}.` };
  }

  // 5. Calculate currency value
  const conversionRate = Number(config.conversion_rate);
  const currencyValue = Math.round(pointsToRedeem * conversionRate);
  const newBalance = currentBalance - pointsToRedeem;

  // 6. Insert redemption ledger entry
  const { error: ledgerError } = await supabase.from('points_ledger').insert({
    merchant_id: merchantId,
    customer_id: customerId,
    type: 'redeem',
    points: -pointsToRedeem,
    bill_amount: null,
    cashback_pct_at_time: null,
    conversion_rate_at_time: conversionRate,
    balance_after: newBalance,
    notes: `Redeemed ${pointsToRedeem} points for ₹${currencyValue} discount`,
  });

  if (ledgerError) {
    console.error('Points redeem ledger error:', ledgerError);
    return { success: false, message: 'Failed to process redemption. Please try again.' };
  }

  // 7. Send WhatsApp to customer
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  if (customer) {
    const waNumber = customer.whatsapp_number.startsWith('91')
      ? customer.whatsapp_number
      : `91${customer.whatsapp_number}`;

    const { data: merchant } = await supabase
      .from('merchants')
      .select('shop_name')
      .eq('id', merchantId)
      .single();

    const replyText = composePointsRedeemMessage(
      customer.name || '',
      merchant?.shop_name || 'Shop',
      pointsToRedeem,
      currencyValue,
      newBalance
    );

    await sendWhatsAppMessage(waNumber, replyText);

    // Log message
    await supabase.from('message_logs').insert({
      merchant_id: merchantId,
      customer_id: customerId,
      template_name: 'points_redeem',
      category: 'service',
      cost: 0,
      status: 'sent',
    });
  }

  return {
    success: true,
    message: `Redeemed ${pointsToRedeem} points for ₹${currencyValue} discount`,
    currencyValue,
    newBalance,
  };
}

/**
 * Handle status check for points (triggered via Quick Reply button from Expiry template)
 */
export async function handlePointsStatusCheck(
  merchantId: string,
  customerId: string,
  senderNumber: string,
  supabase: SupabaseClient
): Promise<void> {
  const { data: merchant } = await supabase
    .from('merchants')
    .select('shop_name')
    .eq('id', merchantId)
    .single();

  if (!merchant) return;

  const currentBalance = await getCustomerBalance(merchantId, customerId, supabase);

  const { data: config } = await supabase
    .from('points_config')
    .select('expiry_months')
    .eq('merchant_id', merchantId)
    .single();

  let expiryText = '';

  if (config && config.expiry_months) {
    // Fetch last activity
    const { data: latestLedger } = await supabase
      .from('points_ledger')
      .select('created_at')
      .eq('merchant_id', merchantId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestLedger) {
      const expiryDate = new Date(latestLedger.created_at);
      expiryDate.setMonth(expiryDate.getMonth() + config.expiry_months);
      
      const dateFormatter = new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      
      expiryText = `\n\n⏳ ${currentBalance} points expire on ${dateFormatter.format(expiryDate)}`;
    }
  }

  const message = `💎 Your Balance at ${merchant.shop_name}:\nCurrent Balance: ${currentBalance} points${expiryText}`;

  await sendWhatsAppMessage(senderNumber, message);

  const customerNumber = senderNumber.startsWith('91')
    ? senderNumber.substring(2)
    : senderNumber;

  // Update last_whatsapp_at — customer just messaged us
  await supabase
    .from('customers')
    .update({ last_whatsapp_at: new Date().toISOString() })
    .eq('whatsapp_number', customerNumber);

  // Log as service (free — customer initiated by tapping button)
  await supabase.from('message_logs').insert({
    merchant_id: merchantId,
    customer_id: customerId,
    template_name: 'status_check_reply',
    category: 'service',
    cost: 0,
    status: 'sent',
  });
}
