'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import Link from 'next/link';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import type { AdminOverview, AdminMerchantRow } from '@/types';

type SortKey = 'shop_name' | 'customers_this_month' | 'transactions_this_month' | 'whatsapp_cost_this_month' | 'created_at' | 'subscription_end_date';

const COLORS = {
  active: 'var(--success)',
  inactive: 'var(--warning)',
  blocked: 'var(--danger)',
};

export default function AdminPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    loadAdmin();
  }, []);

  const loadAdmin = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/admin/overview', {
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });

      if (response.ok) {
        setData(await response.json());
      } else {
        setError('Access denied or failed to load');
      }
    } catch {
      setError('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sortedMerchants = (data?.merchants || []).slice().sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortAsc ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
  });

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
          <Link href="/" className="nav-brand">LoyaltyQR</Link>
        </nav>
        <div className="container" style={{ paddingTop: '4rem', textAlign: 'center' }}>
          <div className="card" style={{ padding: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
            <h2 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Access Denied</h2>
            <p style={{ color: 'var(--text-muted)' }}>{error || 'Admin access required'}</p>
          </div>
        </div>
      </div>
    );
  }

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return ' ↕';
    return sortAsc ? ' ↑' : ' ↓';
  };

  const pieData = [
    { name: 'Active', value: data.subscription_health.active, color: COLORS.active },
    { name: 'Inactive', value: data.subscription_health.inactive, color: COLORS.inactive },
    { name: 'Blocked', value: data.subscription_health.blocked, color: COLORS.blocked },
  ].filter(d => d.value > 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <nav className="nav">
        <Link href="/" className="nav-brand">LoyaltyQR</Link>
        <div className="nav-links">
          <Link href="/admin" className="nav-link active">Dashboard</Link>
          <Link href="/admin/analytics" className="nav-link">Analytics</Link>
        </div>
        <span className="badge badge-danger">Admin</span>
      </nav>

      <div className="container" style={{ padding: '1.5rem 1rem', maxWidth: '1400px' }}>
        <h1 className="page-title">Platform Admin</h1>
        <p className="page-subtitle" style={{ marginBottom: '1.5rem' }}>
          Overview of all merchants and platform metrics
        </p>

        {/* Expiring Soon Alert */}
        {data.expiring_soon?.length > 0 && (
          <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'var(--warning)', background: 'rgba(234, 179, 8, 0.05)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--warning)' }}>
              ⚠️ Subscriptions Expiring Soon ({data.expiring_soon.length})
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {data.expiring_soon.map(m => (
                <div key={m.id} style={{ padding: '1rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{m.shop_name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Ends: {formatDate(m.subscription_end_date!)}</div>
                  </div>
                  <Link href={`/admin/merchants/${m.id}`} className="btn btn-sm btn-primary">Renew</Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total Merchants', value: data.stats.total_merchants, icon: '🏪', color: 'var(--text-primary)' },
            { label: 'Active Now', value: data.stats.active_merchants, icon: '✅', color: 'var(--success)' },
            { label: 'Inactive (Pending)', value: data.stats.inactive_merchants, icon: '⏳', color: 'var(--warning)' },
            { label: 'Blocked', value: data.stats.blocked_merchants, icon: '🚫', color: 'var(--danger)' },
            { label: 'MRR', value: formatCurrency(data.stats.mrr), icon: '📈', color: 'var(--primary)' },
            { label: 'Collections (MTD)', value: formatCurrency(data.stats.revenue_mtd), icon: '💰', color: 'var(--success)' },
          ].map(stat => (
            <div key={stat.label} className="card stat-card">
              <div style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>{stat.icon}</div>
              <div className="stat-value" style={{ color: stat.color, fontSize: '1.4rem' }}>{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Subscription Health */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
              🏥 Subscription Health
            </h3>
            <div style={{ height: 250, width: '100%' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS.active }}></span> Active ({data.subscription_health.active})
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS.inactive }}></span> Inactive ({data.subscription_health.inactive})
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS.blocked }}></span> Blocked ({data.subscription_health.blocked})
              </div>
            </div>
          </div>

          {/* Monthly Revenue Chart */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
              📊 Monthly Collections (12 months)
            </h3>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={data.monthly_revenue_chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <Bar dataKey="revenue" fill="var(--success)" radius={[4, 4, 0, 0]} name="Revenue (₹)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Churn Risks */}
        {data.churn_risks.length > 0 && (
          <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#f87171' }}>
              ⚠️ Churn Risks ({data.churn_risks.length})
            </h3>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {data.churn_risks.map(cr => (
                <Link
                  key={cr.id}
                  href={`/admin/merchants/${cr.id}`}
                  style={{
                    display: 'block',
                    padding: '0.75rem 1rem',
                    background: 'rgba(239, 68, 68, 0.08)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    textDecoration: 'none',
                    color: 'var(--text-primary)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{cr.shop_name}</strong>
                      <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '0.25rem' }}>{cr.reason}</p>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>View →</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Merchant Health Table */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
            🏪 Merchants
          </h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th onClick={() => handleSort('shop_name')} style={{ cursor: 'pointer' }}>Shop Name{sortIcon('shop_name')}</th>
                  <th>Category</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th onClick={() => handleSort('subscription_end_date')} style={{ cursor: 'pointer' }}>Sub End{sortIcon('subscription_end_date')}</th>
                  <th>Days Left</th>
                  <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer' }}>Joined{sortIcon('created_at')}</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedMerchants.map((m: AdminMerchantRow) => {
                  let daysLeftText = '-';
                  if (m.subscription_status === 'active' && m.subscription_end_date) {
                    const diffTime = new Date(m.subscription_end_date).getTime() - new Date().getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays < 0) daysLeftText = 'Expired';
                    else daysLeftText = `${diffDays} days`;
                  } else if (m.subscription_status === 'blocked') {
                    daysLeftText = 'Blocked';
                  } else if (m.subscription_status === 'inactive') {
                    daysLeftText = 'No sub';
                  }

                  return (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 600 }}>{m.shop_name}</td>
                      <td>{m.shop_category || '-'}</td>
                      <td>
                        <span className={`badge ${m.subscription_plan === 'growth' ? 'badge-success' : m.subscription_plan === 'starter' ? 'badge-info' : 'badge-muted'}`}>
                          {m.subscription_plan || 'None'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${m.subscription_status === 'active' ? 'badge-success' : m.subscription_status === 'blocked' ? 'badge-danger' : 'badge-warning'}`}>
                          {m.subscription_status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {m.subscription_end_date ? formatDate(m.subscription_end_date) : '-'}
                      </td>
                      <td>
                        <span style={{ 
                          color: daysLeftText === 'Expired' || daysLeftText === 'Blocked' ? 'var(--danger)' : 
                                daysLeftText === 'No sub' ? 'var(--warning)' : 
                                (parseInt(daysLeftText) <= 7 ? 'var(--warning)' : 'var(--text-primary)') 
                        }}>
                          {daysLeftText}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{formatDate(m.created_at)}</td>
                      <td>
                        <Link
                          href={`/admin/merchants/${m.id}`}
                          className="btn btn-sm btn-secondary"
                          style={{ textDecoration: 'none' }}
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sortedMerchants.length === 0 && (
            <div className="empty-state">
              <p>No merchants yet</p>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        {data.recent_activity.length > 0 && (
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
              📋 Recent Activity
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {data.recent_activity.map((event, i) => (
                <div
                  key={`${event.id}-${i}`}
                  style={{
                    padding: '0.625rem 0.75rem',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.875rem',
                  }}
                >
                  <span>
                    {event.type === 'campaign' && '🎯 '}
                    {event.type === 'merchant' && '🏪 '}
                    {event.type === 'transaction' && '🧾 '}
                    {event.type === 'customer' && '👤 '}
                    {event.text}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                    {formatDateTime(event.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
