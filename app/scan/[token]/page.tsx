'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { formatCurrency, isValidIndianPhone, calcPercentage, daysRemaining } from '@/lib/utils';
import type { Campaign, Merchant } from '@/types';

type PageState = 'loading' | 'invalid' | 'form' | 'confirm' | 'processing' | 'success';

export default function ScanPage() {
  const params = useParams();
  const token = params.token as string;

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


  useEffect(() => {
    validateToken();
    // Check localStorage for returning customer
    const saved = localStorage.getItem('loyaltyqr_phone');
    if (saved) {
      setWhatsappNumber(saved);
      setIsReturning(true);
    }
  }, []);

  const validateToken = async () => {
    const supabase = createClient();
    const { data: qrToken, error } = await supabase
      .from('qr_tokens')
      .select('*, merchant:merchants(*), campaign:campaigns(*)')
      .eq('token', token)
      .single();

    if (error || !qrToken) {
      setErrorMsg('Invalid QR code.');
      setState('invalid');
      return;
    }

    if (qrToken.used) {
      setErrorMsg('This QR code has already been used.');
      setState('invalid');
      return;
    }

    if (new Date(qrToken.expires_at) < new Date()) {
      setErrorMsg('This QR code has expired. Ask the shop for a new one.');
      setState('invalid');
      return;
    }

    setMerchant(qrToken.merchant);
    setCampaign(qrToken.campaign);
    setAmount(qrToken.amount);

    // If returning customer, skip to confirm
    const saved = localStorage.getItem('loyaltyqr_phone');
    if (saved) {
      setState('confirm');
    } else {
      setState('form');
    }
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidIndianPhone(whatsappNumber)) {
      setErrorMsg('Please enter a valid 10-digit Indian phone number');
      return;
    }
    setErrorMsg('');
    // Save to localStorage
    localStorage.setItem('loyaltyqr_phone', whatsappNumber);
    setState('confirm');
  };

  const handleConfirm = async () => {
    setState('processing');
    try {
      const response = await fetch('/api/scan', {
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
        setState('success');
      } else {
        setErrorMsg(data.message || 'Something went wrong');
        setState('invalid');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setState('invalid');
    }
  };

  // Open WhatsApp with pre-filled message
  const openWhatsApp = () => {
    const businessNumber = process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER || '';
    const waUrl = `https://wa.me/${businessNumber}?text=TXN-${token}`;
    window.open(waUrl, '_blank');
    
    // Process API to save profile, then show success state
    handleConfirm();
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

        {/* INVALID */}
        {state === 'invalid' && (
          <div className="card slide-up" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              QR Code Error
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>{errorMsg}</p>
          </div>
        )}

        {/* FORM — First time customer */}
        {state === 'form' && merchant && campaign && (
          <div className="slide-up">
            {/* Shop info */}
            <div className="card" style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏪</div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{merchant.shop_name}</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {merchant.shop_category}
              </p>
            </div>

            {/* Campaign + amount */}
            <div className="card" style={{ marginBottom: '1rem', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
              <div style={{ textAlign: 'center' }}>
                <div className="badge badge-success" style={{ marginBottom: '0.75rem' }}>
                  {campaign.campaign_type === 'amount' ? '💰 Amount Campaign' : '🏃 Visit Campaign'}
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>
                  {campaign.campaign_type === 'amount'
                    ? formatCurrency(amount)
                    : 'Visit Logged'}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Goal: {campaign.campaign_type === 'amount'
                    ? `Spend ${formatCurrency(campaign.target_amount || 0)}`
                    : `${campaign.target_visits} visits`}
                  {' '}in {campaign.duration_days} days
                </p>
                <p style={{ color: 'var(--primary)', fontWeight: 600, marginTop: '0.5rem' }}>
                  🎁 {campaign.reward_description}
                </p>
              </div>
            </div>

            {/* Customer form */}
            <form onSubmit={handleSubmitForm}>
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

              {errorMsg && (
                <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-whatsapp btn-full btn-lg"
                id="confirm-whatsapp-btn"
              >
                💬 Continue with WhatsApp
              </button>
            </form>
          </div>
        )}

        {/* CONFIRM — Returning customer */}
        {state === 'confirm' && merchant && campaign && (
          <div className="slide-up" style={{ textAlign: 'center' }}>
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏪</div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{merchant.shop_name}</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                {campaign.campaign_type === 'amount'
                  ? `${formatCurrency(amount)} being added`
                  : 'Visit being logged'}
              </p>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                Your number
              </p>
              <p style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {whatsappNumber}
              </p>
              {isReturning && (
                <button
                  onClick={() => {
                    localStorage.removeItem('loyaltyqr_phone');
                    setWhatsappNumber('');
                    setIsReturning(false);
                    setState('form');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    marginTop: '0.5rem',
                    fontFamily: 'inherit',
                  }}
                >
                  Use a different number
                </button>
              )}
            </div>

            <button
              onClick={openWhatsApp}
              className="btn btn-whatsapp btn-full btn-lg"
              id="send-whatsapp-btn"
            >
              💬 Confirm via WhatsApp
            </button>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '1rem' }}>
              Tapping this will open WhatsApp with a pre-filled message
            </p>
          </div>
        )}

        {/* PROCESSING */}
        {state === 'processing' && (
          <div style={{ textAlign: 'center', paddingTop: '4rem' }}>
            <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto' }} />
            <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Processing transaction...</p>
          </div>
        )}

        {/* SUCCESS */}
        {state === 'success' && (
          <div className="slide-up" style={{ textAlign: 'center' }}>
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
              💬
            </div>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Check your WhatsApp!
            </h2>
            
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              We have sent your progress update directly to your phone.
            </p>

            <div className="alert alert-success" style={{ justifyContent: 'center' }}>
              ✅ You can now close this page
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
