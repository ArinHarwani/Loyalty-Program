export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<void> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: { body: message },
        }),
      }
    );
    if (!response.ok) {
      const error = await response.json();
      console.error('WhatsApp send failed:', error);
    }
  } catch (err) {
    console.error('WhatsApp send error:', err);
    // Never throw — WhatsApp failure should never break the scan flow
  }
}

export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  components: object[]
): Promise<void> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
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
      const error = await response.json();
      console.error('WhatsApp template send failed:', error);
    }
  } catch (err) {
    console.error('WhatsApp template error:', err);
  }
}

// --- Message Composers ---
// customerName: pass customer's name, falls back to "there" if empty

export function composeWelcomeMessage(
  customerName: string,
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
  const greeting = customerName ? `Hi ${customerName}! 👋` : 'Hi there! 👋';
  return `${greeting}

🎉 Welcome to ${shopName}'s loyalty program!

Goal: ${campaignDesc}
Prize: ${reward}
Deadline: ${deadline}

First ₹${amount} added!
Progress: ₹${total} / ₹${target} (${percentage}%)
${daysLeft} days remaining 🛍️`;
}

export function composeWelcomeVisitMessage(
  customerName: string,
  shopName: string,
  campaignDesc: string,
  reward: string,
  deadline: string,
  totalVisits: number,
  targetVisits: number,
  percentage: number,
  daysLeft: number
): string {
  const greeting = customerName ? `Hi ${customerName}! 👋` : 'Hi there! 👋';
  return `${greeting}

🎉 Welcome to ${shopName}'s loyalty program!

Goal: ${campaignDesc}
Prize: ${reward}
Deadline: ${deadline}

First visit logged!
Progress: ${totalVisits} / ${targetVisits} visits (${percentage}%)
${daysLeft} days remaining 🛍️`;
}

export function composeTransactionMessage(
  customerName: string,
  shopName: string,
  amount: number,
  total: number,
  target: number,
  daysLeft: number,
  percentage: number
): string {
  const greeting = customerName ? `Hi ${customerName}!` : 'Hey!';
  return `${greeting} ${shopName} Loyalty Update 🎯

₹${amount} added!
Total: ₹${total} / ₹${target}
${daysLeft} days remaining • ${percentage}% complete`;
}

export function composeVisitMessage(
  customerName: string,
  shopName: string,
  totalVisits: number,
  targetVisits: number,
  daysLeft: number,
  percentage: number
): string {
  const greeting = customerName ? `Hi ${customerName}!` : 'Hey!';
  return `${greeting} ${shopName} Loyalty Update 🎯

Visit logged!
Total: ${totalVisits} / ${targetVisits} visits
${daysLeft} days remaining • ${percentage}% complete`;
}

export function composeCompletionMessage(
  customerName: string,
  shopName: string,
  reward: string,
  claimCode: string
): string {
  const greeting = customerName ? `Congratulations ${customerName}! 🎉` : 'Congratulations! 🎉';
  return `${greeting}

🏆 GOAL COMPLETED at ${shopName}!

Prize: ${reward}
Claim Code: ${claimCode}

Show this code to the shop to claim your reward! 🎁`;
}

export function composeBirthdayMessage(
  customerName: string,
  shopName: string
): string {
  const name = customerName || 'Friend';
  return `🎂 Happy Birthday, ${name}! 🎉

We at ${shopName} wish you a wonderful birthday filled with joy, laughter, and all your favourite things! 🥳

You're a very special customer to us and we hope today is as amazing as you are. 🌟

Come visit us soon — we'd love to celebrate with you! 🎁

With lots of love,
Team ${shopName} 💚`;
}
