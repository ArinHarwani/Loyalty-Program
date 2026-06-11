'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { formatCurrency, maskPhone, calcPercentage, daysRemaining, formatDateTime, formatDate } from '@/lib/utils';
import { SUPPORT_WHATSAPP } from '@/lib/constants';
import Link from 'next/link';
import type { Merchant, Campaign, Enrollment, Transaction, Customer } from '@/types';

export default function DashboardPage() {
  const router = useRouter();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [enrollments, setEnrollments] = useState<(Enrollment & { customer?: Customer })[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [winners, setWinners] = useState<(Enrollment & { customer?: Customer })[]>([]);
  const [totalCustomers, setTotalCustomers] = useState(0);
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

    // Count total unique customers (distinct customer_id from enrollments)
    const { data: allEnrollments } = await supabase
      .from('enrollments')
      .select('customer_id')
      .eq('merchant_id', merchantData.id);
    
    const uniqueCustomerIds = new Set((allEnrollments || []).map(e => e.customer_id));
    setTotalCustomers(uniqueCustomerIds.size);

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

  // Compute plan usage
  const customerLimit = merchant?.customer_limit || null;
  const customerUsagePct = customerLimit ? Math.min(Math.round((totalCustomers / customerLimit) * 100), 100) : null;
  const showLimitWarning = customerUsagePct !== null && customerUsagePct >= 80;

  // Compute days left on subscription
  let subDaysLeft = 0;
  if (merchant?.subscription_end_date) {
    const diffTime = new Date(merchant.subscription_end_date).getTime() - new Date().getTime();
    subDaysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  const waLink = `https://wa.me/${SUPPORT_WHATSAPP.replace('+', '')}`;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Nav */}
      <nav className="nav">
        <Link href="/merchant/dashboard" className="nav-brand">LoyaltyQR</Link>
        <div className="nav-links">
          <Link href="/merchant/analytics" className="nav-link">📊 Analytics</Link>
          <Link href="/merchant/settings" className="nav-link">⚙️ Settings</Link>
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

        {/* Plan Usage Card */}
        {merchant?.subscription_plan && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                  Your Plan
                </div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, textTransform: 'capitalize' }}>
                  {merchant.subscription_plan}
                </h2>
              </div>
              <span className={`badge ${merchant.subscription_plan === 'pro' ? 'badge-danger' : merchant.subscription_plan === 'business' ? 'badge-info' : 'badge-success'}`}>
                Active
              </span>
            </div>

            {/* Customer progress bar */}
            {customerLimit && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Customers: {totalCustomers.toLocaleString('en-IN')} / {customerLimit.toLocaleString('en-IN')}
                  </span>
                  <span style={{ fontWeight: 600, color: showLimitWarning ? 'var(--warning)' : 'var(--text-primary)' }}>
                    {customerUsagePct}%
                  </span>
                </div>
                <div className="progress-bar" style={{ height: '10px' }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: `${customerUsagePct}%`,
                      background: showLimitWarning ? 'var(--warning)' : 'var(--gradient-primary)',
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Subscription end date */}
            {merchant.subscription_end_date && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Subscription ends: <strong style={{ color: subDaysLeft <= 7 ? 'var(--warning)' : 'var(--text-primary)' }}>
                  {formatDate(merchant.subscription_end_date)}
                </strong>
                <span style={{ color: subDaysLeft <= 7 ? 'var(--warning)' : 'var(--text-muted)' }}>
                  {' '}({subDaysLeft} day{subDaysLeft !== 1 ? 's' : ''} left)
                </span>
              </p>
            )}
          </div>
        )}

        {/* 80% Customer Limit Warning Banner */}
        {showLimitWarning && (
          <div
            style={{
              marginBottom: '1.5rem',
              padding: '1rem 1.25rem',
              background: 'rgba(234, 179, 8, 0.08)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: 'var(--warning)', marginBottom: '0.25rem' }}>
                ⚠️ Approaching Customer Limit
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                You&apos;re at {customerUsagePct}% of your customer limit ({totalCustomers.toLocaleString('en-IN')}/{customerLimit!.toLocaleString('en-IN')}).
                Contact us to upgrade your plan.
              </p>
            </div>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-primary"
              style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              WhatsApp us →
            </a>
          </div>
        )}

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

        {/* Plan Info Section */}
        {merchant?.subscription_plan && (
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
              📋 Your Current Plan
            </h3>
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              {[
                { label: 'Plan', value: merchant.subscription_plan.charAt(0).toUpperCase() + merchant.subscription_plan.slice(1) },
                { label: 'Customer limit', value: customerLimit ? customerLimit.toLocaleString('en-IN') : '—' },
                { label: 'Customers enrolled', value: `${totalCustomers.toLocaleString('en-IN')} / ${customerLimit ? customerLimit.toLocaleString('en-IN') : '—'}` },
                { label: 'Subscription ends', value: merchant.subscription_end_date ? formatDate(merchant.subscription_end_date) : '—' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{item.label}</span>
                  <span style={{ fontWeight: 600 }}>{item.value}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-secondary"
                style={{ textDecoration: 'none' }}
              >
                💬 WhatsApp
              </a>
              <a
                href={`mailto:${merchant.email}`}
                className="btn btn-sm btn-secondary"
                style={{ textDecoration: 'none' }}
              >
                📧 Email
              </a>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
              Want to upgrade? Contact us via WhatsApp or email.
            </p>
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
