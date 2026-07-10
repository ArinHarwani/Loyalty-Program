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
  const [customerName, setCustomerName] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [isReturning, setIsReturning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Auto-countdown for returning customers
  const [countdown, setCountdown] = useState(3);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const autoSubmitRef = useRef(false);

  // QR expiry countdown (3 minutes = 180 seconds)
  const [qrSecondsLeft, setQrSecondsLeft] = useState(180);
  const qrTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Stored WhatsApp URL from API
  const [whatsappUrl, setWhatsappUrl] = useState('');

  const validateToken = async () => {
    try {
      const response = await fetch(`/api/scan/validate?token=${token}`);
      const data = await response.json();

      if (!response.ok) {
        setErrorMsg(data.error || 'This QR code is not valid. Ask the shopkeeper for a new one.');
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
          console.warn('localStorage is not available', e);
        }
      }

      setState('form');

      // Start QR expiry countdown (3 minutes)
      qrTimerRef.current = setInterval(() => {
        setQrSecondsLeft(prev => {
          if (prev <= 1) {
            if (qrTimerRef.current) clearInterval(qrTimerRef.current);
            setState('error');
            setErrorMsg('This QR code has expired. Ask the shopkeeper to generate a new one.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setErrorMsg('Something went wrong. Please try again.');
      setState('error');
    }
  };

  useEffect(() => {
    return () => {
      if (qrTimerRef.current) clearInterval(qrTimerRef.current);
    };
  }, []);

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
      setErrorMsg('Please enter a valid 10-digit WhatsApp number');
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
          name: customerName.trim() || undefined,
          birth_month: birthMonth ? Number(birthMonth) : undefined,
          birth_day: birthDay ? Number(birthDay) : undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (qrTimerRef.current) clearInterval(qrTimerRef.current);

        try {
          localStorage.setItem(`wnum_${data.merchant_id}`, whatsappNumber);
        } catch (e) {
          console.warn('localStorage is not available', e);
        }

        const waUrl = data.whatsapp_url || `https://wa.me/?text=TXN-${token}`;
        setWhatsappUrl(waUrl);
        setState('redirecting');

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
  }, [whatsappNumber, customerName, birthMonth, birthDay, token, submitting]);

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

  const qrMins = Math.floor(qrSecondsLeft / 60);
  const qrSecs = String(qrSecondsLeft % 60).padStart(2, '0');
  const qrUrgent = qrSecondsLeft <= 30;
  const qrWarning = qrSecondsLeft <= 60 && !qrUrgent;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', padding: '1rem 1rem 3rem' }}>
      <div className="container-sm" style={{ paddingTop: '1.5rem' }}>

        {/* ── LOADING ── */}
        {state === 'loading' && (
          <div style={{ textAlign: 'center', paddingTop: '5rem' }}>
            <span className="spinner" style={{ width: 32, height: 32 }} />
            <p style={{ color: 'var(--muted)', marginTop: '1rem', fontSize: '0.95rem' }}>
              Checking QR code…
            </p>
          </div>
        )}

        {/* ── ERROR ── */}
        {state === 'error' && (
          <div style={{
            background: '#FFFFFF',
            border: '1.5px solid var(--rule-dark)',
            borderRadius: 'var(--radius-lg)',
            padding: '2.5rem 2rem',
            textAlign: 'center',
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'var(--red-bg)',
              marginBottom: '1.25rem',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--charcoal)', marginBottom: '0.6rem' }}>
              QR Code Not Valid
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>{errorMsg}</p>
          </div>
        )}

        {/* ── FORM ── */}
        {state === 'form' && merchant && (merchant.loyalty_mechanism === 'points' || campaign) && (
          <div>

            {/* Shop Header */}
            <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              <h1 style={{
                fontSize: '1.6rem',
                fontWeight: 800,
                color: 'var(--ink)',
                marginBottom: '0.2rem',
                letterSpacing: '-0.02em',
              }}>
                {merchant.shop_name}
              </h1>
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{merchant.shop_category}</p>
            </div>

            {/* Receipt — Bill Amount */}
            <div className="receipt" style={{ marginBottom: '1.25rem', textAlign: 'center' }}>
              <p className="receipt-label">
                {merchant.loyalty_mechanism === 'points' || campaign?.campaign_type === 'amount'
                  ? 'Bill Amount'
                  : 'Visit Being Logged'}
              </p>
              <p className="receipt-amount">
                {merchant.loyalty_mechanism === 'points' || campaign?.campaign_type === 'amount'
                  ? formatCurrency(amount)
                  : '1 Visit'}
              </p>
              {merchant.loyalty_mechanism === 'points' ? (
                <>
                  <hr className="receipt-divider" />
                  <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                    Earn cashback points on this purchase
                  </p>
                </>
              ) : campaign ? (
                <>
                  <hr className="receipt-divider" />
                  <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                    Reward: <strong style={{ color: 'var(--green)' }}>{campaign.reward_description}</strong>
                  </p>
                </>
              ) : null}
            </div>

            {/* QR Timer */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '1.25rem',
            }}>
              <span style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: qrUrgent ? 'var(--red)' : qrWarning ? '#A0640A' : 'var(--muted)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                QR expires in {qrMins}:{qrSecs}
              </span>
            </div>

            {/* Returning Customer Banner */}
            {isReturning && (
              <div style={{
                background: '#FFFFFF',
                border: '1px solid var(--rule)',
                borderRadius: 'var(--radius-lg)',
                padding: '1rem 1.25rem',
                marginBottom: '1.25rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--charcoal)', marginBottom: '0.15rem' }}>
                      Welcome back!
                    </p>
                    <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
                      WhatsApp: <strong style={{ color: 'var(--charcoal)' }}>{whatsappNumber}</strong>
                    </p>
                  </div>
                  {countdown > 0 && (
                    <span style={{
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: 'var(--ink)',
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                      marginLeft: '1rem',
                    }}>
                      {countdown}s
                    </span>
                  )}
                </div>
                {countdown > 0 && (
                  <button
                    onClick={() => {
                      cancelAutoSubmit();
                      setIsReturning(false);
                      setWhatsappNumber('');
                      try { localStorage.removeItem(`wnum_${merchant.id}`); } catch (e) { console.warn(e); }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--muted)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      marginTop: '0.6rem',
                      textDecoration: 'underline',
                      fontFamily: 'inherit',
                      padding: 0,
                    }}
                  >
                    Not you? Use a different number
                  </button>
                )}
              </div>
            )}

            {/* Customer Form */}
            <form onSubmit={handleFormSubmit}>
              {!isReturning && (
                <>
                  {/* WhatsApp Number */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label className="label" htmlFor="whatsapp-input">WhatsApp Number *</label>
                    <input
                      type="tel"
                      className="input"
                      id="whatsapp-input"
                      placeholder="9876543210"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      required
                      autoFocus
                      maxLength={10}
                    />
                    <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
                      You&apos;ll receive progress updates on this number
                    </p>
                  </div>

                  {/* Name */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label className="label" htmlFor="name-input">Your Name *</label>
                    <input
                      type="text"
                      className="input"
                      id="name-input"
                      placeholder="e.g. Rahul"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      maxLength={60}
                      required
                    />
                  </div>

                  {/* Birthday */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label className="label">Birthday (optional — for birthday rewards)</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <select
                        className="select"
                        value={birthMonth}
                        onChange={(e) => setBirthMonth(e.target.value)}
                      >
                        <option value="">Month</option>
                        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(
                          (m, i) => (
                            <option key={m} value={i + 1}>{m}</option>
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
                          <option key={i + 1} value={i + 1}>{i + 1}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Error */}
              {errorMsg && (
                <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                  {errorMsg}
                </div>
              )}

              {/* Terms */}
              <p style={{ color: 'var(--muted)', fontSize: '0.75rem', textAlign: 'center', marginBottom: '1rem', lineHeight: 1.5 }}>
                By continuing, you agree to receive WhatsApp loyalty updates from this shop and our{' '}
                <Link href="/terms" target="_blank" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>Terms</Link>
                {' '}and{' '}
                <Link href="/privacy" target="_blank" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>Privacy Policy</Link>.
              </p>

              {/* Submit */}
              <button
                type="submit"
                className="btn btn-whatsapp btn-full btn-lg"
                id="confirm-whatsapp-btn"
                disabled={submitting}
                style={{ fontSize: '1.05rem', fontWeight: 700 }}
              >
                {submitting ? (
                  <>
                    <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    Processing…
                  </>
                ) : (
                  'Confirm on WhatsApp →'
                )}
              </button>
            </form>
          </div>
        )}

        {/* ── REDIRECTING ── */}
        {state === 'redirecting' && (
          <div style={{ textAlign: 'center', paddingTop: '4rem' }}>
            {/* Success circle */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 72,
              height: 72,
              borderRadius: '50%',
              border: '2.5px solid var(--green)',
              background: 'var(--green-bg)',
              marginBottom: '1.5rem',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--ink)', marginBottom: '0.5rem' }}>
              Almost done!
            </h2>
            <p style={{ color: 'var(--muted)', marginBottom: '1.75rem', fontSize: '0.95rem' }}>
              Opening WhatsApp — tap Send to confirm your transaction.
            </p>

            <span className="spinner" style={{ width: 28, height: 28, display: 'block', margin: '0 auto 1.5rem' }} />

            <a
              href={whatsappUrl || `https://wa.me/?text=TXN-${token}`}
              className="btn btn-whatsapp btn-full btn-lg"
              style={{ textDecoration: 'none' }}
            >
              Tap here if WhatsApp didn&apos;t open
            </a>

            <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '1rem' }}>
              After sending, you&apos;ll receive your points update on WhatsApp.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
