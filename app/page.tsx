'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', color: 'var(--charcoal)' }}>
      {/* Nav */}
      <nav className="nav">
        <span className="nav-brand">LoyaltyQR</span>
        <Link href="/merchant/login" className="btn btn-primary btn-sm">
          Merchant Login
        </Link>
      </nav>

      {/* Hero */}
      <section
        style={{
          padding: '5rem 1rem 4rem',
          textAlign: 'center',
          borderBottom: '1px solid var(--rule)',
        }}
      >
        <div
          style={{
            maxWidth: '700px',
            margin: '0 auto',
          }}
        >
          <div
            className="badge badge-success"
            style={{ marginBottom: '1.5rem', display: 'inline-flex' }}
          >
            🇮🇳 Built for Indian Shopkeepers
          </div>

          <h1
            style={{
              fontSize: 'clamp(2rem, 5vw, 3.25rem)',
              fontWeight: 800,
              lineHeight: 1.15,
              marginBottom: '1.25rem',
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            A Digital Ledger for Customer Loyalty
          </h1>

          <p
            style={{
              fontSize: '1.15rem',
              color: 'var(--muted)',
              maxWidth: '520px',
              margin: '0 auto 2.5rem',
              lineHeight: 1.6,
            }}
          >
            Replace paper bahi-khatas and physical punch cards. Track customer visits
            and give rewards instantly over WhatsApp.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/merchant/login" className="btn btn-primary btn-lg">
              Start Using Now →
            </Link>
            <a href="#features" className="btn btn-secondary btn-lg">
              How It Works
            </a>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '2rem',
              justifyContent: 'center',
              marginTop: '3rem',
              flexWrap: 'wrap',
              borderTop: '1px dashed var(--rule)',
              paddingTop: '2rem',
            }}
          >
            {[
              { label: 'No App to Download', icon: '📱' },
              { label: '2-Minute Setup', icon: '⏱️' },
              { label: 'Updates on WhatsApp', icon: '💬' },
            ].map((item) => (
               <div
                key={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: 'var(--muted)',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        style={{ padding: '4rem 1rem', maxWidth: '1000px', margin: '0 auto', borderBottom: '1px solid var(--rule)' }}
      >
        <h2
          style={{
            textAlign: 'center',
            fontSize: '1.75rem',
            fontWeight: 800,
            marginBottom: '0.5rem',
            color: 'var(--ink)'
          }}
        >
          Why Counter Shops Prefer LoyaltyQR
        </h2>
        <p
          style={{
            textAlign: 'center',
            color: 'var(--muted)',
            marginBottom: '3rem',
          }}
        >
          Simple tools that work fast at the billing counter.
        </p>

        <div className="grid-3">
          {[
            {
              icon: '🛡️',
              title: 'Secure QR System',
              desc: 'Each QR is single-use and time-limited. Customers cannot scan old receipts or cheat the system.',
            },
            {
              icon: '📲',
              title: 'Zero Friction',
              desc: 'Customers simply scan with their phone camera. No apps, no accounts, just instant tracking.',
            },
            {
              icon: '💬',
              title: 'WhatsApp Automation',
              desc: 'Send progress updates, milestone celebrations, and expiry reminders directly to their WhatsApp.',
            },
          ].map((feature) => (
            <div key={feature.title} className="card" style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: '2.5rem',
                  marginBottom: '1rem',
                }}
              >
                {feature.icon}
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--ink)' }}>
                {feature.title}
              </h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: '4rem 1rem', maxWidth: '800px', margin: '0 auto', borderBottom: '1px solid var(--rule)' }}>
        <h2
          style={{
            textAlign: 'center',
            fontSize: '1.75rem',
            fontWeight: 800,
            marginBottom: '3rem',
            color: 'var(--ink)'
          }}
        >
          How It Works at the Counter
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {[
            {
              step: '1',
              title: 'Configure Your Offer',
              desc: '"Spend ₹10,000 in 30 days → free item" or give straight Cashback Points.',
              icon: '⚙️',
            },
            {
              step: '2',
              title: 'Customer Scans QR',
              desc: 'You generate a QR for the bill amount. Customer scans it with their phone camera.',
              icon: '📸',
            },
            {
              step: '3',
              title: 'Instant Update',
              desc: 'Customer receives a WhatsApp message showing their new balance and progress.',
              icon: '💬',
            },
            {
              step: '4',
              title: 'Reward & Retain',
              desc: 'When they hit the target, they get a claim code to show you for their reward.',
              icon: '🎁',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="card"
              style={{
                display: 'flex',
                gap: '1.25rem',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  minWidth: '48px',
                  height: '48px',
                  border: '1.5px solid var(--rule)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  flexShrink: 0,
                  background: 'var(--surface)',
                }}
              >
                {item.icon}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Step {item.step}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--ink)' }}>
                  {item.title}
                </h3>
                <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: '4rem 1rem', maxWidth: '1000px', margin: '0 auto', borderBottom: '1px solid var(--rule)' }}>
        <h2
          style={{
            textAlign: 'center',
            fontSize: '1.75rem',
            fontWeight: 800,
            marginBottom: '0.5rem',
            color: 'var(--ink)'
          }}
        >
          Straightforward Pricing
        </h2>
        <p
          style={{
            textAlign: 'center',
            color: 'var(--muted)',
            marginBottom: '3rem',
          }}
        >
          Simple plans based on the size of your customer base.
        </p>

        <div className="grid-3">
          {/* Growth Plan */}
          <div className="card">
            <div style={{ textAlign: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--rule)' }}>
              <h3 style={{ fontWeight: 800, fontSize: '1.25rem', marginBottom: '0.25rem' }}>Basic Ledger</h3>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '0.25rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--charcoal)' }}>₹999</span>
                <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>/mo</span>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>Up to 1,000 customers</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.9rem' }}>
              {[
                'QR transactions',
                'WhatsApp updates',
                'Basic analytics',
              ].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--muted)' }}>
                  <span>✓</span> {f}
                </div>
              ))}
            </div>
          </div>

          {/* Business Plan */}
          <div className="card" style={{ border: '2px solid var(--ink)', transform: 'scale(1.02)' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--rule)' }}>
              <div className="badge badge-success" style={{ marginBottom: '0.5rem' }}>Most Popular</div>
              <h3 style={{ fontWeight: 800, fontSize: '1.25rem', marginBottom: '0.25rem', color: 'var(--ink)' }}>Business Ledger</h3>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '0.25rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--charcoal)' }}>₹1,499</span>
                <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>/mo</span>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>Up to 2,000 customers</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.9rem' }}>
              {[
                'Everything in Basic',
                'Advanced analytics',
                'Expiry reminders',
              ].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--charcoal)', fontWeight: 500 }}>
                  <span>✓</span> {f}
                </div>
              ))}
            </div>
          </div>

          {/* Pro Plan */}
          <div className="card">
            <div style={{ textAlign: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--rule)' }}>
              <h3 style={{ fontWeight: 800, fontSize: '1.25rem', marginBottom: '0.25rem' }}>Pro Ledger</h3>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '0.25rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--charcoal)' }}>₹2,499</span>
                <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>/mo</span>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>Up to 5,000 customers</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.9rem' }}>
              {[
                'Everything in Business',
                'Broadcast messaging',
                'Priority support',
              ].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--muted)' }}>
                  <span>✓</span> {f}
                </div>
              ))}
            </div>
          </div>
        </div>

      </section>

      {/* CTA */}
      <section
        style={{
          padding: '4rem 1rem',
          textAlign: 'center',
        }}
      >
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--ink)' }}>
          Ready to Start Your Digital Ledger?
        </h2>
        <p style={{ color: 'var(--muted)', marginBottom: '2rem' }}>
          Set up your shop in minutes and start logging visits.
        </p>
        <Link href="/merchant/login" className="btn btn-primary btn-lg">
          Get Started Now →
        </Link>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: '2rem 1rem',
          textAlign: 'center',
          borderTop: '1px solid var(--rule)',
          color: 'var(--muted)',
          fontSize: '0.85rem',
        }}
      >
        <span className="nav-brand" style={{ fontSize: '1rem', marginBottom: '0.5rem', display: 'block', color: 'var(--ink)' }}>
          LoyaltyQR
        </span>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '0.5rem' }}>
          <Link href="/terms" style={{ color: 'var(--muted)', textDecoration: 'underline' }}>Terms</Link>
          <span style={{ color: 'var(--rule)' }}>|</span>
          <Link href="/privacy" style={{ color: 'var(--muted)', textDecoration: 'underline' }}>Privacy</Link>
          <span style={{ color: 'var(--rule)' }}>|</span>
          <Link href="/contact" style={{ color: 'var(--muted)', textDecoration: 'underline' }}>Contact</Link>
        </div>
        © 2026 LoyaltyQR.
      </footer>
    </div>
  );
}
