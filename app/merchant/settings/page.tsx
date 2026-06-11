'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import type { Merchant } from '@/types';
import { PLANS } from '@/lib/plans';

export default function MerchantSettingsPage() {
  const router = useRouter();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Status state
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        router.push('/merchant/login');
        return;
      }

      const { data: merchantData } = await supabase
        .from('merchants')
        .select('*')
        .eq('email', user.email)
        .single();

      if (merchantData) {
        setMerchant(merchantData);
      }
      setLoading(false);
    };
    
    loadData();
  }, [router]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Confirm password does not match new password.');
      return;
    }

    setPasswordLoading(true);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) {
        setError('You are not logged in.');
        return;
      }

      // Step 1: Re-authenticate to verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: currentPassword
      });

      if (signInError) {
        setError('Current password is incorrect.');
        setPasswordLoading(false);
        return;
      }

      // Step 2: Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        setError(updateError.message || 'Failed to update password.');
      } else {
        setSuccess('Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  const getPlanName = (planKey: string | null) => {
    if (!planKey) return 'None';
    if (planKey === 'custom') return 'Custom Plan';
    // @ts-expect-error - PLANS object indexed by string
    return PLANS[planKey]?.name || planKey;
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: '4rem' }}>
      <nav className="nav">
        <Link href="/merchant/dashboard" className="nav-brand">← Back to Dashboard</Link>
      </nav>

      <div className="container" style={{ paddingTop: '4rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '2rem' }}>
          ⚙️ Settings
        </h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
          {/* Section 1: Change Password */}
          <div className="card slide-up">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              Change Password
            </h2>
            
            <form onSubmit={handlePasswordChange}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="label">Current Password</label>
                <input 
                  type="password" 
                  className="input" 
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required 
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="label">New Password (min 8 characters)</label>
                <input 
                  type="password" 
                  className="input" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required 
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label className="label">Confirm New Password</label>
                <input 
                  type="password" 
                  className="input" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required 
                />
              </div>

              {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠️ {error}</div>}
              {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>✅ {success}</div>}

              <button 
                type="submit" 
                className="btn btn-primary btn-full"
                disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
              >
                {passwordLoading ? 'Updating...' : 'Change Password'}
              </button>
            </form>
          </div>

          {/* Section 2: Account Info (Read Only) */}
          <div className="card slide-up" style={{ animationDelay: '0.1s' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              Account Information
            </h2>
            
            {merchant ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label className="label" style={{ color: 'var(--text-muted)' }}>Shop Name</label>
                  <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{merchant.shop_name}</div>
                </div>
                <div>
                  <label className="label" style={{ color: 'var(--text-muted)' }}>Email Address</label>
                  <div style={{ fontWeight: 500 }}>{merchant.email}</div>
                </div>
                <div>
                  <label className="label" style={{ color: 'var(--text-muted)' }}>Member Since</label>
                  <div style={{ fontWeight: 500 }}>{formatDate(merchant.created_at)}</div>
                </div>
                <div>
                  <label className="label" style={{ color: 'var(--text-muted)' }}>Current Plan</label>
                  <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-primary">{getPlanName(merchant.subscription_plan)}</span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      Limit: {merchant.customer_limit?.toLocaleString() || 'Unlimited'} customers
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p>No merchant data found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
