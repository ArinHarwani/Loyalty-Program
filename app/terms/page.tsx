'use client';

import Link from 'next/link';

export default function TermsOfUse() {
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
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>⚖️</span>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 900, marginBottom: '0.5rem', background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block' }}>
              Terms of Use
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Last Updated: May 2026
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', lineHeight: '1.75' }}>
            
            {/* Section 1 */}
            <section>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--primary-light)' }}>
                1. Acceptance of Terms
              </h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                By accessing, browsing, or using the LoyaltyQR application (&apos;Platform&apos;), either as an end customer participating in a loyalty campaign (&apos;Customer&apos;) or as a business owner launching campaigns (&apos;Merchant&apos;), you agree to be bound by these Terms of Use and all applicable laws and regulations.
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--primary-light)' }}>
                2. Platform Role & WhatsApp Automation
              </h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                LoyaltyQR is strictly a technological platform and automation tool that enables Merchants to configure loyalty rewards and send transaction notifications.
              </p>
              <div 
                style={{ 
                  borderLeft: '4px solid var(--warning)', 
                  background: 'rgba(245, 158, 11, 0.05)', 
                  padding: '1rem', 
                  borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                  color: 'var(--text-secondary)',
                  fontSize: '0.9rem'
                }}
              >
                <strong>Important Intermediary Disclaimer:</strong> We are solely a WhatsApp automation tool. We do not write, verify, monitor, control, or initiate the content or frequency of the messages sent to customers. We are not responsible or liable for any unwanted, unsolicited, offensive, spam, or disliked messages received by a Customer. All message delivery and content details depend entirely on the configuration and discretion of the respective Merchant.
              </div>
            </section>

            {/* Section 3 */}
            <section>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--primary-light)' }}>
                3. Limitation of Liability
              </h2>
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
                ⚠️ We do not take any liability of data leakage, data breach or unauthorised activity.
              </div>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                The Platform is provided on an &apos;AS IS&apos; and &apos;AS AVAILABLE&apos; basis. LoyaltyQR, its creators, and operators shall not be held liable for any direct, indirect, incidental, special, or consequential damages resulting from the use or inability to use the Platform, including but not limited to data leakage, server downtime, system hacks, database compromises, or unauthorized modifications to loyalty counts or client records.
              </p>
            </section>

            {/* Section 4 */}
            <section>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--primary-light)' }}>
                4. Merchant Responsibilities
              </h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                Merchants using LoyaltyQR to run campaigns represent and warrant that they have obtained appropriate consents from their Customers to collect and process their phone numbers and/or birthdates. Merchants must comply with all local privacy, data protection, and anti-spam laws. Merchants agree to immediately opt-out any Customer who requests to be removed from their campaign.
              </p>
            </section>

            {/* Section 5 */}
            <section>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--primary-light)' }}>
                5. Customer Input & Birthdate Capture
              </h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                Customers participating in loyalty campaigns acknowledge that their mobile number and birthdate (optional, for birthday wishes and specific promotions) are shared with the hosting Merchant to enable points tracking and milestone delivery. The platform securely automates these notifications but is not responsible for how Merchants utilize this data outside the LoyaltyQR environment.
              </p>
            </section>

            {/* Section 6 */}
            <section style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginTop: '1rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                If you have any questions regarding these Terms, please contact support or your hosting Merchant.<br /><br />
                Contact: loyalltyqr@gmail.com
              </p>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
