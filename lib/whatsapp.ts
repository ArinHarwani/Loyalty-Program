// ============================================================
// LoyaltyQR — WhatsApp Integration (Trial Mode)
// ============================================================

/**
 * THE key trial function — determines message recipient.
 * In trial: all messages go to WHATSAPP_OVERRIDE_NUMBER.
 * In production: messages go to actual customer number.
 */
export function getRecipientNumber(customerNumber: string): string {
  if (process.env.WHATSAPP_OVERRIDE_NUMBER) {
    return process.env.WHATSAPP_OVERRIDE_NUMBER;
  }
  // Ensure 91 prefix for Indian numbers
  if (customerNumber.startsWith('91')) {
    return customerNumber;
  }
  return `91${customerNumber}`;
}

/**
 * Adds [TRIAL MODE] prefix when in trial mode.
 * In production, returns the message as-is.
 */
export function formatMessage(message: string, customerNumber?: string): string {
  if (process.env.WHATSAPP_OVERRIDE_NUMBER && customerNumber) {
    return `[TRIAL MODE] Customer: ${customerNumber}\n━━━━━━━━━━━━━━━━━━━━\n${message}`;
  }
  return message;
}

/**
 * Send a free-form WhatsApp text message.
 * Uses Meta Graph API. In trial, all messages go to override number.
 */
export async function sendWhatsAppMessage(
  customerNumber: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const to = getRecipientNumber(customerNumber);
  const body = formatMessage(
    message,
    process.env.WHATSAPP_OVERRIDE_NUMBER ? customerNumber : undefined
  );

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: { body },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('WhatsApp API error:', errorData);
      return { success: false, error: JSON.stringify(errorData) };
    }

    return { success: true };
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send a paid WhatsApp template message (utility or marketing).
 * In trial, recipient is overridden to developer's number.
 */
export async function sendWhatsAppTemplate(
  customerNumber: string,
  templateName: string,
  components: object[]
): Promise<{ success: boolean; error?: string }> {
  const to = getRecipientNumber(customerNumber);

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en' },
            components,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('WhatsApp template error:', errorData);
      return { success: false, error: JSON.stringify(errorData) };
    }

    return { success: true };
  } catch (error) {
    console.error('WhatsApp template send error:', error);
    return { success: false, error: String(error) };
  }
}

// --- Message Composers ---

export function composeWelcomeMessage(
  shopName: string,
  campaignDesc: string,
  reward: string,
  deadline: string,
  amount: number,
  total: number,
  target: number,
  percentage: number,
  daysLeft: number
): string {
  return `🎉 Welcome to ${shopName}'s loyalty program!

Goal: ${campaignDesc}
Prize: ${reward}
Deadline: ${deadline}

First ₹${amount} added!
Progress: ₹${total} / ₹${target} (${percentage}%)
${daysLeft} days remaining 🛍️`;
}

export function composeWelcomeVisitMessage(
  shopName: string,
  campaignDesc: string,
  reward: string,
  deadline: string,
  totalVisits: number,
  targetVisits: number,
  percentage: number,
  daysLeft: number
): string {
  return `🎉 Welcome to ${shopName}'s loyalty program!

Goal: ${campaignDesc}
Prize: ${reward}
Deadline: ${deadline}

First visit logged!
Progress: ${totalVisits} / ${targetVisits} visits (${percentage}%)
${daysLeft} days remaining 🛍️`;
}

export function composeTransactionMessage(
  shopName: string,
  amount: number,
  total: number,
  target: number,
  daysLeft: number,
  percentage: number
): string {
  return `${shopName} Loyalty Update 🎯

₹${amount} added!
Total: ₹${total} / ₹${target}
${daysLeft} days remaining • ${percentage}% complete`;
}

export function composeVisitMessage(
  shopName: string,
  totalVisits: number,
  targetVisits: number,
  daysLeft: number,
  percentage: number
): string {
  return `${shopName} Loyalty Update 🎯

Visit logged!
Total: ${totalVisits} / ${targetVisits} visits
${daysLeft} days remaining • ${percentage}% complete`;
}

export function composeCompletionMessage(
  shopName: string,
  reward: string,
  claimCode: string
): string {
  return `🎉 GOAL COMPLETED at ${shopName}!

Prize: ${reward}
Claim Code: ${claimCode}

Show this code to the shop to claim your reward!`;
}

export function composeHelpMessage(): string {
  return `Welcome to LoyaltyQR! 🎯

To join a loyalty program, scan the QR code at any participating shop.

Need help? Contact the shop directly.`;
}
