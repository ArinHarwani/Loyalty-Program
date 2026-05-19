'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { generateMerchantCode } from '@/lib/utils';
import Link from 'next/link';

const CATEGORIES = [
  'Sweet Shop',
  'Restaurant',
  'Cafe',
  'Juice Stall',
  'Salon',
  'Clothing Store',
  'Bakery',
  'Grocery Store',
  'Pharmacy',
  'Electronics',
  'Other',
];

export default function OnboardingPage() {
  const router = useRouter();
  const [shopName, setShopName] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setUserEmail(user.email);
        // Check if merchant already exists
        supabase
          .from('merchants')
          .select('id')
          .eq('email', user.email)
          .single()
          .then(({ data }) => {
            if (data) {
              router.push('/merchant/dashboard');
            }
          });
      }
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName || !category) return;

    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const merchantCode = generateMerchantCode(shopName);

      const { error: insertError } = await supabase.from('merchants').insert({
        email: userEmail,
        shop_name: shopName,
        shop_category: category,
        merchant_code: merchantCode,
      });

      if (insertError) {
        setError(insertError.message);
      } else {
        router.push('/merchant/dashboard');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <nav className="nav">
        <Link href="/" className="nav-brand">LoyaltyQR</Link>
      </nav>

      <div className="container-sm" style={{ paddingTop: '3rem' }}>
        <div className="card slide-up" style={{ padding: '2.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🏪</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>
              Set Up Your Shop
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Tell us about your business to get started
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="label">Shop Name *</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Sharma Sweets"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                required
                autoFocus
                id="shop-name-input"
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label className="label">Category *</label>
              <select
                className="select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                id="category-select"
              >
                <option value="">Select category...</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading || !shopName || !category}
              id="create-shop-btn"
            >
              {loading ? (
                <>
                  <span className="spinner" /> Setting up...
                </>
              ) : (
                '🚀 Create My Shop'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
