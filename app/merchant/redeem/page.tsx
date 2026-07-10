'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface CustomerInfo {
  id: string;
  name: string | null;
  whatsapp_number: string;
}

interface PointsConfig {
  cashback_percentage: number;
  conversion_rate: number;
}

export default function RedeemPointsPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Step 1: Customer lookup
  const [whatsapp, setWhatsapp] = useState('');
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [balance, setBalance] = useState<number>(0);
  
  // Step 2: Redeem
  const [pointsToRedeem, setPointsToRedeem] = useState<string>('');
  const [conversionRate, setConversionRate] = useState<number>(1);
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  const lookupCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatsapp || whatsapp.length < 10) {
      setError('Please enter a valid 10-digit WhatsApp number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/merchant/points/balance?whatsapp=${encodeURIComponent(whatsapp)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to find customer');
      }

      if (!data.customer) {
        throw new Error('Customer not found or not registered yet.');
      }

      // Also need conversion rate, we can fetch config
      const configRes = await fetch('/api/merchant/points/config');
      if (configRes.ok) {
        const configData = await configRes.json();
        if (configData.config) {
          setConversionRate(Number(configData.config.conversion_rate));
        }
      }

      setCustomer(data.customer);
      setBalance(data.balance);
      setPointsToRedeem('');
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePointsChange = (val: string) => {
    setPointsToRedeem(val);
    const num = Number(val);
    if (!isNaN(num) && num > 0) {
      setDiscountAmount(Math.round(num * conversionRate));
    } else {
      setDiscountAmount(0);
    }
  };

  const handleRedeem = async () => {
    const numPoints = Number(pointsToRedeem);
    if (isNaN(numPoints) || numPoints <= 0) {
      setError('Please enter a valid amount of points to redeem');
      return;
    }

    if (numPoints > balance) {
      setError(`Cannot redeem more than the customer's balance (${balance} points)`);
      return;
    }

    if (!customer) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/merchant/points/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customer.id,
          points_to_redeem: numPoints,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to redeem points');
      }

      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <nav className="nav">
        <Link href="/merchant/dashboard" className="nav-brand">← Back</Link>
      </nav>

      <div className="container-md" style={{ padding: '1.5rem 1rem' }}>
        <h1 className="page-title" style={{ marginBottom: '0.25rem' }}>Redeem Points</h1>
        <p className="page-subtitle" style={{ marginBottom: '2rem' }}>
          Process a customer points redemption
        </p>

        {error && (
          <div style={{ 
            background: '#fee2e2', 
            color: '#991b1b', 
            padding: '1rem', 
            borderRadius: '8px', 
            marginBottom: '1.5rem',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        {/* STEP 1: Lookup */}
        {step === 1 && (
          <form onSubmit={lookupCustomer} className="card">
            <label className="label">Customer WhatsApp Number</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <span style={{ 
                padding: '0.75rem', 
                background: 'var(--bg-secondary)', 
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text-secondary)'
              }}>+91</span>
              <input
                type="tel"
                className="input"
                placeholder="9876543210"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, '').slice(0, 10))}
                required
              />
            </div>
            
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', marginTop: '1.5rem' }}
              disabled={loading || whatsapp.length < 10}
            >
              {loading ? 'Searching...' : 'Find Customer'}
            </button>
          </form>
        )}

        {/* STEP 2: Redeem */}
        {step === 2 && customer && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{customer.name || 'Customer'}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>+91 {customer.whatsapp_number}</div>
              </div>
              <button 
                onClick={() => setStep(1)}
                style={{ background: 'none', border: 'none', color: 'var(--brand)', fontWeight: 500, cursor: 'pointer' }}
              >
                Change
              </button>
            </div>

            <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '1.5rem', borderRadius: '8px', textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Available Balance</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--brand)' }}>{balance}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                Value: ₹{Math.round(balance * conversionRate)}
              </div>
            </div>

            {balance > 0 ? (
              <>
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <label className="label" style={{ marginBottom: 0 }}>Points to Redeem</label>
                    <button 
                      onClick={() => handlePointsChange(balance.toString())}
                      style={{ background: 'none', border: 'none', color: 'var(--brand)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }}
                    >
                      Redeem All
                    </button>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max={balance}
                    className="input"
                    value={pointsToRedeem}
                    onChange={(e) => handlePointsChange(e.target.value)}
                    placeholder="Enter points..."
                  />
                </div>

                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '1rem',
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{ fontWeight: 500 }}>Discount Amount:</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#166534' }}>
                    ₹{discountAmount}
                  </div>
                </div>

                <button
                  onClick={handleRedeem}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
                  disabled={loading || !pointsToRedeem || Number(pointsToRedeem) <= 0 || Number(pointsToRedeem) > balance}
                >
                  {loading ? 'Processing...' : 'Confirm Redemption'}
                </button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Customer has no points to redeem.</p>
                <button
                  onClick={() => router.push('/merchant/dashboard')}
                  className="btn btn-secondary"
                  style={{ marginTop: '1rem' }}
                >
                  Back to Dashboard
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Success */}
        {step === 3 && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
            <div style={{ 
              width: '64px', 
              height: '64px', 
              background: '#dcfce7', 
              color: '#166534', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: '2rem',
              margin: '0 auto 1.5rem auto'
            }}>
              ✓
            </div>
            
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Redemption Successful!
            </h2>
            
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Please provide a discount of <strong>₹{discountAmount}</strong> on the final bill.
            </p>

            <button
              onClick={() => router.push('/merchant/dashboard')}
              className="btn btn-primary"
              style={{ width: '100%', padding: '1rem' }}
            >
              Done
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
