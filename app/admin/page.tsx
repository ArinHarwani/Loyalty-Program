'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import type { AdminOverview } from '@/types';

export default function AdminPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <nav className="nav">
        <Link href="/" className="nav-brand">LoyaltyQR</Link>
        <span className="badge badge-danger">Admin</span>
      </nav>

      <div className="container" style={{ padding: '1.5rem 1rem' }}>
        <h1 className="page-title">Platform Admin</h1>
        <p className="page-subtitle" style={{ marginBottom: '1.5rem' }}>
          Overview of all merchants and platform metrics
        </p>

        {/* Platform Stats */}
        <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
          {[
            { label: 'Merchants', value: data.totalMerchants, color: 'var(--primary)', icon: '🏪' },
            { label: 'Customers', value: data.totalCustomers, color: 'var(--accent)', icon: '👥' },
            { label: 'Messages', value: data.totalMessages, color: 'var(--warning)', icon: '💬' },
            { label: 'Total Cost', value: formatCurrency(data.totalCost), color: '#a855f7', icon: '💸' },
          ].map((stat) => (
            <div key={stat.label} className="card stat-card">
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{stat.icon}</div>
              <div className="stat-value" style={{ color: stat.color }}>{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Cost Breakdown */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
            💸 Message Cost Breakdown
          </h3>
          <div className="grid-3">
            <div className="stat-card card-static">
              <div className="stat-value" style={{ color: 'var(--primary)' }}>
                {formatCurrency(data.costBreakdown.service)}
              </div>
              <div className="stat-label">Service (Free)</div>
            </div>
            <div className="stat-card card-static">
              <div className="stat-value" style={{ color: 'var(--accent)' }}>
                {formatCurrency(data.costBreakdown.utility)}
              </div>
              <div className="stat-label">Utility (₹0.11)</div>
            </div>
            <div className="stat-card card-static">
              <div className="stat-value" style={{ color: 'var(--warning)' }}>
                {formatCurrency(data.costBreakdown.marketing)}
              </div>
              <div className="stat-label">Marketing (₹0.90)</div>
            </div>
          </div>
        </div>

        {/* Merchants Table */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
            🏪 Merchants
          </h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Shop Name</th>
                  <th>Email</th>
                  <th>Campaigns</th>
                  <th>Messages</th>
                  <th>Cost</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {data.merchants.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.shop_name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{m.email}</td>
                    <td>{m.campaigns}</td>
                    <td>{m.messages}</td>
                    <td>{formatCurrency(m.cost)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatDate(m.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.merchants.length === 0 && (
            <div className="empty-state">
              <p>No merchants yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
