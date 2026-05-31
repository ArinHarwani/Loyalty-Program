'use client';

import Link from 'next/link';

export default function PrivacyPolicy() {
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
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🔒</span>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 900, marginBottom: '0.5rem', background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block' }}>
              Privacy Policy
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Last Updated: May 2026
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', lineHeight: '1.75' }}>
            
            {/* Section 1 */}
            <section>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--primary-light)' }}>
                1. Data We Collect
              </h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                LoyaltyQR acts as an automation provider for local businesses. To facilitate loyalty campaigns, we collect:
              </p>
              <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li>
                  <strong>Mobile Number:</strong> Provided by Customers upon scanning a campaign QR code. Used exclusively to log transactions and automate loyalty points updates via WhatsApp.
                </li>
                <li>
                  <strong>Birthdate (Optional):</strong> Provided voluntarily by Customers. Used exclusively by Merchants to send birthday greetings, rewards, or promotional updates.
                </li>
                <li>
                  <strong>Transaction Metrics:</strong> Spent amount, visit logs, timestamp of visits, and claim status.
                </li>
              </ul>
            </section>

            {/* Section 2 */}
            <section>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--primary-light)' }}>
                2. How Data is Shared & Used
              </h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                Your data is stored securely inside encrypted database systems. It is made accessible **only** to the specific Merchant (shop owner) whose campaign QR code you scanned. We **never** sell, distribute, or share customer contact databases with any third-party marketing companies, advertisers, or other platforms.
              </p>
            </section>

            {/* Section 3 */}
            <section>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--primary-light)' }}>
                3. Security Disclaimer & Liability Waiver
              </h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                We employ standard database protection methods, RLS (Row Level Security) filters, and secure server-to-server validation channels to safe-guard transactions.
              </p>
              <div 
                style={{ 
                  borderLeft: '4px solid var(--danger)', 
                  background: 'rgba(239, 68, 68, 0.05)', 
                  padding: '1rem', 
                  borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.95rem'
                }}
              >
                ⚠️ As stated in our Terms of Use, we do not take any liability of data leakage, data breach or unauthorised activity. No method of internet transmission or database storage can be guaranteed 100% secure.
              </div>
            </section>

            {/* Section 4 */}
            <section>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--primary-light)' }}>
                4. Customer Opt-Out & Deletion
              </h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                If you wish to stop receiving updates or want your mobile number and birthday deleted from a specific Merchant&apos;s active campaigns, please message the Merchant directly or contact LoyaltyQR support. Upon request, we will remove your records from the database in compliance with data privacy principles.
              </p>
            </section>

            {/* Section 5 */}
            <section style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginTop: '1rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                For further clarification regarding your personal data, please contact the specific Merchant shop or our team.<br /><br />
                Contact: loyalltyqr@gmail.com
              </p>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
