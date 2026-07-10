'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { formatCurrency, generateQrToken } from '@/lib/utils';
import Link from 'next/link';
import QRCode from 'qrcode';
import type { Merchant, Campaign } from '@/types';

type PageState = 'input' | 'qr' | 'success' | 'expired';
type TxnMode = 'purchase' | 'return';

export default function TransactionPage() {
  const router = useRouter();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<TxnMode>('purchase');
  const [state, setState] = useState<PageState>('input');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [countdown, setCountdown] = useState(180);
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

  const isReturn = mode === 'return';

  const generateQR = async () => {
    if (!campaign || !merchant) return;
    if (campaign.campaign_type === 'amount' && !amount) return;

    setLoading(true);
    try {
      const supabase = createClient();
      const newToken = generateQrToken();
      const expiresAt = new Date(Date.now() + 180 * 1000).toISOString();

      // Store negative amount for returns
      const storedAmount = isReturn
        ? -Math.abs(Number(amount))
        : (campaign?.campaign_type === 'visits' ? 0 : Number(amount));

      const { error } = await supabase.from('qr_tokens').insert({
        token: newToken,
        merchant_id: merchant.id,
        campaign_id: campaign?.id || null, // null for points
        amount: storedAmount,
        expires_at: expiresAt,
      });

      if (error) {
        console.error('Failed to create QR token:', error);
        setLoading(false);
        return;
      }

      const scanUrl = `${window.location.origin}/scan/${newToken}`;
      const dataUrl = await QRCode.toDataURL(scanUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: isReturn ? '#dc2626' : '#000000',
          light: '#ffffff',
        },
      });

      setQrDataUrl(dataUrl);
      setCountdown(180);
      setState('qr');

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

      pollRef.current = setInterval(async () => {
        const { data: tokenData } = await supabase
          .from('qr_tokens')
          .select('used')
          .eq('token', newToken)
          .single();

        if (tokenData?.used) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          if (pollRef.current) clearInterval(pollRef.current);

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
    setCountdown(180);
    setScannedCustomer('');
    setMode('purchase');
  }, []);

  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (countdown / 180) * circumference;

  const isPointsMode = merchant?.loyalty_mechanism === 'points';

  if (!isPointsMode && !campaign) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
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
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <nav className="nav">
        <Link href="/merchant/dashboard" className="nav-brand">← Back</Link>
        <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
          {merchant?.shop_name}
        </span>
      </nav>

      <div className="container-sm" style={{ padding: '1.5rem 1rem' }}>
        {/* INPUT STATE */}
        {state === 'input' && (
          <div className="slide-up">
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>
                {isReturn ? 'Process Return' : 'New Transaction'}
              </h1>
              <p style={{ color: 'var(--text-secondary)' }}>
                {isPointsMode || campaign?.campaign_type === 'amount'
                  ? isReturn ? 'Enter refund amount' : 'Enter bill amount'
                  : 'Log a visit'}
              </p>
            </div>

            {/* Purchase / Return toggle — only for amount campaigns (and disabled for points) */}
            {!isPointsMode && campaign?.campaign_type === 'amount' && (
              <div
                style={{
                  display: 'flex',
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius-md)',
                  padding: '3px',
                  marginBottom: '1.5rem',
                  gap: '3px',
                  border: '1px solid var(--rule)',
                }}
                id="txn-mode-toggle"
              >
                <button
                  onClick={() => setMode('purchase')}
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    fontFamily: 'inherit',
                    background: mode === 'purchase' ? 'var(--ink)' : 'transparent',
                    color: mode === 'purchase' ? '#fff' : 'var(--muted)',
                  }}
                  id="toggle-purchase"
                >
                  + Purchase
                </button>
                <button
                  onClick={() => setMode('return')}
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    fontFamily: 'inherit',
                    background: mode === 'return' ? 'var(--red)' : 'transparent',
                    color: mode === 'return' ? '#fff' : 'var(--muted)',
                  }}
                  id="toggle-return"
                >
                  − Return
                </button>
              </div>
            )}

            <div
              className="card"
              style={{
                marginBottom: '1.5rem',
                textAlign: 'center',
                borderColor: isReturn ? 'rgba(220, 38, 38, 0.4)' : undefined,
                background: isReturn ? 'rgba(220, 38, 38, 0.03)' : undefined,
                transition: 'border-color 0.2s, background 0.2s',
              }}
            >
              {isPointsMode || campaign?.campaign_type === 'amount' ? (
                <>
                  <label className="label" style={{ textAlign: 'center', fontSize: '1rem' }}>
                    {isReturn ? 'Refund Amount' : 'Bill Amount'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute',
                      left: '1rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      color: isReturn ? 'var(--red)' : 'var(--muted)',
                    }}>
                      {isReturn ? '−₹' : '₹'}
                    </span>
                    <input
                      type="number"
                      className="input input-lg"
                      placeholder="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      autoFocus
                      min="1"
                      style={{
                        paddingLeft: '3rem',
                        borderColor: isReturn ? '#dc2626' : undefined,
                        color: isReturn ? '#dc2626' : undefined,
                        transition: 'border-color 0.2s, color 0.2s',
                      }}
                      id="amount-input"
                    />
                  </div>
                  {isReturn && amount && (
                    <p style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: '0.5rem', opacity: 0.8 }}>
                      This will subtract ₹{amount} from the customer&apos;s total
                    </p>
                  )}
                </>
              ) : (
                <div>
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏃</div>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Log a visit for this customer
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                if (!isPointsMode && campaign?.campaign_type === 'visits' && !amount) {
                  setAmount('0');
                }
                generateQR();
              }}
              className="btn btn-primary btn-full btn-lg"
              disabled={loading || ((isPointsMode || campaign?.campaign_type === 'amount') && !amount)}
              style={{
                background: isReturn ? 'var(--red)' : undefined,
              }}
              id="generate-qr-btn"
            >
              {loading ? (
                <>
                  <span className="spinner" /> Generating...
                </>
              ) : isReturn ? (
                '↩ Generate Return QR'
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
              {isReturn ? 'Return QR — Show to Customer' : 'Show to Customer'}
            </h2>
            <p style={{
              color: isReturn ? '#dc2626' : 'var(--text-secondary)',
              marginBottom: '1.5rem',
              fontWeight: isReturn ? 700 : 400,
            }}>
              {merchant?.loyalty_mechanism === 'points' || campaign?.campaign_type === 'amount'
                ? isReturn
                  ? `−${formatCurrency(Number(amount))} refund`
                  : `${formatCurrency(Number(amount))} transaction`
                : 'Visit log'}
            </p>

            <div
              className="qr-container"
              style={{
                margin: '0 auto 1.5rem',
                borderColor: isReturn ? 'rgba(220,38,38,0.4)' : undefined,
              }}
            >
              {qrDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt="Scan QR Code"
                  style={{ width: '250px', height: '250px' }}
                  id="qr-code-image"
                />
              )}
            </div>

            {isReturn && (
              <div style={{
                background: 'rgba(220, 38, 38, 0.08)',
                border: '1px solid rgba(220, 38, 38, 0.25)',
                borderRadius: '8px',
                padding: '0.6rem 1rem',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                color: '#dc2626',
              }}>
                ↩ Return / Refund QR
              </div>
            )}

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
                      stroke: countdown <= 10 ? 'var(--danger)' : (isReturn ? '#dc2626' : 'var(--primary)'),
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
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: isReturn ? 'var(--red-bg)' : 'var(--green-bg)',
              margin: '0 auto 1.5rem',
              border: `2.5px solid ${isReturn ? 'var(--red)' : 'var(--green)'}`,
              fontSize: '2.5rem',
            }}>
              {isReturn ? '↩' : '✅'}
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              {isReturn ? 'Return Processed!' : 'Transaction Recorded!'}
            </h2>
            <p style={{
              color: isReturn ? '#dc2626' : 'var(--text-secondary)',
              marginBottom: '0.5rem',
              fontWeight: isReturn ? 700 : 400,
            }}>
              {merchant?.loyalty_mechanism === 'points' || campaign?.campaign_type === 'amount'
                ? isReturn
                  ? `−${formatCurrency(Number(amount))} refunded`
                  : `${formatCurrency(Number(amount))} logged`
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
            <div style={{
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
            }}>
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
