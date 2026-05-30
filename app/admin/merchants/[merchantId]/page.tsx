'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';
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
  const [showBlockModal, setShowBlockModal] = useState(false);
  
  // Activate Form
  const [planName, setPlanName] = useState('starter');
  const [price, setPrice] = useState('999');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [utr, setUtr] = useState('');
  const [notes, setNotes] = useState('');
  const [startDate, setStartDate] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

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

  useEffect(() => {
    if (merchantId) {
      loadData();
    }
  }, [merchantId]);

  const handlePlanChange = (plan: string) => {
    setPlanName(plan);
    if (plan === 'starter') setPrice('999');
    else if (plan === 'growth') setPrice('1499');
    else setPrice('0');
  };

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
          price: Number(price),
          payment_method: paymentMethod,
          utr_number: utr,
          start_date: startDate,
          notes,
        }),
      });
      
      if (!response.ok) throw new Error('Activation failed');
      
      setShowActivateModal(false);
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
                <span className="badge badge-muted">
                  Joined {formatDate(merchant.created_at)}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
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
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Current Plan</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, textTransform: 'capitalize' }}>
                {merchant.subscription_plan || 'None'}
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

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            {merchant.subscription_status === 'active' ? (
              <>
                <button 
                  className={`btn ${daysLeft <= 7 ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setShowActivateModal(true)}
                  disabled={actionLoading}
                >
                  {daysLeft <= 7 ? '🚀 Renew Subscription' : 'Update / Extend'}
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

      {/* Activate/Renew Modal */}
      {showActivateModal && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card slide-up" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem' }}>
              Activate / Renew Subscription
            </h2>
            
            <form onSubmit={handleActivate}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="label">Plan Name</label>
                <select className="select" value={planName} onChange={e => handlePlanChange(e.target.value)} required>
                  <option value="starter">Starter Plan (₹999/mo)</option>
                  <option value="growth">Growth Plan (₹1,499/mo)</option>
                  <option value="custom">Custom Plan</option>
                </select>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label className="label">Amount (₹)</label>
                  <input type="number" className="input" value={price} onChange={e => setPrice(e.target.value)} required min="0" />
                </div>
                <div>
                  <label className="label">Payment Method</label>
                  <select className="select" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} required>
                    <option value="upi">UPI</option>
                    <option value="cash">Cash</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="free">Free / Comped</option>
                  </select>
                </div>
              </div>
              
              {paymentMethod === 'upi' && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="label">UTR / Reference Number</label>
                  <input type="text" className="input" value={utr} onChange={e => setUtr(e.target.value)} placeholder="e.g. 123456789012" required />
                </div>
              )}
              
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="label">Start Date</label>
                <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  End date will be automatically set to +30 days.
                </p>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label className="label">Notes (Optional)</label>
                <input type="text" className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any internal notes" />
              </div>
              
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowActivateModal(false)} disabled={actionLoading}>
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
    </div>
  );
}
