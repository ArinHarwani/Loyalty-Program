'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from 'recharts';

interface AnalyticsData {
  acquisition: {
    new_merchants_per_month: { month: string; count: number }[];
    new_customers_per_month: { month: string; count: number }[];
  };
  engagement: {
    transactions_per_day: { date: string; count: number; amount: number }[];
    avg_completion_rate: number;
    popular_durations: { days: number; count: number }[];
    popular_rewards: { reward: string; count: number }[];
    total_transactions: number;
    total_sales: number;
  };
  whatsapp: {
    messages_per_month: { month: string; count: number; cost: number }[];
    cost_per_merchant: { shop_name: string; cost: number }[];
    category_breakdown: { service: number; utility: number; marketing: number };
    total_messages: number;
    total_cost: number;
  };
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/admin/analytics', {
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });

      if (response.ok) {
        setData(await response.json());
      } else {
        setError('Access denied');
      }
    } catch {
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

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
          <Link href="/admin" className="nav-brand">← Admin</Link>
        </nav>
        <div className="container" style={{ paddingTop: '4rem', textAlign: 'center' }}>
          <div className="card" style={{ padding: '3rem' }}>
            <p style={{ color: 'var(--text-muted)' }}>{error || 'No data'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <nav className="nav">
        <Link href="/" className="nav-brand">LoyaltyQR</Link>
        <div className="nav-links">
          <Link href="/admin" className="nav-link">Dashboard</Link>
          <Link href="/admin/analytics" className="nav-link active">Analytics</Link>
        </div>
        <span className="badge badge-danger">Admin</span>
      </nav>

      <div className="container" style={{ padding: '1.5rem 1rem', maxWidth: '1400px' }}>
        <h1 className="page-title">Platform Analytics</h1>
        <p className="page-subtitle" style={{ marginBottom: '1.5rem' }}>
          Full platform-wide analytics and trends
        </p>

        {/* Top Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total Transactions', value: data.engagement.total_transactions, icon: '🧾', color: 'var(--primary)' },
            { label: 'Total Sales', value: formatCurrency(data.engagement.total_sales), icon: '💰', color: 'var(--warning)' },
            { label: 'Avg Completion', value: `${data.engagement.avg_completion_rate}%`, icon: '🏆', color: 'var(--accent)' },
            { label: 'Total Messages', value: data.whatsapp.total_messages, icon: '💬', color: '#a855f7' },
            { label: 'Total WA Cost', value: formatCurrency(data.whatsapp.total_cost), icon: '💸', color: 'var(--danger)' },
          ].map(stat => (
            <div key={stat.label} className="card stat-card">
              <div style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>{stat.icon}</div>
              <div className="stat-value" style={{ color: stat.color, fontSize: '1.4rem' }}>{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Acquisition Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>🏪 New Merchants / Month</h3>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={data.acquisition.new_merchants_per_month}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  />
                  <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} name="New Merchants" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>👥 New Customers / Month</h3>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={data.acquisition.new_customers_per_month}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  />
                  <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} name="New Customers" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Transactions Per Day */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>📊 Daily Transactions (90 days)</h3>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={data.engagement.transactions_per_day}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} interval={8} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />
                <Line type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={2} dot={false} name="Transactions" />
                <Line type="monotone" dataKey="amount" stroke="var(--warning)" strokeWidth={2} dot={false} name="Amount (₹)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* WhatsApp Messages Per Month */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>💬 WhatsApp Messages / Month</h3>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={data.whatsapp.messages_per_month}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />
                <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Messages" />
                <Bar dataKey="cost" fill="var(--warning)" radius={[4, 4, 0, 0]} name="Cost (₹)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom row: Popular Durations + Rewards + Cost Per Merchant */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Popular Durations */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>⏱️ Popular Durations</h3>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {data.engagement.popular_durations.map(d => (
                <div key={d.days} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{d.days} days</span>
                  <span style={{ fontWeight: 600 }}>{d.count} campaigns</span>
                </div>
              ))}
              {data.engagement.popular_durations.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No data</p>
              )}
            </div>
          </div>

          {/* Popular Rewards */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>🎁 Popular Rewards</h3>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {data.engagement.popular_rewards.slice(0, 5).map(r => (
                <div key={r.reward} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'capitalize', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.reward}
                  </span>
                  <span style={{ fontWeight: 600 }}>{r.count}×</span>
                </div>
              ))}
              {data.engagement.popular_rewards.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No data</p>
              )}
            </div>
          </div>

          {/* Cost Per Merchant */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>💸 WA Cost / Merchant</h3>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {data.whatsapp.cost_per_merchant.slice(0, 5).map(m => (
                <div key={m.shop_name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{m.shop_name}</span>
                  <span style={{ fontWeight: 600, color: 'var(--warning)' }}>{formatCurrency(m.cost)}</span>
                </div>
              ))}
              {data.whatsapp.cost_per_merchant.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No data</p>
              )}
            </div>
          </div>
        </div>

        {/* Message Category Breakdown */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>📱 Message Category Breakdown</h3>
          <div className="grid-3">
            <div className="stat-card card-static">
              <div className="stat-value" style={{ color: 'var(--primary)', fontSize: '1.5rem' }}>
                {data.whatsapp.category_breakdown.service}
              </div>
              <div className="stat-label">Service (Free)</div>
            </div>
            <div className="stat-card card-static">
              <div className="stat-value" style={{ color: 'var(--accent)', fontSize: '1.5rem' }}>
                {data.whatsapp.category_breakdown.utility}
              </div>
              <div className="stat-label">Utility (₹0.11)</div>
            </div>
            <div className="stat-card card-static">
              <div className="stat-value" style={{ color: 'var(--warning)', fontSize: '1.5rem' }}>
                {data.whatsapp.category_breakdown.marketing}
              </div>
              <div className="stat-label">Marketing (₹0.90)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
