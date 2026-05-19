'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import type { AnalyticsData } from '@/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch('/api/merchant/analytics', {
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });

      if (response.ok) {
        const analyticsData = await response.json();
        setData(analyticsData);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
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

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <nav className="nav">
          <Link href="/merchant/dashboard" className="nav-brand">← Back</Link>
        </nav>
        <div className="container" style={{ paddingTop: '4rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>Failed to load analytics</p>
        </div>
      </div>
    );
  }

  const segmentColors = data.segments.map((s) => s.color);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <nav className="nav">
        <Link href="/merchant/dashboard" className="nav-brand">← Dashboard</Link>
      </nav>

      <div className="container" style={{ padding: '1.5rem 1rem' }}>
        <h1 className="page-title">Analytics</h1>
        <p className="page-subtitle" style={{ marginBottom: '1.5rem' }}>
          {data.campaign?.name || 'All Campaigns'}
        </p>

        {/* Overview Stats */}
        <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
          {[
            { label: 'Customers', value: data.totalCustomers, color: 'var(--primary)', icon: '👥' },
            { label: 'Transactions', value: data.totalTransactions, color: 'var(--accent)', icon: '📊' },
            { label: 'Revenue', value: formatCurrency(data.totalRevenue), color: 'var(--warning)', icon: '💰' },
            { label: 'Completion', value: `${data.completionRate}%`, color: '#a855f7', icon: '🎯' },
          ].map((stat) => (
            <div key={stat.label} className="card stat-card">
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{stat.icon}</div>
              <div className="stat-value" style={{ color: stat.color }}>{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Engagement Funnel */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
            📊 Engagement Funnel
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {data.funnel.map((level, i) => (
              <div key={level.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{level.label}</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {level.count} ({level.percentage}%)
                  </span>
                </div>
                <div className="progress-bar" style={{ height: '8px' }}>
                  <div
                    style={{
                      width: `${level.percentage}%`,
                      height: '100%',
                      borderRadius: 'var(--radius-full)',
                      background: `hsl(${160 - i * 20}, 70%, 50%)`,
                      transition: 'width 1s ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Customer Segments */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
            🎯 Customer Segments
          </h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {data.segments.map((seg) => (
              <div
                key={seg.name}
                style={{
                  flex: '1 1 auto',
                  minWidth: '100px',
                  padding: '1rem',
                  background: `${seg.color}15`,
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                  border: `1px solid ${seg.color}30`,
                }}
              >
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: seg.color }}>
                  {seg.count}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {seg.name}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Transactions Chart */}
        {data.dailyTransactions.length > 0 && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
              📈 Daily Transactions (Last 30 Days)
            </h3>
            <div style={{ height: '250px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.dailyTransactions}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickFormatter={(val) => new Date(val).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                    }}
                    labelFormatter={(val) => new Date(val).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {data.dailyTransactions.map((_, index) => (
                      <Cell key={index} fill="var(--primary)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Peak Hours */}
        {data.peakHours.length > 0 && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
              🕐 Peak Hours
            </h3>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '120px' }}>
              {Array.from({ length: 24 }, (_, hour) => {
                const hourData = data.peakHours.find((h) => h.hour === hour);
                const count = hourData?.count || 0;
                const maxCount = Math.max(...data.peakHours.map((h) => h.count), 1);
                const height = (count / maxCount) * 100;

                return (
                  <div
                    key={hour}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      height: '100%',
                    }}
                    title={`${hour}:00 — ${count} transactions`}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: `${Math.max(height, 2)}%`,
                        background: count > 0
                          ? `hsl(${160 - (height / 100) * 60}, 70%, ${40 + (height / 100) * 20}%)`
                          : 'var(--bg-surface)',
                        borderRadius: '2px 2px 0 0',
                        transition: 'height 0.5s ease',
                      }}
                    />
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {hour % 6 === 0 ? `${hour}h` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Winners Tracker */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
            🏆 Winners
          </h3>
          <div className="grid-3">
            <div className="stat-card card-static">
              <div className="stat-value" style={{ color: 'var(--primary)' }}>{data.winners.total}</div>
              <div className="stat-label">Total</div>
            </div>
            <div className="stat-card card-static">
              <div className="stat-value" style={{ color: 'var(--accent)' }}>{data.winners.claimed}</div>
              <div className="stat-label">Claimed</div>
            </div>
            <div className="stat-card card-static">
              <div className="stat-value" style={{ color: 'var(--warning)' }}>{data.winners.unclaimed}</div>
              <div className="stat-label">Unclaimed</div>
            </div>
          </div>
        </div>

        {/* Campaign Comparison */}
        {data.campaignComparison.length > 0 && (
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
              📋 Campaign Comparison
            </h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Type</th>
                    <th>Customers</th>
                    <th>Completed</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.campaignComparison.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td>{c.type === 'amount' ? '💰' : '🏃'} {c.type}</td>
                      <td>{c.customers}</td>
                      <td>{c.completed}</td>
                      <td>
                        <span className={`badge ${c.status === 'active' ? 'badge-success' : 'badge-muted'}`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
