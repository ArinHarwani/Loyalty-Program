'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import type { Merchant } from '@/types';

export default function NewCampaignPage() {
  const router = useRouter();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [campaignType, setCampaignType] = useState<'amount' | 'visits'>('amount');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetVisits, setTargetVisits] = useState('');
  const [durationDays, setDurationDays] = useState<number>(30);
  const [rewardDescription, setRewardDescription] = useState('');
  const [maxWinners, setMaxWinners] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        supabase
          .from('merchants')
          .select('*')
          .eq('email', user.email)
          .single()
          .then(({ data }) => {
            if (data) setMerchant(data);
            else router.push('/merchant/onboarding');
          });
      }
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchant) return;

    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from('campaigns').insert({
        merchant_id: merchant.id,
        name,
        campaign_type: campaignType,
        target_amount: campaignType === 'amount' ? Number(targetAmount) : null,
        target_visits: campaignType === 'visits' ? Number(targetVisits) : null,
        duration_days: durationDays,
        reward_description: rewardDescription,
        max_winners: maxWinners ? Number(maxWinners) : null,
      });

      if (insertError) {
        setError(insertError.message);
      } else {
        router.push('/merchant/dashboard');
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
        <Link href="/merchant/dashboard" className="nav-brand">← Back</Link>
      </nav>

      <div className="container-md" style={{ padding: '1.5rem 1rem' }}>
        <h1 className="page-title" style={{ marginBottom: '0.25rem' }}>Create Campaign</h1>
        <p className="page-subtitle" style={{ marginBottom: '2rem' }}>
          Set up your loyalty program for {merchant?.shop_name}
        </p>

        <form onSubmit={handleSubmit}>
          {/* Campaign Name */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <label className="label">Campaign Name</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Summer Loyalty Special"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              id="campaign-name"
            />
          </div>

          {/* Campaign Type Toggle */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <label className="label">Campaign Type</label>
            <div className="toggle-group">
              <button
                type="button"
                className={`toggle-btn ${campaignType === 'amount' ? 'active' : ''}`}
                onClick={() => setCampaignType('amount')}
              >
                💰 Amount
              </button>
              <button
                type="button"
                className={`toggle-btn ${campaignType === 'visits' ? 'active' : ''}`}
                onClick={() => setCampaignType('visits')}
              >
                🏃 Visits
              </button>
            </div>
          </div>

          {/* Target */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <label className="label">
              {campaignType === 'amount' ? 'Target Amount (₹)' : 'Target Visits'}
            </label>
            {campaignType === 'amount' ? (
              <input
                type="number"
                className="input"
                placeholder="e.g. 10000"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                required
                min="100"
                id="target-input"
              />
            ) : (
              <input
                type="number"
                className="input"
                placeholder="e.g. 10"
                value={targetVisits}
                onChange={(e) => setTargetVisits(e.target.value)}
                required
                min="2"
                id="target-input"
              />
            )}
          </div>

          {/* Duration */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <label className="label">Duration</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {[15, 30, 45, 60].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`btn ${durationDays === d ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setDurationDays(d)}
                  style={{ padding: '0.75rem' }}
                >
                  {d} days
                </button>
              ))}
            </div>
          </div>

          {/* Reward */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <label className="label">Reward Description</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Free 500g Kaju Katli Box"
              value={rewardDescription}
              onChange={(e) => setRewardDescription(e.target.value)}
              required
              id="reward-input"
            />
          </div>

          {/* Max Winners */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <label className="label">Max Winners (optional)</label>
            <input
              type="number"
              className="input"
              placeholder="Leave empty for unlimited"
              value={maxWinners}
              onChange={(e) => setMaxWinners(e.target.value)}
              min="1"
              id="max-winners-input"
            />
          </div>

          {/* Preview Card */}
          <div className="card" style={{
            marginBottom: '1.5rem',
            borderColor: 'rgba(16, 185, 129, 0.3)',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(59, 130, 246, 0.05))',
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
              📱 Live Preview
            </div>
            <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>
              {name || 'Campaign Name'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              {campaignType === 'amount'
                ? `Spend ${targetAmount ? formatCurrency(Number(targetAmount)) : '₹___'} in ${durationDays} days`
                : `Visit ${targetVisits || '___'} times in ${durationDays} days`}
            </p>
            <p style={{ fontSize: '0.9rem' }}>
              🎁 {rewardDescription || 'Reward description'}
            </p>
            {maxWinners && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                Limited to {maxWinners} winners
              </p>
            )}
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading || !name || !rewardDescription || (campaignType === 'amount' ? !targetAmount : !targetVisits)}
            id="create-campaign-btn"
          >
            {loading ? (
              <>
                <span className="spinner" /> Creating...
              </>
            ) : (
              '🚀 Launch Campaign'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
