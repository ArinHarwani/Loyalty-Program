'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { formatCurrency, maskPhone, calcPercentage, daysRemaining, formatDate, formatDateTime } from '@/lib/utils';
import type { Enrollment, Campaign, Merchant, Transaction } from '@/types';

export default function ProgressPage() {
  const params = useParams();
  const merchantId = params.merchantId as string;
  const whatsapp = params.whatsapp as string;

  const [loading, setLoading] = useState(true);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState('');

  const loadProgress = async () => {
    const supabase = createClient();

    // Get merchant
    const { data: merchantData } = await supabase
      .from('merchants')
      .select('*')
      .eq('id', merchantId)
      .single();

    if (!merchantData) {
      setError('Shop not found');
      setLoading(false);
      return;
    }
    setMerchant(merchantData);

    // Get enrollment
    const { data: enrollmentData } = await supabase
      .from('enrollments')
      .select('*, campaign:campaigns(*)')
      .eq('merchant_id', merchantId)
      .eq('customer_id', (
        await supabase
          .from('customers')
          .select('id')
          .eq('whatsapp_number', whatsapp)
          .single()
      ).data?.id || '')
      .order('enrolled_at', { ascending: false })
      .limit(1)
      .single();

    if (!enrollmentData) {
      setError('No enrollment found');
      setLoading(false);
      return;
    }

    setEnrollment(enrollmentData);
    setCampaign(enrollmentData.campaign);

    // Get transactions
    const { data: txnData } = await supabase
      .from('transactions')
      .select('*')
      .eq('enrollment_id', enrollmentData.id)
      .order('scanned_at', { ascending: false });

    setTransactions(txnData || []);
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProgress();
    }, 0);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>😔</div>
          <h2 style={{ fontWeight: 700 }}>{error}</h2>
        </div>
      </div>
    );
  }

  if (!enrollment || !campaign || !merchant) return null;

  const target = campaign.campaign_type === 'amount'
    ? campaign.target_amount || 0
    : campaign.target_visits || 0;
  const current = campaign.campaign_type === 'amount'
    ? enrollment.total_spent
    : enrollment.total_visits;
  const pct = calcPercentage(current, target);
  const days = daysRemaining(enrollment.deadline_at);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '1rem' }}>
      <div className="container-sm" style={{ paddingTop: '1rem' }}>
        {/* Shop header */}
        <div className="card slide-up" style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏪</div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{merchant.shop_name}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {merchant.shop_category} • {maskPhone(whatsapp)}
          </p>
        </div>

        {/* Status */}
        <div className="card" style={{ marginBottom: '1rem', textAlign: 'center' }}>
          <div
            className={`badge ${
              enrollment.status === 'completed'
                ? 'badge-success'
                : enrollment.status === 'expired'
                ? 'badge-danger'
                : 'badge-info'
            }`}
            style={{ marginBottom: '1rem' }}
          >
            {enrollment.status === 'completed' && '🎉 Goal Completed!'}
            {enrollment.status === 'expired' && '⏰ Expired'}
            {enrollment.status === 'active' && `🎯 ${days} days remaining`}
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: '1rem' }}>
            <div
              style={{
                fontSize: '2.5rem',
                fontWeight: 900,
                background: 'var(--gradient-primary)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: '0.25rem',
              }}
            >
              {pct}%
            </div>
            <div className="progress-bar" style={{ height: '16px', marginBottom: '0.75rem' }}>
              <div
                className="progress-fill"
                style={{
                  width: `${pct}%`,
                  background: enrollment.status === 'completed'
                    ? 'var(--gradient-primary)'
                    : 'var(--gradient-accent)',
                }}
              />
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {campaign.campaign_type === 'amount'
                ? `${formatCurrency(current)} / ${formatCurrency(target)}`
                : `${current} / ${target} visits`}
            </p>
          </div>

          {/* Campaign info */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              🎁 Reward
            </p>
            <p style={{ fontWeight: 700 }}>{campaign.reward_description}</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Deadline: {formatDate(enrollment.deadline_at)}
            </p>
          </div>
        </div>

        {/* Claim code */}
        {enrollment.status === 'completed' && enrollment.claim_code && (
          <div
            className="card"
            style={{
              marginBottom: '1rem',
              textAlign: 'center',
              borderColor: 'rgba(245, 158, 11, 0.3)',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05), rgba(16, 185, 129, 0.05))',
            }}
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              🏆 Your Claim Code
            </div>
            <div
              style={{
                fontSize: '2rem',
                fontWeight: 900,
                color: 'var(--warning)',
                letterSpacing: '0.05em',
              }}
            >
              {enrollment.claim_code}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              {enrollment.claimed
                ? '✅ Already claimed'
                : 'Show this code at the shop to claim your reward'}
            </p>
          </div>
        )}

        {/* Transaction history */}
        {transactions.length > 0 && (
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
              📋 Transaction History
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {transactions.map((txn, i) => {
                const isReturn = txn.amount < 0;
                return (
                  <div
                    key={txn.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.625rem 0.75rem',
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      borderLeft: isReturn ? '3px solid #dc2626' : '3px solid var(--primary)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', width: '24px' }}>
                        #{transactions.length - i}
                      </span>
                      <span style={{
                        fontWeight: 700,
                        color: isReturn ? '#dc2626' : 'var(--primary)',
                      }}>
                        {campaign.campaign_type === 'amount'
                          ? isReturn
                            ? `−${formatCurrency(Math.abs(txn.amount))}`
                            : `+${formatCurrency(txn.amount)}`
                          : 'Visit'}
                      </span>
                      {isReturn && (
                        <span style={{ fontSize: '0.7rem', color: '#dc2626', opacity: 0.7 }}>↩ return</span>
                      )}
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {formatDateTime(txn.scanned_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
