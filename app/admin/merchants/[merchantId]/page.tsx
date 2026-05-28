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
  const [editMode, setEditMode] = useState(false);
  const [editPackage, setEditPackage] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

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
        setEditPackage(result.merchant.current_package || 'trial');
        setEditStatus(result.merchant.status || 'active');
        setEditNotes(result.merchant.notes || '');
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
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`/api/admin/merchants/${merchantId}/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          package_name: editPackage,
          status: editStatus,
          notes: editNotes,
        }),
      });
      setEditMode(false);
      loadData();
    } catch {
      alert('Failed to save');
    } finally {
      setSaving(false);
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

  const { merchant, campaigns, sales_chart_daily, sales_chart_monthly, customer_stats, whatsapp_costs } = data;

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
                <span className={`badge ${merchant.current_package === 'growth' ? 'badge-success' : merchant.current_package === 'starter' ? 'badge-info' : 'badge-muted'}`}>
                  {merchant.current_package || 'trial'}
                </span>
                <span className={`badge ${merchant.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                  {merchant.status || 'active'}
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
              <button
                className="btn btn-sm btn-primary"
                onClick={() => setEditMode(!editMode)}
              >
                ✏️ Edit
              </button>
            </div>
          </div>

          {/* Edit Panel */}
          {editMode && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="label">Package</label>
                  <select className="select" value={editPackage} onChange={e => setEditPackage(e.target.value)}>
                    <option value="trial">Trial</option>
                    <option value="starter">Starter (₹999)</option>
                    <option value="growth">Growth (₹1,499)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="select" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="churned">Churned</option>
                    <option value="trial">Trial</option>
                  </select>
                </div>
                <div>
                  <label className="label">Notes</label>
                  <input className="input" value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Admin notes..." />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button className="btn btn-sm btn-secondary" onClick={() => setEditMode(false)}>Cancel</button>
              </div>
            </div>
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

        {/* Daily Sales Chart */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
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
        <div className="card" style={{ marginBottom: '1.5rem' }}>
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
    </div>
  );
}
