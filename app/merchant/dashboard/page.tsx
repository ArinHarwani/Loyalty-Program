'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { formatCurrency, maskPhone, calcPercentage, daysRemaining, formatDateTime } from '@/lib/utils';
import Link from 'next/link';
import type { Merchant, Campaign, Enrollment, Transaction, Customer } from '@/types';

export default function DashboardPage() {
  const router = useRouter();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [enrollments, setEnrollments] = useState<(Enrollment & { customer?: Customer })[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [winners, setWinners] = useState<(Enrollment & { customer?: Customer })[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      router.push('/merchant/login');
      return;
    }

    // Get merchant
    const { data: merchantData } = await supabase
      .from('merchants')
      .select('*')
      .eq('email', user.email)
      .single();

    if (!merchantData) {
      router.push('/merchant/onboarding');
      return;
    }
    setMerchant(merchantData);

    // Get active campaign
    const { data: campaignData } = await supabase
      .from('campaigns')
      .select('*')
      .eq('merchant_id', merchantData.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    setCampaign(campaignData);

    if (campaignData) {
      // Get enrollments with customers
      const { data: enrollmentData } = await supabase
        .from('enrollments')
        .select('*, customer:customers(*)')
        .eq('campaign_id', campaignData.id)
        .eq('merchant_id', merchantData.id)
        .order('enrolled_at', { ascending: false });

      setEnrollments(enrollmentData || []);

      // Get winners pending claim
      const pendingWinners = (enrollmentData || []).filter(
        (e: Enrollment) => e.status === 'completed' && !e.claimed
      );
      setWinners(pendingWinners);

      // Get recent transactions
      const { data: txnData } = await supabase
        .from('transactions')
        .select('*')
        .eq('merchant_id', merchantData.id)
        .order('scanned_at', { ascending: false })
        .limit(10);

      setTransactions(txnData || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClaim = async (enrollmentId: string) => {
    const supabase = createClient();
    await supabase
      .from('enrollments')
      .update({ claimed: true })
      .eq('id', enrollmentId);
    loadData();
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Nav */}
      <nav className="nav">
        <Link href="/merchant/dashboard" className="nav-brand">LoyaltyQR</Link>
        <div className="nav-links">
          <Link href="/merchant/analytics" className="nav-link">📊 Analytics</Link>
          <button onClick={handleLogout} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            Logout
          </button>
        </div>
      </nav>

      <div className="container" style={{ padding: '1.5rem 1rem' }}>
        {/* Shop header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 className="page-title">{merchant?.shop_name}</h1>
          <p className="page-subtitle">
            {merchant?.shop_category} • Code: <strong>{merchant?.merchant_code}</strong>
          </p>
        </div>

        {/* Primary CTA */}
        <Link
          href="/merchant/transaction"
          className="btn btn-primary btn-lg btn-full pulse-glow"
          style={{ marginBottom: '1.5rem', fontSize: '1.15rem', padding: '1.1rem' }}
          id="new-transaction-btn"
        >
          💳 New Transaction
        </Link>

        {/* Campaign Card */}
        {campaign ? (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <div className="badge badge-success" style={{ marginBottom: '0.5rem' }}>Active Campaign</div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{campaign.name}</h2>
              </div>
              <span style={{ fontSize: '1.5rem' }}>
                {campaign.campaign_type === 'amount' ? '💰' : '🏃'}
              </span>
            </div>

            <div className="grid-3" style={{ marginBottom: '1rem' }}>
              <div className="stat-card card-static">
                <div className="stat-value" style={{ color: 'var(--primary)' }}>
                  {enrollments.length}
                </div>
                <div className="stat-label">Customers</div>
              </div>
              <div className="stat-card card-static">
                <div className="stat-value" style={{ color: 'var(--accent)' }}>
                  {enrollments.filter((e) => e.status === 'completed').length}
                </div>
                <div className="stat-label">Completed</div>
              </div>
              <div className="stat-card card-static">
                <div className="stat-value" style={{ color: 'var(--warning)' }}>
                  {campaign.campaign_type === 'amount'
                    ? formatCurrency(campaign.target_amount || 0)
                    : `${campaign.target_visits} visits`}
                </div>
                <div className="stat-label">Target</div>
              </div>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              🎁 Reward: <strong style={{ color: 'var(--text-primary)' }}>{campaign.reward_description}</strong>
              {' • '}{campaign.duration_days} day campaign
            </p>
          </div>
        ) : (
          <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center', padding: '3rem' }}>
            <div className="empty-state-icon">🎯</div>
            <h3 className="empty-state-title">No Active Campaign</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Create your first loyalty campaign to start tracking customers
            </p>
            <Link href="/merchant/campaign/new" className="btn btn-primary">
              + Create Campaign
            </Link>
          </div>
        )}

        {/* Winners Pending Claim */}
        {winners.length > 0 && (
          <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🏆 Winners Pending Claim ({winners.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {winners.map((w) => (
                <div
                  key={w.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600 }}>
                      {maskPhone(w.customer?.whatsapp_number || '')}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: '0.75rem' }}>
                      Code: <strong>{w.claim_code}</strong>
                    </span>
                  </div>
                  <button
                    onClick={() => handleClaim(w.id)}
                    className="btn btn-primary btn-sm"
                    id={`claim-btn-${w.id}`}
                  >
                    ✅ Mark Claimed
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Customer Progress */}
        {enrollments.length > 0 && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
              👥 Customer Progress
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {enrollments.slice(0, 10).map((enrollment) => {
                const target = campaign?.campaign_type === 'amount'
                  ? campaign.target_amount || 0
                  : campaign?.target_visits || 0;
                const current = campaign?.campaign_type === 'amount'
                  ? enrollment.total_spent
                  : enrollment.total_visits;
                const pct = calcPercentage(current, target);
                const days = daysRemaining(enrollment.deadline_at);

                return (
                  <div
                    key={enrollment.id}
                    style={{
                      padding: '0.75rem',
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        {maskPhone(enrollment.customer?.whatsapp_number || '')}
                      </span>
                      <span className={`badge ${enrollment.status === 'completed' ? 'badge-success' : enrollment.status === 'expired' ? 'badge-danger' : 'badge-info'}`}>
                        {enrollment.status === 'completed' ? '✅ Done' : enrollment.status === 'expired' ? 'Expired' : `${days}d left`}
                      </span>
                    </div>
                    <div className="progress-bar" style={{ height: '8px', marginBottom: '0.25rem' }}>
                      <div
                        className="progress-fill"
                        style={{
                          width: `${pct}%`,
                          background: enrollment.status === 'completed' ? 'var(--gradient-primary)' : 'var(--gradient-accent)',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>
                        {campaign?.campaign_type === 'amount'
                          ? `${formatCurrency(current)} / ${formatCurrency(target)}`
                          : `${current} / ${target} visits`}
                      </span>
                      <span>{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        {transactions.length > 0 && (
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
              📋 Recent Transactions
            </h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Amount</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => {
                    const isReturn = txn.amount < 0;
                    return (
                      <tr key={txn.id}>
                        <td style={{
                          fontWeight: 700,
                          color: isReturn ? '#dc2626' : 'var(--primary)',
                        }}>
                          {isReturn
                            ? `−${formatCurrency(Math.abs(txn.amount))}`
                            : `+${formatCurrency(txn.amount)}`}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{formatDateTime(txn.scanned_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Bottom nav for campaign management */}
        {campaign && (
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <Link href="/merchant/campaign/new" className="btn btn-secondary" style={{ flex: 1 }}>
              + New Campaign
            </Link>
            <Link href="/merchant/analytics" className="btn btn-accent" style={{ flex: 1 }}>
              📊 Analytics
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
