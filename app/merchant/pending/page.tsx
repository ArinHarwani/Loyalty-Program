'use client';

import Link from 'next/link';
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from '@/lib/constants';

export default function PendingPage() {
  const waLink = `https://wa.me/${SUPPORT_WHATSAPP.replace('+', '')}`;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      <nav className="nav">
        <Link href="/" className="nav-brand">LoyaltyQR</Link>
      </nav>

      <div className="container-sm" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card slide-up" style={{ padding: '3rem', textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--success)' }}>
            Account Created Successfully!
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            Your account is being reviewed. We will activate it shortly.
          </p>

          <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
            <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9rem' }}>
              For faster activation, contact us:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <a 
                href={waLink} 
                target="_blank" 
                rel="noopener noreferrer" 
                style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                💬 WhatsApp: {SUPPORT_WHATSAPP}
              </a>
              <a 
                href={`mailto:${SUPPORT_EMAIL}`} 
                style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textDecoration: 'none' }}
              >
                📧 {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
