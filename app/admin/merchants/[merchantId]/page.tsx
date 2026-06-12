'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PLANS, MULTI_MONTH_DISCOUNTS, calculateMultiMonthPrice } from '@/lib/plans';
import type { PlanKey, DurationMonths } from '@/lib/plans';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { AdminMerchantDetail } from '@/types';

export default function MerchantDetailPage() {
  const params = useParams();
  const merchantId = params.merchantId as string;

  const [data, setData] = useState<AdminMerchantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal states
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  
  // Activate Form
  const [planName, setPlanName] = useState<string>('growth');
  const [durationMonths, setDurationMonths] = useState<DurationMonths>(1);
  const [customPrice, setCustomPrice] = useState('0');
  const [customLimit, setCustomLimit] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [utr, setUtr] = useState('');
  const [notes, setNotes] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDateOverride, setEndDateOverride] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Calculated price for the modal
  const calculatedPrice = useMemo(() => {
    if (planName === 'custom') {
      return {
        original_total: Number(customPrice) * durationMonths,
        discount_percent: 0,
        discount_amount: 0,
        final_total: Number(customPrice) * durationMonths,
        monthly_effective: Number(customPrice),
      };
    }
    if (planName in PLANS) {
      return calculateMultiMonthPrice(planName as PlanKey, durationMonths);
    }
    return { original_total: 0, discount_percent: 0, discount_amount: 0, final_total: 0, monthly_effective: 0 };
  }, [planName, durationMonths, customPrice]);

  // Amount received — starts at calculated total, but admin can override
  const [amountOverride, setAmountOverride] = useState<string>('');
  
  const effectiveAmount = amountOverride !== '' ? Number(amountOverride) : calculatedPrice.final_total;

  // Sync amount override when calculated price changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAmountOverride('');
  }, [planName, durationMonths, customPrice]);

  const loadData = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/admin/merchants/${merchantId}`, {
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });

      if (response.ok) {
        const result = await response.json();
        setData(result);
        
        // Calculate next start date
        const today = new Date().toISOString().split('T')[0];
        if (result.merchant.subscription_status === 'active' && result.merchant.subscription_end_date) {
          const endDate = new Date(result.merchant.subscription_end_date);
          endDate.setDate(endDate.getDate() + 1);
          setStartDate(endDate.toISOString().split('T')[0]);
        } else {
          setStartDate(today);
        }
      } else {
        setError('Failed to load merchant data');
      }
    } catch {
      setError('Failed to load merchant data');
    } finally {
      setLoading(false);
    }
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (merchantId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData();
    }
  }, [merchantId]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/admin/merchants/${merchantId}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          plan_name: planName,
          price: effectiveAmount,
          duration_months: durationMonths,
          payment_method: paymentMethod,
          utr_number: utr,
          start_date: startDate,
          end_date_override: endDateOverride || undefined,
          notes,
          customer_limit: planName === 'custom' ? Number(customLimit) || null : undefined,
        }),
      });
      
      if (!response.ok) throw new Error('Activation failed');
      
      setShowActivateModal(false);
      setAmountOverride('');
      loadData();
    } catch {
      alert('Failed to activate subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!confirm('Are you sure you want to block this merchant? They will immediately lose access to the platform.')) return;
    
    setActionLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`/api/admin/merchants/${merchantId}/block`, {
        method: 'POST',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      loadData();
    } catch {
      alert('Failed to block merchant');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnblock = async () => {
    setActionLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`/api/admin/merchants/${merchantId}/unblock`, {
        method: 'POST',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      loadData();
    } catch {
      alert('Failed to unblock merchant');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    
    setPasswordLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/admin/merchants/${merchantId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ newPassword }),
      });
      
      const resData = await response.json();
      
      if (!response.ok) {
        throw new Error(resData.error || 'Failed to reset password');
      }
      
      setPasswordSuccess('Password reset successfully!');
      setNewPassword('');
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess('');
      }, 2000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setPasswordError(err.message || 'Failed to reset password');
      } else {
        setPasswordError('Failed to reset password');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <nav className="nav">
          <Link href="/admin" className="nav-brand">← Back to Admin</Link>
        </nav>
        <div className="container" style={{ paddingTop: '4rem', textAlign: 'center' }}>
          <div className="card" style={{ padding: '3rem' }}>
            <p style={{ color: 'var(--text-muted)' }}>{error || 'Not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  const { merchant, subscription_history, campaigns, sales_chart_daily, sales_chart_monthly, customer_stats, whatsapp_costs } = data;
  
  let daysLeftText = '-';
  let daysLeft = 0;
  if (merchant.subscription_status === 'active' && merchant.subscription_end_date) {
    const diffTime = new Date(merchant.subscription_end_date).getTime() - new Date().getTime();
    daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) daysLeftText = 'Expired';
    else daysLeftText = `${daysLeft} days`;
  }

  // Customer usage percentage
  const customerUsagePct = merchant.customer_limit
    ? Math.min(Math.round((customer_stats.total / merchant.customer_limit) * 100), 100)
    : null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <nav className="nav">
        <Link href="/admin" className="nav-brand" style={{ textDecoration: 'none' }}>← Admin</Link>
        <span className="badge badge-danger">Admin</span>
      </nav>

      <div className="container" style={{ padding: '1.5rem 1rem', maxWidth: '1400px' }}>
        {/* Merchant Header */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.25rem' }}>
                {merchant.shop_name}
              </h1>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                {merchant.shop_category} • {merchant.email}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span className={`badge ${merchant.subscription_status === 'active' ? 'badge-success' : merchant.subscription_status === 'blocked' ? 'badge-danger' : 'badge-warning'}`}>
                  {merchant.subscription_status}
                </span>
                {merchant.subscription_plan && (
                  <span className={`badge ${merchant.subscription_plan === 'pro' ? 'badge-danger' : merchant.subscription_plan === 'business' ? 'badge-info' : merchant.subscription_plan === 'growth' ? 'badge-success' : 'badge-muted'}`}>
                    {merchant.subscription_plan.charAt(0).toUpperCase() + merchant.subscription_plan.slice(1)} Plan
                  </span>
                )}
                <span className="badge badge-muted">
                  Joined {formatDate(merchant.created_at)}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="btn btn-sm btn-secondary"
              >
                🔑 Reset Password
              </button>
              <a
                href={`mailto:${merchant.email}`}
                className="btn btn-sm btn-secondary"
                style={{ textDecoration: 'none' }}
              >
                📧 Email
              </a>
            </div>
          </div>
        </div>

        {/* Subscription Management (Most Important) */}
        <div className="card" style={{ marginBottom: '1.5rem', border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
            💳 Subscription Management
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Current Plan</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, textTransform: 'capitalize' }}>
                {merchant.subscription_plan || 'None'}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Customer Limit</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                {merchant.customer_limit ? merchant.customer_limit.toLocaleString('en-IN') : '—'}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Customers Enrolled</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                {customer_stats.total.toLocaleString('en-IN')}
                {merchant.customer_limit && (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                    {' '}/ {merchant.customer_limit.toLocaleString('en-IN')}
                  </span>
                )}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>End Date</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                {merchant.subscription_end_date ? formatDate(merchant.subscription_end_date) : '-'}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Days Remaining</div>
              <div style={{ 
                fontSize: '1.25rem', 
                fontWeight: 600,
                color: daysLeftText === 'Expired' || daysLeft <= 3 ? 'var(--danger)' : daysLeft <= 7 ? 'var(--warning)' : 'var(--text-primary)'
              }}>
                {daysLeftText}
              </div>
            </div>
          </div>

          {/* Customer usage bar */}
          {customerUsagePct !== null && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Customer Usage</span>
                <span style={{ fontWeight: 600, color: customerUsagePct >= 80 ? 'var(--warning)' : 'var(--text-primary)' }}>
                  {customerUsagePct}%
                </span>
              </div>
              <div className="progress-bar" style={{ height: '8px' }}>
                <div
                  className="progress-fill"
                  style={{
                    width: `${customerUsagePct}%`,
                    background: customerUsagePct >= 80 ? 'var(--warning)' : 'var(--gradient-primary)',
                  }}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            {merchant.subscription_status === 'active' ? (
              <>
                <button 
                  className={`btn ${daysLeft <= 7 ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setShowActivateModal(true)}
                  disabled={actionLoading}
                >
                  {daysLeft <= 7 ? '🚀 Renew Subscription' : '🔄 Renew / Change Plan'}
                </button>
                <button 
                  className="btn btn-danger"
                  style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' }}
                  onClick={handleBlock}
                  disabled={actionLoading}
                >
                  🚫 Block Access
                </button>
              </>
            ) : merchant.subscription_status === 'inactive' ? (
              <button 
                className="btn btn-success"
                onClick={() => setShowActivateModal(true)}
                disabled={actionLoading}
              >
                ✅ Activate Account
              </button>
            ) : (
              // Blocked state
              <button 
                className="btn btn-primary"
                onClick={handleUnblock}
                disabled={actionLoading}
              >
                🔓 Unblock Access
              </button>
            )}
          </div>
        </div>

        {/* Subscription History */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
            📜 Subscription History
          </h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Duration</th>
                  <th>Price</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>UTR</th>
                </tr>
              </thead>
              <tbody>
                {subscription_history.map(sub => (
                  <tr key={sub.id}>
                    <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>{sub.plan_name}</td>
                    <td>{sub.duration_months || 1} mo</td>
                    <td>{formatCurrency(sub.price)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatDate(sub.start_date)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatDate(sub.end_date)}</td>
                    <td>
                      <span className={`badge ${sub.status === 'active' ? 'badge-success' : 'badge-muted'}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td style={{ textTransform: 'uppercase' }}>{sub.payment_method}</td>
                    <td style={{ fontFamily: 'monospace' }}>{sub.utr_number || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {subscription_history.length === 0 && (
            <div className="empty-state"><p>No previous subscriptions</p></div>
          )}
        </div>

        {/* Overview Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Customers', value: customer_stats.total, icon: '👥', color: 'var(--accent)' },
            { label: 'Campaigns', value: campaigns.length, icon: '🎯', color: 'var(--primary)' },
            { label: 'Completed', value: campaigns.reduce((s, c) => s + c.completed, 0), icon: '🏆', color: 'var(--warning)' },
            { label: 'WA Cost', value: formatCurrency(whatsapp_costs.total), icon: '💬', color: '#a855f7' },
          ].map(stat => (
            <div key={stat.label} className="card stat-card">
              <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{stat.icon}</div>
              <div className="stat-value" style={{ color: stat.color, fontSize: '1.35rem' }}>{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Sales Charts side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Daily Sales Chart */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
              📊 Daily Transactions (30 days)
            </h3>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <BarChart data={sales_chart_daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval={4} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  />
                  <Bar dataKey="amount" fill="var(--primary)" radius={[4, 4, 0, 0]} name="Amount (₹)" />
                  <Bar dataKey="transactions" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Transactions" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Sales Chart */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
              📈 Monthly Transactions (12 months)
            </h3>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <BarChart data={sales_chart_monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  />
                  <Bar dataKey="amount" fill="var(--primary)" radius={[4, 4, 0, 0]} name="Amount (₹)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Customer Analytics + WhatsApp Costs side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Customer Analytics */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>👥 Customer Analytics</h3>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {[
                { label: 'Total Customers', value: customer_stats.total },
                { label: 'New This Month', value: customer_stats.new_this_month },
                { label: 'Returning Rate', value: `${customer_stats.returning_rate}%` },
                { label: 'Active Enrollments', value: customer_stats.by_status.active },
                { label: 'Completed', value: customer_stats.by_status.completed },
                { label: 'Expired', value: customer_stats.by_status.expired },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{item.label}</span>
                  <span style={{ fontWeight: 600 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* WhatsApp Costs */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>💬 WhatsApp Costs</h3>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Service (₹0)</span>
                <span>{whatsapp_costs.service.count} msgs — {formatCurrency(whatsapp_costs.service.cost)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Utility (₹0.11)</span>
                <span>{whatsapp_costs.utility.count} msgs — {formatCurrency(whatsapp_costs.utility.cost)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Marketing (₹0.90)</span>
                <span>{whatsapp_costs.marketing.count} msgs — {formatCurrency(whatsapp_costs.marketing.cost)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', fontWeight: 700 }}>
                <span>Total All Time</span>
                <span style={{ color: 'var(--warning)' }}>{formatCurrency(whatsapp_costs.total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>This Month</span>
                <span style={{ color: 'var(--accent)' }}>{formatCurrency(whatsapp_costs.this_month)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* All Campaigns Table */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
            🎯 All Campaigns ({campaigns.length})
          </h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Target</th>
                  <th>Duration</th>
                  <th>Reward</th>
                  <th>Enrolled</th>
                  <th>Completed</th>
                  <th>Rate</th>
                  <th>Sales</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>
                      <span className="badge badge-muted">{c.campaign_type}</span>
                    </td>
                    <td>{c.target}</td>
                    <td>{c.duration_days}d</td>
                    <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.reward_description}</td>
                    <td>{c.enrolled}</td>
                    <td>{c.completed}</td>
                    <td>{c.completion_rate}%</td>
                    <td>{formatCurrency(c.sales_generated)}</td>
                    <td>
                      <span className={`badge ${c.status === 'active' ? 'badge-success' : 'badge-muted'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {campaigns.length === 0 && (
            <div className="empty-state"><p>No campaigns yet</p></div>
          )}
        </div>
      </div>

      {/* Activate/Renew Modal — Rebuilt with new plan structure */}
      {showActivateModal && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card slide-up" style={{ width: '100%', maxWidth: '580px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem' }}>
              {merchant.subscription_status === 'active' ? 'Renew / Change Plan' : 'Activate Subscription'}
            </h2>
            
            <form onSubmit={handleActivate}>
              {/* Plan Selection — Radio buttons */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="label">Plan</label>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {(Object.entries(PLANS) as [PlanKey, typeof PLANS[PlanKey]][]).map(([key, plan]) => (
                    <label
                      key={key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        background: planName === key ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-surface)',
                        border: `1.5px solid ${planName === key ? 'var(--primary)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <input
                        type="radio"
                        name="plan"
                        value={key}
                        checked={planName === key}
                        onChange={() => setPlanName(key)}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{plan.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {plan.description}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--primary)' }}>
                        ₹{plan.monthly_price.toLocaleString('en-IN')}/mo
                      </div>
                    </label>
                  ))}
                  {/* Custom plan option */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      background: planName === 'custom' ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-surface)',
                      border: `1.5px solid ${planName === 'custom' ? 'var(--primary)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="plan"
                      value="custom"
                      checked={planName === 'custom'}
                      onChange={() => setPlanName('custom')}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>Custom</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Special pricing — enter amount manually
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Custom plan fields */}
              {planName === 'custom' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label className="label">Monthly Price (₹)</label>
                    <input type="number" className="input" value={customPrice} onChange={e => setCustomPrice(e.target.value)} required min="0" />
                  </div>
                  <div>
                    <label className="label">Customer Limit</label>
                    <input type="number" className="input" value={customLimit} onChange={e => setCustomLimit(e.target.value)} placeholder="e.g. 3000" min="1" />
                  </div>
                </div>
              )}

              {/* Duration Selection — Radio buttons */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="label">Duration</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                  {([1, 2, 3, 6] as DurationMonths[]).map(m => (
                    <label
                      key={m}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '0.75rem 0.5rem',
                        background: durationMonths === m ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-surface)',
                        border: `1.5px solid ${durationMonths === m ? 'var(--primary)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <input
                        type="radio"
                        name="duration"
                        value={m}
                        checked={durationMonths === m}
                        onChange={() => setDurationMonths(m)}
                        style={{ accentColor: 'var(--primary)', marginBottom: '0.25rem' }}
                      />
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{m} mo</span>
                      {MULTI_MONTH_DISCOUNTS[m] > 0 && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 600 }}>
                          {MULTI_MONTH_DISCOUNTS[m]}% off
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Live Price Calculator */}
              <div style={{
                marginBottom: '1.25rem',
                padding: '1rem',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                  💰 Price Calculation
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {planName === 'custom' ? 'Custom' : PLANS[planName as PlanKey]?.name} × {durationMonths} month{durationMonths > 1 ? 's' : ''}
                    </span>
                    <span>{formatCurrency(calculatedPrice.original_total)}</span>
                  </div>
                  {calculatedPrice.discount_percent > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}>
                      <span>Discount ({calculatedPrice.discount_percent}%)</span>
                      <span>-{formatCurrency(calculatedPrice.discount_amount)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid var(--border)', paddingTop: '0.35rem', marginTop: '0.25rem' }}>
                    <span>Total to collect</span>
                    <span style={{ color: 'var(--primary)' }}>{formatCurrency(calculatedPrice.final_total)}</span>
                  </div>
                  {durationMonths > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span>Effective</span>
                      <span>{formatCurrency(calculatedPrice.monthly_effective)}/month</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Amount + Payment */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label className="label">Amount Received (₹)</label>
                  <input
                    type="number"
                    className="input"
                    value={amountOverride !== '' ? amountOverride : String(calculatedPrice.final_total)}
                    onChange={e => setAmountOverride(e.target.value)}
                    required
                    min="0"
                  />
                </div>
                <div>
                  <label className="label">Payment Method</label>
                  <select className="select" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} required>
                    <option value="upi">UPI</option>
                    <option value="cash">Cash</option>
                    <option value="free">Free (own shop)</option>
                  </select>
                </div>
              </div>
              
              {paymentMethod === 'upi' && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="label">UTR / Reference Number</label>
                  <input type="text" className="input" value={utr} onChange={e => setUtr(e.target.value)} placeholder="e.g. 123456789012" required />
                </div>
              )}
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label className="label">Start Date</label>
                  <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    End: +{durationMonths * 30} days
                  </p>
                </div>
                <div>
                  <label className="label">End Date (Override)</label>
                  <input type="date" className="input" value={endDateOverride} onChange={e => setEndDateOverride(e.target.value)} />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Optional. Replaces calculated end date.
                  </p>
                </div>
                <div>
                  <label className="label">Notes (Optional)</label>
                  <input type="text" className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any internal notes" />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowActivateModal(false); setAmountOverride(''); }} disabled={actionLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Processing...' : 'Confirm Activation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>
              Reset Merchant Password
            </h2>

            {passwordSuccess && (
              <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
                ✅ {passwordSuccess}
              </div>
            )}
            
            {passwordError && (
              <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                ⚠️ {passwordError}
              </div>
            )}

            <form onSubmit={handleResetPassword}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label className="label">New Password</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  required
                />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  This will immediately change the merchant&apos;s password. They will not be notified by email.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPasswordModal(false)}
                  disabled={passwordLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={passwordLoading}
                >
                  {passwordLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
