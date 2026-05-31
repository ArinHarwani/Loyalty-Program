'use client';

import Link from 'next/link';

export default function DataDeletion() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Navigation */}
      <nav className="nav">
        <Link href="/" className="nav-brand">LoyaltyQR</Link>
        <Link href="/" className="btn btn-secondary btn-sm">
          Back to Home
        </Link>
      </nav>

      {/* Main Content */}
      <div className="container-md" style={{ padding: '4rem 1rem' }}>
        <div className="card fade-in" style={{ padding: '2.5rem', background: 'var(--bg-card)' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🗑️</span>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 900, marginBottom: '0.5rem', background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block' }}>
              Data Deletion Request
            </h1>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', lineHeight: '1.75' }}>
            
            {/* Section 1 */}
            <section>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--primary-light)' }}>
                How to delete your data from LoyaltyQR:
              </h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                Send your request to: <strong>loyalltyqr@gmail.com</strong>
              </p>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                Include your WhatsApp number in the request.
              </p>
              <p style={{ color: 'var(--text-secondary)' }}>
                We will delete your data within 7 business days of receiving your request.
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--primary-light)' }}>
                What gets deleted:
              </h2>
              <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li>Your WhatsApp number</li>
                <li>Your birthday (if provided)</li>
                <li>Your transaction history</li>
                <li>Your loyalty progress at all shops</li>
              </ul>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
