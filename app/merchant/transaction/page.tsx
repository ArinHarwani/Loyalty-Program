'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { formatCurrency, generateQrToken } from '@/lib/utils';
import Link from 'next/link';
import QRCode from 'qrcode';
import type { Merchant, Campaign } from '@/types';

type PageState = 'input' | 'qr' | 'success' | 'expired';

export default function TransactionPage() {
  const router = useRouter();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [amount, setAmount] = useState('');
  const [state, setState] = useState<PageState>('input');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [token, setToken] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [loading, setLoading] = useState(false);
  const [scannedCustomer, setScannedCustomer] = useState('');
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        supabase
          .from('merchants')
          .select('*')
          .eq('email', user.email)
          .single()
          .then(({ data }) => {
            if (data) {
              setMerchant(data);
              // Get active campaign
              supabase
                .from('campaigns')
                .select('*')
                .eq('merchant_id', data.id)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1)
                .single()
                .then(({ data: campaignData }) => {
                  setCampaign(campaignData);
                });
            }
          });
      }
    });

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [router]);

  const generateQR = async () => {
    if (!amount || !campaign || !merchant) return;

    setLoading(true);
    try {
      const supabase = createClient();
      const newToken = generateQrToken();
      const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();

      // Insert QR token
      const { error } = await supabase.from('qr_tokens').insert({
        token: newToken,
        merchant_id: merchant.id,
        campaign_id: campaign.id,
        amount: Number(amount),
        expires_at: expiresAt,
      });

      if (error) {
        console.error('Failed to create QR token:', error);
        setLoading(false);
        return;
      }

      // Generate QR code
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const scanUrl = `${appUrl}/scan/${newToken}`;
      const dataUrl = await QRCode.toDataURL(scanUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });

      setToken(newToken);
      setQrDataUrl(dataUrl);
      setCountdown(60);
      setState('qr');

      // Start countdown
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            if (pollRef.current) clearInterval(pollRef.current);
            setState('expired');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Start polling for scan status
      pollRef.current = setInterval(async () => {
        const { data: tokenData } = await supabase
          .from('qr_tokens')
          .select('used')
          .eq('token', newToken)
          .single();

        if (tokenData?.used) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          if (pollRef.current) clearInterval(pollRef.current);

          // Get customer info
          const { data: txn } = await supabase
            .from('transactions')
            .select('*, enrollment:enrollments(*, customer:customers(*))')
            .eq('qr_token', newToken)
            .single();

          if (txn?.enrollment?.customer) {
            const phone = txn.enrollment.customer.whatsapp_number;
            setScannedCustomer(phone.slice(0, 5) + 'XXXXX');
          }
          setState('success');
        }
      }, 2000);
    } catch (err) {
      console.error('QR generation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const reset = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    setAmount('');
    setState('input');
    setQrDataUrl('');
    setToken('');
    setCountdown(60);
    setScannedCustomer('');
  }, []);

  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (countdown / 60) * circumference;

  if (!campaign) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <nav className="nav">
          <Link href="/merchant/dashboard" className="nav-brand">← Back</Link>
        </nav>
        <div className="container-sm" style={{ paddingTop: '4rem', textAlign: 'center' }}>
          <div className="card" style={{ padding: '3rem' }}>
            <div className="empty-state-icon">🎯</div>
            <h2 className="empty-state-title">No Active Campaign</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Create a campaign first to start recording transactions
            </p>
            <Link href="/merchant/campaign/new" className="btn btn-primary">
              + Create Campaign
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <nav className="nav">
        <Link href="/merchant/dashboard" className="nav-brand">← Back</Link>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {merchant?.shop_name}
        </span>
      </nav>

      <div className="container-sm" style={{ padding: '1.5rem 1rem' }}>
        {/* INPUT STATE */}
        {state === 'input' && (
          <div className="slide-up">
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>
                New Transaction
              </h1>
              <p style={{ color: 'var(--text-secondary)' }}>
                {campaign.campaign_type === 'amount' ? 'Enter bill amount' : 'Log a visit'}
              </p>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              {campaign.campaign_type === 'amount' ? (
                <>
                  <label className="label" style={{ textAlign: 'center', fontSize: '1rem' }}>
                    Bill Amount
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute',
                      left: '1rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                    }}>₹</span>
                    <input
                      type="number"
                      className="input input-lg"
                      placeholder="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      autoFocus
                      min="1"
                      style={{ paddingLeft: '2.5rem' }}
                      id="amount-input"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏃</div>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Log a visit for this customer
                  </p>
                  {/* For visits, amount defaults to 0 */}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                if (campaign.campaign_type === 'visits' && !amount) {
                  setAmount('0');
                }
                generateQR();
              }}
              className="btn btn-primary btn-full btn-lg"
              disabled={loading || (campaign.campaign_type === 'amount' && !amount)}
              id="generate-qr-btn"
            >
              {loading ? (
                <>
                  <span className="spinner" /> Generating...
                </>
              ) : (
                '📱 Generate QR Code'
              )}
            </button>
          </div>
        )}

        {/* QR STATE */}
        {state === 'qr' && (
          <div className="slide-up" style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Show to Customer
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              {campaign.campaign_type === 'amount'
                ? `${formatCurrency(Number(amount))} transaction`
                : 'Visit log'}
            </p>

            {/* QR Code */}
            <div className="qr-container" style={{ margin: '0 auto 1.5rem' }}>
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt="Scan QR Code"
                  style={{ width: '250px', height: '250px' }}
                  id="qr-code-image"
                />
              )}
            </div>

            {/* Countdown */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="countdown-ring">
                <svg width="80" height="80">
                  <circle className="bg" cx="40" cy="40" r="36" />
                  <circle
                    className="progress"
                    cx="40"
                    cy="40"
                    r="36"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{
                      stroke: countdown <= 10 ? 'var(--danger)' : 'var(--primary)',
                    }}
                  />
                </svg>
                <span
                  className="countdown-number"
                  style={{ color: countdown <= 10 ? 'var(--danger)' : 'var(--text-primary)' }}
                >
                  {countdown}
                </span>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600 }}>Waiting for scan...</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  QR expires in {countdown}s
                </div>
              </div>
            </div>

            <button onClick={reset} className="btn btn-secondary btn-full">
              Cancel
            </button>
          </div>
        )}

        {/* SUCCESS STATE */}
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
              ✅
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Transaction Recorded!
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              {campaign.campaign_type === 'amount'
                ? `${formatCurrency(Number(amount))} logged`
                : 'Visit logged'}
            </p>
            {scannedCustomer && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
                Customer: {scannedCustomer}
              </p>
            )}

            <div className="alert alert-success" style={{ marginBottom: '1.5rem', justifyContent: 'center' }}>
              💬 WhatsApp update sent to customer
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={reset} className="btn btn-primary" style={{ flex: 1 }}>
                + New Transaction
              </button>
              <Link href="/merchant/dashboard" className="btn btn-secondary" style={{ flex: 1 }}>
                Dashboard
              </Link>
            </div>
          </div>
        )}

        {/* EXPIRED STATE */}
        {state === 'expired' && (
          <div className="slide-up" style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.5rem',
                margin: '0 auto 1.5rem',
                border: '2px solid var(--danger)',
              }}
            >
              ⏰
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              QR Expired
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              The QR code has expired. Generate a new one.
            </p>

            <button onClick={reset} className="btn btn-primary btn-full btn-lg">
              🔄 Generate New QR
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
