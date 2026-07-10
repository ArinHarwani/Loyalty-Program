'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import type { PointsConfig } from '@/types';

export default function PointsSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [cashbackPercentage, setCashbackPercentage] = useState('5');
  const [conversionRate, setConversionRate] = useState('1');
  const [minBillAmount, setMinBillAmount] = useState('0');
  const [minRedeemPoints, setMinRedeemPoints] = useState('0');
  const [expiryMonths, setExpiryMonths] = useState('');

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/merchant/points/config');
        if (response.ok) {
          const data = await response.json();
          if (data.config) {
            setCashbackPercentage(data.config.cashback_percentage.toString());
            setConversionRate(data.config.conversion_rate.toString());
            setMinBillAmount(data.config.min_bill_amount?.toString() || '0');
            setMinRedeemPoints(data.config.min_redeem_points?.toString() || '0');
            setExpiryMonths(data.config.expiry_months?.toString() || '');
          }
        }
      } catch (err) {
        console.error('Failed to fetch config', err);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/merchant/points/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashback_percentage: Number(cashbackPercentage),
          conversion_rate: Number(conversionRate),
          min_bill_amount: Number(minBillAmount),
          min_redeem_points: Number(minRedeemPoints),
          expiry_months: expiryMonths ? Number(expiryMonths) : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save config');
      }

      setSuccess('Points program configured successfully!');
      setTimeout(() => router.push('/merchant/dashboard'), 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <nav className="nav">
          <Link href="/merchant/dashboard" className="nav-brand">← Back</Link>
        </nav>
        <div className="container-md" style={{ padding: '2rem 1rem', textAlign: 'center' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <nav className="nav">
        <Link href="/merchant/dashboard" className="nav-brand">← Back</Link>
      </nav>

      <div className="container-md" style={{ padding: '1.5rem 1rem' }}>
        <h1 className="page-title" style={{ marginBottom: '0.25rem' }}>Points Setup</h1>
        <p className="page-subtitle" style={{ marginBottom: '2rem' }}>
          Configure your cashback rules and conversion rates
        </p>

        <form onSubmit={handleSubmit}>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Earning Points</h2>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="label">Cashback Percentage (%)</label>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                How much of the bill amount should be given back as points? (e.g. 5%)
              </p>
              <input
                type="number"
                min="0.1"
                step="0.1"
                max="100"
                className="input"
                value={cashbackPercentage}
                onChange={(e) => setCashbackPercentage(e.target.value)}
                required
              />
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--brand)', background: 'rgba(59, 130, 246, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>
                Example: A ₹1,000 bill at {cashbackPercentage}% cashback earns {Math.floor(1000 * (Number(cashbackPercentage) / 100))} points.
              </div>
            </div>

            <div>
              <label className="label">Minimum Bill Amount (₹) (Optional)</label>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Minimum purchase required to earn any points. Leave as 0 for no minimum.
              </p>
              <input
                type="number"
                min="0"
                className="input"
                value={minBillAmount}
                onChange={(e) => setMinBillAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="card" style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Redeeming Points</h2>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="label">Conversion Rate (₹ per point)</label>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                How much is 1 point worth in Rupees? (Default: ₹1)
              </p>
              <input
                type="number"
                min="0.01"
                step="0.01"
                className="input"
                value={conversionRate}
                onChange={(e) => setConversionRate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label">Minimum Points to Redeem (Optional)</label>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Customer must have at least this many points to redeem.
              </p>
              <input
                type="number"
                min="0"
                className="input"
                value={minRedeemPoints}
                onChange={(e) => setMinRedeemPoints(e.target.value)}
              />
            </div>
          </div>

          <div className="card" style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Points Expiry</h2>
            
            <div>
              <label className="label">Points Validity Duration</label>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                How long are points valid for after they are earned or redeemed?
              </p>
              <select
                className="input"
                value={expiryMonths}
                onChange={(e) => setExpiryMonths(e.target.value)}
                style={{ appearance: 'auto' }}
              >
                <option value="">Never Expire</option>
                <option value="3">3 Months</option>
                <option value="6">6 Months</option>
                <option value="12">12 Months (1 Year)</option>
              </select>
            </div>
          </div>

          {error && (
            <div style={{ 
              background: '#fee2e2', 
              color: '#991b1b', 
              padding: '1rem', 
              borderRadius: '8px', 
              marginBottom: '1rem',
              fontSize: '0.9rem'
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ 
              background: '#dcfce7', 
              color: '#166534', 
              padding: '1rem', 
              borderRadius: '8px', 
              marginBottom: '1rem',
              fontSize: '0.9rem'
            }}>
              {success}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </form>
      </div>
    </div>
  );
}
