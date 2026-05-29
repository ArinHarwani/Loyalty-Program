'use client';

import Link from 'next/link';
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from '@/lib/constants';

export default function SuspendedPage() {
  const waLink = `https://wa.me/${SUPPORT_WHATSAPP.replace('+', '')}`;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      <nav className="nav">
        <Link href="/" className="nav-brand">LoyaltyQR</Link>
      </nav>

      <div className="container-sm" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ padding: '3rem', textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚫</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--danger)' }}>
            Account Suspended
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            Your account has been suspended by LoyaltyQR.
          </p>

          <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '1rem' }}>
            Please contact us to resolve this:
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-full">
              💬 Contact on WhatsApp
            </a>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="btn btn-secondary btn-full">
              📧 Email Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
