'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';

export default function MerchantLoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/merchant/dashboard`,
        },
      });

      if (authError) {
        setError(authError.message);
      } else {
        setSent(true);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <nav className="nav">
        <Link href="/" className="nav-brand">LoyaltyQR</Link>
      </nav>

      <div className="container-sm" style={{ paddingTop: '4rem' }}>
        <div className="card slide-up" style={{ padding: '2.5rem' }}>
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                Check Your Email
              </h1>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                We sent a magic link to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
                <br />Click the link to sign in.
              </p>
              <div className="alert alert-info" style={{ justifyContent: 'center' }}>
                💡 Check your spam folder if you don&apos;t see it
              </div>
              <button
                onClick={() => { setSent(false); setEmail(''); }}
                className="btn btn-secondary"
                style={{ marginTop: '1.5rem' }}
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔐</div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>
                  Merchant Login
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                  Sign in with your email — no password needed
                </p>
              </div>

              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="label">Email Address</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="yourshop@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    id="email-input"
                  />
                </div>

                {error && (
                  <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
                    ⚠️ {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary btn-full btn-lg"
                  disabled={loading || !email}
                  id="send-magic-link"
                >
                  {loading ? (
                    <>
                      <span className="spinner" /> Sending...
                    </>
                  ) : (
                    '✨ Send Magic Link'
                  )}
                </button>
              </form>

              <p
                style={{
                  textAlign: 'center',
                  marginTop: '1.5rem',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                }}
              >
                First time? You&apos;ll be taken to set up your shop after signing in.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
