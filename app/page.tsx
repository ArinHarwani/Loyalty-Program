'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const handle = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(handle);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Nav */}
      <nav className="nav">
        <span className="nav-brand">LoyaltyQR</span>
        <Link href="/merchant/login" className="btn btn-primary btn-sm">
          Get Started
        </Link>
      </nav>

      {/* Hero */}
      <section
        style={{
          padding: '5rem 1rem 4rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: 'absolute',
            top: '-200px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '800px',
            height: '800px',
            background:
              'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div
          className={mounted ? 'slide-up' : ''}
          style={{
            position: 'relative',
            maxWidth: '700px',
            margin: '0 auto',
            opacity: mounted ? 1 : 0,
          }}
        >
          <div
            className="badge badge-success"
            style={{ marginBottom: '1.5rem', display: 'inline-flex' }}
          >
            🇮🇳 Made for Indian Businesses
          </div>

          <h1
            style={{
              fontSize: 'clamp(2rem, 5vw, 3.25rem)',
              fontWeight: 900,
              lineHeight: 1.15,
              marginBottom: '1.25rem',
              letterSpacing: '-0.02em',
            }}
          >
            Digital Loyalty Cards{' '}
            <span
              style={{
                background: 'var(--gradient-primary)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              for Your Shop
            </span>
          </h1>

          <p
            style={{
              fontSize: '1.15rem',
              color: 'var(--text-secondary)',
              maxWidth: '520px',
              margin: '0 auto 2rem',
              lineHeight: 1.7,
            }}
          >
            Replace punch cards with anti-cheat QR codes. Track customer visits
            and spending. Reward loyal customers — all via WhatsApp.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/merchant/login" className="btn btn-primary btn-lg pulse-glow">
              🚀 Get Started
            </Link>
            <a href="#features" className="btn btn-secondary btn-lg">
              See How It Works
            </a>
          </div>

          {/* Trust badges */}
          <div
            style={{
              display: 'flex',
              gap: '2rem',
              justifyContent: 'center',
              marginTop: '3rem',
              flexWrap: 'wrap',
            }}
          >
            {[
              { label: 'No App Download', icon: '📱' },
              { label: 'Quick Setup', icon: '⚡' },
              { label: 'WhatsApp Updates', icon: '💬' },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: 'var(--text-muted)',
                  fontSize: '0.9rem',
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
        style={{ padding: '4rem 1rem', maxWidth: '1000px', margin: '0 auto' }}
      >
        <h2
          style={{
            textAlign: 'center',
            fontSize: '1.75rem',
            fontWeight: 800,
            marginBottom: '0.5rem',
          }}
        >
          Why Shops Love LoyaltyQR
        </h2>
        <p
          style={{
            textAlign: 'center',
            color: 'var(--text-secondary)',
            marginBottom: '3rem',
          }}
        >
          Everything you need to build customer loyalty, nothing you don&apos;t.
        </p>

        <div className="grid-3">
          {[
            {
              icon: '🔒',
              title: 'Anti-Cheat QR Codes',
              desc: 'Each QR is unique, time-limited, and single-use. No duplicate scans. No fake stamps. Just real loyalty.',
              color: 'var(--primary)',
            },
            {
              icon: '📲',
              title: 'No App Download',
              desc: 'Customers just scan with their phone camera. No app installs, no sign-ups, no friction. Works instantly.',
              color: 'var(--accent)',
            },
            {
              icon: '💬',
              title: 'WhatsApp Updates',
              desc: 'Every transaction, every milestone — customers get instant WhatsApp updates. Birthday wishes too!',
              color: '#25D366',
            },
          ].map((feature) => (
            <div key={feature.title} className="card" style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: 'var(--radius-lg)',
                  background: `${feature.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.75rem',
                  margin: '0 auto 1rem',
                  border: `1px solid ${feature.color}30`,
                }}
              >
                {feature.icon}
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                {feature.title}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: '4rem 1rem', maxWidth: '800px', margin: '0 auto' }}>
        <h2
          style={{
            textAlign: 'center',
            fontSize: '1.75rem',
            fontWeight: 800,
            marginBottom: '3rem',
          }}
        >
          How It Works
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {[
            {
              step: '01',
              title: 'Set Your Campaign',
              desc: '"Spend ₹10,000 in 30 days → free gift" or "Visit 10 times → free shake"',
              icon: '🎯',
            },
            {
              step: '02',
              title: 'Customer Scans QR at Billing',
              desc: 'You generate a QR on your phone. Customer scans. Amount gets logged automatically.',
              icon: '📸',
            },
            {
              step: '03',
              title: 'Progress via WhatsApp',
              desc: 'Customer gets instant WhatsApp update with progress, days remaining, and percentage.',
              icon: '📊',
            },
            {
              step: '04',
              title: 'Goal Achieved → Reward!',
              desc: 'When the target is hit, customer gets a unique claim code on WhatsApp. You verify and reward.',
              icon: '🎉',
            },
          ].map((item, i) => (
            <div
              key={item.step}
              className="card"
              style={{
                display: 'flex',
                gap: '1.25rem',
                alignItems: 'flex-start',
                animationDelay: `${i * 0.1}s`,
              }}
            >
              <div
                style={{
                  minWidth: '48px',
                  height: '48px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--gradient-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                    STEP {item.step}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                  {item.title}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Campaign types */}
      <section style={{ padding: '4rem 1rem', maxWidth: '800px', margin: '0 auto' }}>
        <h2
          style={{
            textAlign: 'center',
            fontSize: '1.75rem',
            fontWeight: 800,
            marginBottom: '2rem',
          }}
        >
          Two Campaign Types
        </h2>

        <div className="grid-2">
          <div className="card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>💰</div>
            <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Amount Milestone</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              &quot;Spend ₹10,000 at our shop within 30 days → get a free gift&quot;
            </p>
            <div className="badge badge-success">Best for: Restaurants, Sweet Shops</div>
          </div>

          <div className="card" style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🏃</div>
            <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Visit Milestone</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              &quot;Visit 10 times within 30 days → get a free shake&quot;
            </p>
            <div className="badge badge-info">Best for: Salons, Juice Stalls, Cafes</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          padding: '4rem 1rem',
          textAlign: 'center',
          borderTop: '1px solid var(--border)',
        }}
      >
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.75rem' }}>
          Ready to Reward Your Customers?
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Set up your campaign in minutes and start rewarding.
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
          borderTop: '1px solid var(--border)',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
        }}
      >
        <span className="nav-brand" style={{ fontSize: '1rem', marginBottom: '0.5rem', display: 'block' }}>
          LoyaltyQR
        </span>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '0.5rem' }}>
          <Link href="/terms" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Terms of Use</Link>
          <span style={{ color: 'var(--border)' }}>|</span>
          <Link href="/privacy" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Privacy Policy</Link>
          <span style={{ color: 'var(--border)' }}>|</span>
          <Link href="/contact" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Contact Us</Link>
        </div>
        © 2026 LoyaltyQR. Built for Indian businesses with ❤️
      </footer>
    </div>
  );
}
