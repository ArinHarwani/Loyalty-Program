'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import type { Merchant } from '@/types';

type DurationMode = 'preset' | 'specific';

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
  const [durationMode, setDurationMode] = useState<DurationMode>('preset');
  const [durationDays, setDurationDays] = useState<number>(30);
  const [endDate, setEndDate] = useState('');
  
  // Rolling Window States
  const [windowMode, setWindowMode] = useState<'fixed' | 'rolling'>('fixed');
  const [windowDurationDays, setWindowDurationDays] = useState<string>('30');
  
  const [rewardDescription, setRewardDescription] = useState('');
  const [maxWinners, setMaxWinners] = useState('');

  // Compute min date for the date picker (tomorrow)
  const minDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  })();

  const [now, setNow] = useState<number>(0);
  useEffect(() => { 
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now()); 
  }, []);

  // Calculate how many days the specific end date represents (for preview)
  const computedDurationDays = durationMode === 'specific' && endDate && now > 0
    ? Math.ceil((new Date(endDate).getTime() - now) / (1000 * 60 * 60 * 24))
    : durationDays;

  // Format end date for preview display (only applies to fixed mode)
  const previewEndDate = durationMode === 'specific' && endDate
    ? new Date(endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : (() => {
        const d = new Date();
        d.setDate(d.getDate() + durationDays);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      })();

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

    // Validate inputs
    if (windowMode === 'fixed' && durationMode === 'specific') {
      if (!endDate) {
        setError('Please select an offer end date.');
        return;
      }
      if (new Date(endDate) <= new Date()) {
        setError('Offer end date must be in the future.');
        return;
      }
    }

    if (windowMode === 'rolling') {
      if (!windowDurationDays || Number(windowDurationDays) <= 0) {
        setError('Please enter a valid window duration in days.');
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const payload: Record<string, unknown> = {
        merchant_id: merchant.id,
        name,
        campaign_type: campaignType,
        target_amount: campaignType === 'amount' ? Number(targetAmount) : null,
        target_visits: campaignType === 'visits' ? Number(targetVisits) : null,
        reward_description: rewardDescription,
        max_winners: maxWinners ? Number(maxWinners) : null,
        window_mode: windowMode,
      };

      if (windowMode === 'fixed') {
        if (durationMode === 'preset') {
          payload.duration_days = durationDays;
        } else {
          payload.end_date = endDate;
          payload.duration_days = Math.max(1, computedDurationDays);
        }
      } else {
        // rolling mode
        payload.window_duration_days = Number(windowDurationDays);
        payload.duration_days = Number(windowDurationDays); // fallback for legacy code
      }

      const { error: insertError } = await supabase.from('campaigns').insert(payload);

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

          {/* Offer Duration */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <label className="label">Campaign Deadline Type</label>

            <div className="toggle-group" style={{ marginBottom: '1.5rem' }}>
              <button
                type="button"
                className={`toggle-btn ${windowMode === 'fixed' ? 'active' : ''}`}
                onClick={() => setWindowMode('fixed')}
              >
                📅 Fixed Deadline
              </button>
              <button
                type="button"
                className={`toggle-btn ${windowMode === 'rolling' ? 'active' : ''}`}
                onClick={() => setWindowMode('rolling')}
              >
                🔄 Rolling Window
              </button>
            </div>

            {windowMode === 'fixed' && (
              <>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  All customers must complete the goal by the same end date.
                </p>
                {/* Mode switcher */}
                <div className="toggle-group" style={{ marginBottom: '1rem' }}>
                  <button
                    type="button"
                    className={`toggle-btn ${durationMode === 'preset' ? 'active' : ''}`}
                    onClick={() => setDurationMode('preset')}
                    id="duration-preset-btn"
                  >
                    ⏱ Quick Select
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${durationMode === 'specific' ? 'active' : ''}`}
                    onClick={() => setDurationMode('specific')}
                    id="duration-date-btn"
                  >
                    📅 Pick End Date
                  </button>
                </div>

                {durationMode === 'preset' && (
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
                )}

                {durationMode === 'specific' && (
                  <div>
                    <input
                      type="date"
                      className="input"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={minDate}
                      required={durationMode === 'specific'}
                      id="end-date-input"
                      style={{ cursor: 'pointer' }}
                    />
                    {endDate && computedDurationDays > 0 && (
                      <p style={{
                        color: 'var(--primary)',
                        fontSize: '0.85rem',
                        marginTop: '0.5rem',
                        fontWeight: 600,
                      }}>
                        ✓ Offer runs for {computedDurationDays} day{computedDurationDays !== 1 ? 's' : ''} — ends {previewEndDate}
                      </p>
                    )}
                    {endDate && computedDurationDays <= 0 && (
                      <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                        ⚠️ End date must be in the future
                      </p>
                    )}
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                      All customers enrolling in this campaign will have until this date to complete the offer
                    </p>
                  </div>
                )}
              </>
            )}

            {windowMode === 'rolling' && (
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  Each customer gets their own deadline starting from their first scan.
                </p>
                <label className="label">Days to complete (per customer)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="number"
                    className="input"
                    value={windowDurationDays}
                    onChange={(e) => setWindowDurationDays(e.target.value)}
                    min="1"
                    required
                  />
                  <span>days</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  Example: If 30 days, a customer who first scans on Jan 1st has until Jan 31st to complete the goal. A customer who scans on Jan 10th has until Feb 9th.
                </p>
              </div>
            )}
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
                ? `Spend ${targetAmount ? formatCurrency(Number(targetAmount)) : '₹___'} in `
                : `Visit ${targetVisits || '___'} times in `}
              {windowMode === 'fixed' ? computedDurationDays : (windowDurationDays || '___')} days
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              {windowMode === 'fixed' ? (
                <>📅 Offer ends: <strong>{previewEndDate}</strong></>
              ) : (
                <>🔄 Deadline: <strong>{windowDurationDays || 'X'} days from first scan</strong></>
              )}
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
            disabled={
              loading ||
              !name ||
              !rewardDescription ||
              (campaignType === 'amount' ? !targetAmount : !targetVisits) ||
              (windowMode === 'fixed' && durationMode === 'specific' && (!endDate || computedDurationDays <= 0)) ||
              (windowMode === 'rolling' && (!windowDurationDays || Number(windowDurationDays) <= 0))
            }
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
