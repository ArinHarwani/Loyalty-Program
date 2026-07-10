'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function MerchantLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotMessage, setShowForgotMessage] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
      } else {
        // Successful login, redirect to dashboard
        router.push('/merchant/dashboard');
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <nav className="nav">
        <Link href="/" className="nav-brand">LoyaltyQR</Link>
      </nav>

      <div className="container-sm" style={{ paddingTop: '4rem' }}>
        <div className="card slide-up" style={{ padding: '2.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔐</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>
              Merchant Login
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Welcome back to your dashboard
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
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="label" style={{ marginBottom: 0 }}>Password</label>
                <button 
                  type="button" 
                  onClick={() => setShowForgotMessage(true)}
                style={{ background: 'none', border: 'none', color: 'var(--ink)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600, padding: 0, fontFamily: 'inherit' }}
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ marginTop: '0.5rem' }}
              />
            </div>

            {showForgotMessage && (
              <div className="alert alert-warning" style={{ marginBottom: '1.25rem' }}>
                ℹ️ Please contact the team for changing password.
              </div>
            )}

            {error && (
              <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading || !email || !password}
            >
              {loading ? (
                <>
                  <span className="spinner" /> Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', marginTop: '1.25rem', lineHeight: '1.4' }}>
              By signing in, you agree to our{' '}
              <Link href="/terms" target="_blank" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>
                Terms of Use
              </Link>{' '}
              and{' '}
              <Link href="/privacy" target="_blank" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>
                Privacy Policy
              </Link>.
            </p>
          </form>

          <p
            style={{
              textAlign: 'center',
              marginTop: '1.5rem',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
            }}
          >
            Don&apos;t have an account?{' '}
            <Link href="/merchant/signup" style={{ color: 'var(--ink)', fontWeight: 600, textDecoration: 'none' }}>
              Sign up here
            </Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer
        style={{
          padding: '2rem 1rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          marginTop: '4rem',
          borderTop: '1px solid var(--border)',
        }}
      >
        <span className="nav-brand" style={{ fontSize: '1rem', marginBottom: '0.5rem', display: 'block' }}>
          LoyaltyQR
        </span>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '0.5rem' }}>
          <Link href="/terms" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Terms of Use</Link>
          <span style={{ color: 'var(--border)' }}>|</span>
          <Link href="/privacy" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Privacy Policy</Link>
        </div>
        © 2026 LoyaltyQR. Built for Indian businesses with ❤️
      </footer>
    </div>
  );
}
