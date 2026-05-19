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
