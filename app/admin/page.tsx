'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import Link from 'next/link';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import type { AdminOverview, AdminMerchantRow } from '@/types';

type SortKey = 'shop_name' | 'customers_this_month' | 'transactions_this_month' | 'whatsapp_cost_this_month' | 'created_at';

export default function AdminPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortAsc, setSortAsc] = useState(false);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAdmin();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

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

        {/* Top Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Merchants', value: data.stats.total_merchants, icon: '🏪', color: 'var(--primary)' },
            { label: 'Active', value: data.stats.active_merchants, icon: '✅', color: 'var(--primary-light)' },
            { label: 'Customers', value: data.stats.total_customers, icon: '👥', color: 'var(--accent)' },
            { label: 'Transactions', value: data.stats.total_transactions, icon: '🧾', color: '#a855f7' },
            { label: 'WA Cost (MTD)', value: formatCurrency(data.stats.whatsapp_cost_mtd), icon: '💬', color: 'var(--warning)' },
          ].map(stat => (
            <div key={stat.label} className="card stat-card">
              <div style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>{stat.icon}</div>
              <div className="stat-value" style={{ color: stat.color, fontSize: '1.5rem' }}>{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Cost Breakdown */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
            💸 WhatsApp Cost Breakdown
          </h3>
          <div className="grid-3">
            <div className="stat-card card-static">
              <div className="stat-value" style={{ color: 'var(--primary)', fontSize: '1.25rem' }}>
                {formatCurrency(data.costBreakdown.service)}
              </div>
              <div className="stat-label">Service (Free)</div>
            </div>
            <div className="stat-card card-static">
              <div className="stat-value" style={{ color: 'var(--accent)', fontSize: '1.25rem' }}>
                {formatCurrency(data.costBreakdown.utility)}
              </div>
              <div className="stat-label">Utility (₹0.11)</div>
            </div>
            <div className="stat-card card-static">
              <div className="stat-value" style={{ color: 'var(--warning)', fontSize: '1.25rem' }}>
                {formatCurrency(data.costBreakdown.marketing)}
              </div>
              <div className="stat-label">Marketing (₹0.90)</div>
            </div>
          </div>
        </div>

        {/* Monthly WhatsApp Cost Chart */}
        {data.monthly_revenue_chart.length > 0 && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
              📊 Monthly WhatsApp Costs (12 months)
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
                  <Bar dataKey="cost" fill="var(--warning)" radius={[4, 4, 0, 0]} name="WhatsApp Cost (₹)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

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
            🏪 Merchant Health
          </h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th onClick={() => handleSort('shop_name')} style={{ cursor: 'pointer' }}>
                    Shop Name{sortIcon('shop_name')}
                  </th>
                  <th>Package</th>
                  <th>Status</th>
                  <th onClick={() => handleSort('customers_this_month')} style={{ cursor: 'pointer' }}>
                    Customers (MTD){sortIcon('customers_this_month')}
                  </th>
                  <th onClick={() => handleSort('transactions_this_month')} style={{ cursor: 'pointer' }}>
                    Txns (MTD){sortIcon('transactions_this_month')}
                  </th>
                  <th onClick={() => handleSort('whatsapp_cost_this_month')} style={{ cursor: 'pointer' }}>
                    WA Cost (MTD){sortIcon('whatsapp_cost_this_month')}
                  </th>
                  <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer' }}>
                    Joined{sortIcon('created_at')}
                  </th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedMerchants.map((m: AdminMerchantRow) => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.shop_name}</td>
                    <td>
                      <span className={`badge ${m.current_package === 'growth' ? 'badge-success' : m.current_package === 'starter' ? 'badge-info' : 'badge-muted'}`}>
                        {m.current_package}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${m.status === 'active' ? 'badge-success' : m.status === 'churned' ? 'badge-danger' : 'badge-warning'}`}>
                        {m.status}
                      </span>
                    </td>
                    <td>{m.customers_this_month}</td>
                    <td>{m.transactions_this_month}</td>
                    <td>{formatCurrency(m.whatsapp_cost_this_month)}</td>
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
                ))}
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
