import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LoyaltyQR — Digital Loyalty Cards for Your Shop',
  description:
    'Anti-cheat QR loyalty program for local Indian businesses. No app needed — just WhatsApp. Track customer visits and spending with digital loyalty cards.',
  keywords: 'loyalty program, QR code, WhatsApp, India, shop, rewards, customer loyalty',
  openGraph: {
    title: 'LoyaltyQR — Digital Loyalty Cards',
    description: 'Anti-cheat QR loyalty for local shops. No app needed.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
