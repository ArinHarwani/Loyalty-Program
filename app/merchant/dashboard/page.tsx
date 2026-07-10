'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { formatCurrency, maskPhone, calcPercentage, daysRemaining, formatDateTime, formatDate } from '@/lib/utils';
import { SUPPORT_WHATSAPP } from '@/lib/constants';
import Link from 'next/link';
import type { Merchant, Campaign, Enrollment, Transaction, Customer, PointsConfig, PointsLedgerEntry } from '@/types';

export default function DashboardPage() {
  const router = useRouter();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [enrollments, setEnrollments] = useState<(Enrollment & { customer?: Customer })[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [winners, setWinners] = useState<(Enrollment & { customer?: Customer })[]>([]);

  // Points specific state
  const [pointsConfig, setPointsConfig] = useState<PointsConfig | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<(PointsLedgerEntry & { customer?: Customer })[]>([]);

  const [totalCustomers, setTotalCustomers] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      router.push('/merchant/login');
      return;
    }

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

    if (merchantData.loyalty_mechanism === 'points') {
      const { data: config } = await supabase
        .from('points_config')
        .select('*')
        .eq('merchant_id', merchantData.id)
        .single();
      setPointsConfig(config);

      const { data: ledger } = await supabase
        .from('points_ledger')
        .select('*, customer:customers(*)')
        .eq('merchant_id', merchantData.id)
        .order('created_at', { ascending: false })
        .limit(10);
      setLedgerEntries(ledger || []);

      const { data: allLedger } = await supabase
        .from('points_ledger')
        .select('customer_id')
        .eq('merchant_id', merchantData.id);

      const uniqueCustomerIds = new Set((allLedger || []).map(e => e.customer_id));
      setTotalCustomers(uniqueCustomerIds.size);
    } else {
      const { data: allEnrollments } = await supabase
        .from('enrollments')
        .select('customer_id')
        .eq('merchant_id', merchantData.id);

      const uniqueCustomerIds = new Set((allEnrollments || []).map(e => e.customer_id));
      setTotalCustomers(uniqueCustomerIds.size);

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
        const { data: enrollmentData } = await supabase
          .from('enrollments')
          .select('*, customer:customers(*)')
          .eq('campaign_id', campaignData.id)
          .eq('merchant_id', merchantData.id)
          .order('enrolled_at', { ascending: false });

        setEnrollments(enrollmentData || []);

        const pendingWinners = (enrollmentData || []).filter(
          (e: Enrollment) => e.status === 'completed' && !e.claimed
        );
        setWinners(pendingWinners);

        const { data: txnData } = await supabase
          .from('transactions')
          .select('*')
          .eq('merchant_id', merchantData.id)
          .order('scanned_at', { ascending: false })
          .limit(10);

        setTransactions(txnData || []);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => { loadData(); }, 0);
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)' }}>
        <span className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  const customerLimit = merchant?.customer_limit || null;
  const customerUsagePct = customerLimit ? Math.min(Math.round((totalCustomers / customerLimit) * 100), 100) : null;
  const showLimitWarning = customerUsagePct !== null && customerUsagePct >= 80;

  let subDaysLeft = 0;
  if (merchant?.subscription_end_date) {
    const diffTime = new Date(merchant.subscription_end_date).getTime() - new Date().getTime();
    subDaysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  const waLink = `https://wa.me/${SUPPORT_WHATSAPP.replace('+', '')}`;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>

      {/* ── Navigation ── */}
      <nav className="nav">
        <Link href="/merchant/dashboard" className="nav-brand">LoyaltyQR</Link>
        <div className="nav-links">
          <Link href="/merchant/analytics" className="nav-link">Analytics</Link>
          <Link href="/merchant/settings" className="nav-link">Settings</Link>
          <button
            onClick={handleLogout}
            className="nav-link"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="container" style={{ padding: '1.5rem 1.25rem 3rem' }}>

        {/* ── Shop Header ── */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 className="page-title">{merchant?.shop_name}</h1>
          <p className="page-subtitle">
            {merchant?.shop_category}
            {merchant?.merchant_code && (
              <> &bull; Shop Code: <strong style={{ color: 'var(--charcoal)', fontVariantNumeric: 'tabular-nums' }}>{merchant.merchant_code}</strong></>
            )}
          </p>
        </div>

        {/* ── Subscription Expiry Warning ── */}
        {subDaysLeft > 0 && subDaysLeft <= 7 && (
          <div className="alert alert-warning" style={{ marginBottom: '1.25rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Your subscription ends in <strong>{subDaysLeft} day{subDaysLeft !== 1 ? 's' : ''}</strong> ({formatDate(merchant!.subscription_end_date!)}). Contact us to renew.
          </div>
        )}

        {/* ── Customer Limit Warning ── */}
        {showLimitWarning && (
          <div style={{
            marginBottom: '1.25rem',
            padding: '0.875rem 1.1rem',
            background: '#FEF3C7',
            border: '1px solid rgba(146, 64, 14, 0.3)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}>
            <div>
              <div style={{ fontWeight: 700, color: '#92400E', marginBottom: '0.15rem', fontSize: '0.9rem' }}>
                Approaching customer limit
              </div>
              <p style={{ fontSize: '0.85rem', color: '#78350F', margin: 0 }}>
                {totalCustomers.toLocaleString('en-IN')} / {customerLimit!.toLocaleString('en-IN')} customers used ({customerUsagePct}%).
                Upgrade to add more.
              </p>
            </div>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-primary"
              style={{ textDecoration: 'none' }}
            >
              WhatsApp us →
            </a>
          </div>
        )}

        {/* ── Primary Action ── */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <Link
            href="/merchant/transaction"
            className="btn btn-primary btn-lg"
            style={{ flex: 1, textAlign: 'center' }}
            id="new-transaction-btn"
          >
            New Transaction →
          </Link>

          {merchant?.loyalty_mechanism === 'points' && (
            <Link
              href="/merchant/redeem"
              className="btn btn-secondary btn-lg"
              style={{ flex: 1, textAlign: 'center' }}
            >
              Redeem Points
            </Link>
          )}
        </div>

        {/* ── Plan Summary ── */}
        {merchant?.subscription_plan && (
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--charcoal)', textTransform: 'capitalize' }}>
                {merchant.subscription_plan} Plan
              </h2>
              <span className="badge badge-success">Active</span>
            </div>

            {customerLimit && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--muted)' }}>Customers</span>
                  <span style={{ fontWeight: 600, color: showLimitWarning ? '#92400E' : 'var(--charcoal)', fontVariantNumeric: 'tabular-nums' }}>
                    {totalCustomers.toLocaleString('en-IN')} / {customerLimit.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className={`progress-fill${showLimitWarning ? ' progress-fill-warning' : ''}`}
                    style={{ width: `${customerUsagePct}%` }}
                  />
                </div>
              </div>
            )}

            {merchant.subscription_end_date && (
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                Ends: <strong style={{ color: subDaysLeft <= 7 ? '#92400E' : 'var(--charcoal)' }}>
                  {formatDate(merchant.subscription_end_date)}
                </strong>
                {' '}({subDaysLeft} day{subDaysLeft !== 1 ? 's' : ''} left)
              </p>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            POINTS DASHBOARD
        ══════════════════════════════════════════ */}
        {merchant?.loyalty_mechanism === 'points' && (
          <>
            {!pointsConfig ? (
              <div className="card" style={{ marginBottom: '1.25rem', textAlign: 'center', padding: '2.5rem' }}>
                <div className="empty-state-icon">⚙</div>
                <h3 className="empty-state-title">Points Program Not Configured</h3>
                <p style={{ color: 'var(--muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                  Set up your cashback percentage and conversion rate to start issuing points.
                </p>
                <Link href="/merchant/points-setup" className="btn btn-primary">
                  Set Up Points Program
                </Link>
              </div>
            ) : (
              <>
                {/* Points Config Summary */}
                <div className="card" style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--charcoal)' }}>Points Program</h2>
                    <span className="badge badge-success">Active</span>
                  </div>
                  <div className="ledger-row">
                    <span className="ledger-row-label">Cashback Rate</span>
                    <span className="ledger-row-value">{pointsConfig.cashback_percentage}% of bill</span>
                  </div>
                  <div className="ledger-row">
                    <span className="ledger-row-label">Point Value</span>
                    <span className="ledger-row-value">1 point = ₹{pointsConfig.conversion_rate}</span>
                  </div>
                  {pointsConfig.expiry_months && (
                    <div className="ledger-row">
                      <span className="ledger-row-label">Points Valid For</span>
                      <span className="ledger-row-value">{pointsConfig.expiry_months} months</span>
                    </div>
                  )}
                </div>

                {/* Recent Activity */}
                {ledgerEntries.length > 0 && (
                  <div className="card" style={{ marginBottom: '1.25rem' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--charcoal)' }}>
                      Recent Activity
                    </h3>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Customer</th>
                            <th>Type</th>
                            <th style={{ textAlign: 'right' }}>Points</th>
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledgerEntries.map((entry) => (
                            <tr key={entry.id}>
                              <td style={{ fontWeight: 600 }}>{maskPhone(entry.customer?.whatsapp_number || '')}</td>
                              <td style={{ color: 'var(--muted)', textTransform: 'capitalize' }}>{entry.type}</td>
                              <td style={{
                                textAlign: 'right',
                                fontWeight: 700,
                                fontVariantNumeric: 'tabular-nums',
                                color: entry.points > 0 ? 'var(--green)' : 'var(--red)',
                              }}>
                                {entry.points > 0 ? `+${entry.points}` : entry.points}
                              </td>
                              <td style={{ color: 'var(--muted)' }}>{formatDate(entry.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════
            MILESTONE DASHBOARD
        ══════════════════════════════════════════ */}
        {merchant?.loyalty_mechanism !== 'points' && (
          <>
            {/* Campaign Card */}
            {campaign ? (
              <div className="card" style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div>
                    <span className="badge badge-success" style={{ marginBottom: '0.4rem' }}>Active Campaign</span>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--charcoal)' }}>{campaign.name}</h2>
                  </div>
                </div>

                <div className="ledger-row">
                  <span className="ledger-row-label">Target</span>
                  <span className="ledger-row-value">
                    {campaign.campaign_type === 'amount'
                      ? formatCurrency(campaign.target_amount || 0)
                      : `${campaign.target_visits} visits`}
                  </span>
                </div>
                <div className="ledger-row">
                  <span className="ledger-row-label">Reward</span>
                  <span className="ledger-row-value" style={{ color: 'var(--green)' }}>{campaign.reward_description}</span>
                </div>
                <div className="ledger-row">
                  <span className="ledger-row-label">Duration</span>
                  <span className="ledger-row-value">
                    {campaign.window_mode === 'rolling'
                      ? `Rolling — ${campaign.window_duration_days} days/customer`
                      : campaign.end_date ? `Ends ${formatDate(campaign.end_date)}` : `${campaign.duration_days} days`}
                  </span>
                </div>

                {/* Stats row */}
                <div className="grid-3" style={{ marginTop: '1rem', gap: '0.5rem' }}>
                  <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                      {enrollments.length}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Enrolled</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>
                      {enrollments.filter(e => e.status === 'completed').length}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Completed</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                      {winners.length}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Pending</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card" style={{ marginBottom: '1.25rem', textAlign: 'center', padding: '2.5rem' }}>
                <div className="empty-state-icon">🎯</div>
                <h3 className="empty-state-title">No Active Campaign</h3>
                <p style={{ color: 'var(--muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                  Create a loyalty campaign to start rewarding your customers.
                </p>
                <Link href="/merchant/campaign/new" className="btn btn-primary">
                  + Create Campaign
                </Link>
              </div>
            )}

            {/* Winners Pending Claim */}
            {winners.length > 0 && (
              <div className="card" style={{ marginBottom: '1.25rem', borderColor: 'rgba(47, 104, 68, 0.3)' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--charcoal)' }}>
                  Rewards Pending Collection ({winners.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {winners.map((w) => (
                    <div
                      key={w.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem 0',
                        borderBottom: '1px solid var(--rule)',
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                          {maskPhone(w.customer?.whatsapp_number || '')}
                        </span>
                        <span style={{ color: 'var(--muted)', fontSize: '0.85rem', marginLeft: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>
                          Code: <strong>{w.claim_code}</strong>
                        </span>
                      </div>
                      <button
                        onClick={() => handleClaim(w.id)}
                        className="btn btn-primary btn-sm"
                        id={`claim-btn-${w.id}`}
                      >
                        Mark Collected
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Customer Progress — Ledger Table */}
            {enrollments.length > 0 && (
              <div className="card" style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--charcoal)' }}>
                  Customer Progress
                </h3>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Progress</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
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
                          <tr key={enrollment.id}>
                            <td style={{ fontWeight: 600 }}>
                              {maskPhone(enrollment.customer?.whatsapp_number || '')}
                            </td>
                            <td>
                              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.3rem', fontVariantNumeric: 'tabular-nums' }}>
                                {campaign?.campaign_type === 'amount'
                                  ? `${formatCurrency(current)} / ${formatCurrency(target)}`
                                  : `${current} / ${target} visits`}
                              </div>
                              <div className="progress-bar" style={{ height: '6px' }}>
                                <div
                                  className={`progress-fill${enrollment.status === 'completed' ? ' progress-fill-green' : ''}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </td>
                            <td>
                              {enrollment.status === 'completed' ? (
                                <span className="stamp">Done</span>
                              ) : enrollment.status === 'expired' ? (
                                <span className="stamp stamp-red">Expired</span>
                              ) : (
                                <span className="badge badge-muted">{days}d left</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recent Transactions */}
            {transactions.length > 0 && (
              <div className="card" style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--charcoal)' }}>
                  Recent Transactions
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
                              fontVariantNumeric: 'tabular-nums',
                              color: isReturn ? 'var(--red)' : 'var(--green)',
                            }}>
                              {isReturn
                                ? `−${formatCurrency(Math.abs(txn.amount))}`
                                : `+${formatCurrency(txn.amount)}`}
                            </td>
                            <td style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>{formatDateTime(txn.scanned_at)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Bottom Actions ── */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          {merchant?.loyalty_mechanism !== 'points' ? (
            campaign && (
              <>
                <Link href="/merchant/campaign/new" className="btn btn-secondary" style={{ flex: 1, textAlign: 'center' }}>
                  + New Campaign
                </Link>
                <Link href="/merchant/analytics" className="btn btn-primary" style={{ flex: 1, textAlign: 'center' }}>
                  Analytics →
                </Link>
              </>
            )
          ) : (
            <>
              <Link href="/merchant/points-setup" className="btn btn-secondary" style={{ flex: 1, textAlign: 'center' }}>
                Points Settings
              </Link>
              <Link href="/merchant/analytics" className="btn btn-primary" style={{ flex: 1, textAlign: 'center' }}>
                Analytics →
              </Link>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
