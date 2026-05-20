'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function MerchantSignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !confirmPassword) return;

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
      } else {
        // Successful signup, redirect to onboarding to set up shop details
        router.push('/merchant/onboarding');
      }
    } catch {
      setError('Something went wrong. Please try again.');
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
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✨</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>
              Create Merchant Account
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Start your loyalty program today
            </p>
          </div>

          <form onSubmit={handleSignup}>
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

            <div style={{ marginBottom: '1.25rem' }}>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="label">Confirm Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
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
              disabled={loading || !email || !password || !confirmPassword}
            >
              {loading ? (
                <>
                  <span className="spinner" /> Creating Account...
                </>
              ) : (
                'Sign Up'
              )}
            </button>
          </form>

          <p
            style={{
              textAlign: 'center',
              marginTop: '1.5rem',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
            }}
          >
            Already have an account?{' '}
            <Link href="/merchant/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
