'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency, isValidIndianPhone } from '@/lib/utils';
import type { Campaign, Merchant } from '@/types';

type PageState = 'loading' | 'error' | 'form' | 'redirecting';

export default function ScanPage() {
  const params = useParams();
  const token = params?.token as string;

  const [state, setState] = useState<PageState>('loading');
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [amount, setAmount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // Customer form
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [isReturning, setIsReturning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Auto-countdown for returning customers
  const [countdown, setCountdown] = useState(3);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const autoSubmitRef = useRef(false);

  const validateToken = async () => {
    try {
      const response = await fetch(`/api/scan/validate?token=${token}`);
      const data = await response.json();

      if (!response.ok) {
        setErrorMsg(data.error || 'Invalid QR code. Ask the shopkeeper for a new one.');
        setState('error');
        return;
      }

      const qrToken = data.qrToken;
      setMerchant(qrToken.merchant);
      setCampaign(qrToken.campaign);
      setAmount(qrToken.amount);

      // Check localStorage for returning customer (per-merchant key)
      const merchantId = qrToken.merchant?.id;
      if (merchantId) {
        try {
          const saved = localStorage.getItem(`wnum_${merchantId}`);
          if (saved && isValidIndianPhone(saved)) {
            setWhatsappNumber(saved);
            setIsReturning(true);
          }
        } catch (e) {
          // Ignore localStorage errors (e.g., Safari Private Mode)
          console.warn('localStorage is not available', e);
        }
      }

      setState('form');
    } catch {
      setErrorMsg('Something went wrong. Please try again.');
      setState('error');
    }
  };

  // Validate token on mount
  useEffect(() => {
    if (token) {
      const timer = setTimeout(() => {
        validateToken();
      }, 0);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const cancelAutoSubmit = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(0);
  };

  const handleSubmit = useCallback(async () => {
    if (submitting) return;

    if (!isValidIndianPhone(whatsappNumber)) {
      setErrorMsg('Please enter a valid 10-digit Indian phone number');
      return;
    }
    setErrorMsg('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/scan/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          whatsapp_number: whatsappNumber,
          birth_month: birthMonth ? Number(birthMonth) : undefined,
          birth_day: birthDay ? Number(birthDay) : undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Save to localStorage (per-merchant)
        try {
          localStorage.setItem(`wnum_${data.merchant_id}`, whatsappNumber);
        } catch (e) {
          console.warn('localStorage is not available', e);
        }

        // Switch to redirecting state
        setState('redirecting');

        // Redirect to WhatsApp after a brief delay
        const rawNumber = process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER || '';
        const businessNumber = rawNumber.replace(/\D/g, ''); // Strip +, spaces, parentheses
        const waUrl = `https://wa.me/${businessNumber}?text=TXN-${token}`;
        setTimeout(() => {
          window.location.href = waUrl;
        }, 800);
      } else {
        setErrorMsg(data.error || 'Something went wrong');
        setSubmitting(false);
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setSubmitting(false);
    }
  }, [whatsappNumber, birthMonth, birthDay, token, submitting]);

  // Start auto-countdown for returning customers
  useEffect(() => {
    if (state === 'form' && isReturning && !autoSubmitRef.current) {
      setCountdown(3);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            autoSubmitRef.current = true;
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isReturning]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    cancelAutoSubmit();
    handleSubmit();
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '1rem' }}>
      <div className="container-sm" style={{ paddingTop: '1rem' }}>

        {/* LOADING */}
        {state === 'loading' && (
          <div style={{ textAlign: 'center', paddingTop: '4rem' }}>
            <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto' }} />
            <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Validating QR code...</p>
          </div>
        )}

        {/* ERROR */}
        {state === 'error' && (
          <div className="card slide-up" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              QR Code Error
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{errorMsg}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Ask the shopkeeper to generate a new QR code
            </p>
          </div>
        )}

        {/* FORM — Registration / Returning */}
        {state === 'form' && merchant && campaign && (
          <div className="slide-up">
            {/* Shop info */}
            <div className="card" style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏪</div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{merchant.shop_name}</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {merchant.shop_category}
              </p>
            </div>

            {/* Campaign info */}
            <div className="card" style={{ marginBottom: '1rem', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
              <div style={{ textAlign: 'center' }}>
                <div className="badge badge-success" style={{ marginBottom: '0.75rem' }}>
                  🎯 {campaign.name || (campaign.campaign_type === 'amount' ? 'Spend & Win' : 'Visit & Win')}
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  Goal: {campaign.campaign_type === 'amount'
                    ? `Spend ${formatCurrency(campaign.target_amount || 0)} in ${campaign.duration_days} days`
                    : `${campaign.target_visits} visits in ${campaign.duration_days} days`}
                </p>
                <p style={{ color: 'var(--primary)', fontWeight: 600 }}>
                  🎁 {campaign.reward_description}
                </p>
              </div>
            </div>

            {/* Transaction amount banner */}
            <div
              className="card"
              style={{
                marginBottom: '1.5rem',
                textAlign: 'center',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))',
                borderColor: 'rgba(16, 185, 129, 0.4)',
              }}
            >
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                {campaign.campaign_type === 'amount' ? 'Amount being added' : 'Visit being logged'}
              </p>
              <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>
                {campaign.campaign_type === 'amount' ? formatCurrency(amount) : '✓ 1 Visit'}
              </p>
            </div>

            {/* Returning customer banner */}
            {isReturning && (
              <div
                className="card"
                style={{
                  marginBottom: '1rem',
                  textAlign: 'center',
                  borderColor: 'rgba(59, 130, 246, 0.3)',
                }}
              >
                <p style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                  Welcome back! 👋
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  WhatsApp: <strong>{whatsappNumber}</strong>
                </p>
                {countdown > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <p style={{ color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 600 }}>
                      Confirming in {countdown}...
                    </p>
                    <button
                      onClick={() => {
                        cancelAutoSubmit();
                        setIsReturning(false);
                        setWhatsappNumber('');
                        try {
                          localStorage.removeItem(`wnum_${merchant.id}`);
                        } catch (e) {
                          console.warn('localStorage is not available', e);
                        }
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        marginTop: '0.5rem',
                        textDecoration: 'underline',
                        fontFamily: 'inherit',
                      }}
                    >
                      Not you? Use a different number
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Customer form */}
            <form onSubmit={handleFormSubmit}>
              {/* WhatsApp input (always shown but pre-filled for returning) */}
              {!isReturning && (
                <div className="card" style={{ marginBottom: '1rem' }}>
                  <label className="label">WhatsApp Number *</label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="9876543210"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    required
                    autoFocus
                    maxLength={10}
                    id="whatsapp-input"
                  />
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                    You&apos;ll receive progress updates on this number
                  </p>
                </div>
              )}

              {/* Birthday fields (hidden for returning customers) */}
              {!isReturning && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                  <label className="label">Birthday (optional — for birthday rewards!)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <select
                      className="select"
                      value={birthMonth}
                      onChange={(e) => setBirthMonth(e.target.value)}
                    >
                      <option value="">Month</option>
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(
                        (m, i) => (
                          <option key={m} value={i + 1}>
                            {m}
                          </option>
                        )
                      )}
                    </select>
                    <select
                      className="select"
                      value={birthDay}
                      onChange={(e) => setBirthDay(e.target.value)}
                    >
                      <option value="">Day</option>
                      {Array.from({ length: 31 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', marginBottom: '1.25rem', lineHeight: '1.4' }}>
                By continuing, you consent to receive WhatsApp loyalty updates from this shop and agree to our{' '}
                <Link href="/terms" target="_blank" style={{ color: 'var(--primary-light)', textDecoration: 'underline' }}>
                  Terms of Use
                </Link>{' '}
                and{' '}
                <Link href="/privacy" target="_blank" style={{ color: 'var(--primary-light)', textDecoration: 'underline' }}>
                  Privacy Policy
                </Link>.
              </p>

              {errorMsg && (
                <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-whatsapp btn-full btn-lg"
                id="confirm-whatsapp-btn"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <div className="spinner" style={{ width: 20, height: 20 }} />
                    Processing...
                  </>
                ) : (
                  '💬 Confirm on WhatsApp →'
                )}
              </button>
            </form>
          </div>
        )}

        {/* REDIRECTING */}
        {state === 'redirecting' && (
          <div className="slide-up" style={{ textAlign: 'center', paddingTop: '3rem' }}>
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.5rem',
                margin: '0 auto 1.5rem',
                border: '2px solid var(--primary)',
              }}
            >
              ✅
            </div>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Almost done!
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Opening WhatsApp... Just tap Send to confirm your transaction.
            </p>

            <div className="spinner" style={{ width: 30, height: 30, margin: '0 auto 1.5rem' }} />

            <a
              href={`https://wa.me/${(process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER || '').replace(/\D/g, '')}?text=TXN-${token}`}
              className="btn btn-whatsapp btn-full btn-lg"
              style={{ textDecoration: 'none', marginBottom: '1rem' }}
            >
              💬 Tap here if WhatsApp didn&apos;t open
            </a>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              After sending the message, you&apos;ll receive your progress update on WhatsApp
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
