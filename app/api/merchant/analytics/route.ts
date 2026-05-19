// ============================================================
// Analytics API — returns all analytics data for dashboard
// ============================================================

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { calcPercentage, daysRemaining } from '@/lib/utils';

async function getAuthUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();
    const { data: merchant } = await supabase
      .from('merchants')
      .select('*')
      .eq('email', user.email)
      .single();

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // Get all campaigns
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false });

    // Get all enrollments
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('*, customer:customers(*), campaign:campaigns(*)')
      .eq('merchant_id', merchant.id);

    // Get all transactions
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('scanned_at', { ascending: false });

    const allEnrollments = enrollments || [];
    const allTransactions = transactions || [];
    const allCampaigns = campaigns || [];

    // Active campaign
    const activeCampaign = allCampaigns.find((c) => c.status === 'active') || null;

    // Stats
    const totalCustomers = new Set(allEnrollments.map((e) => e.customer_id)).size;
    const totalTransactions = allTransactions.length;
    const totalRevenue = allTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const completed = allEnrollments.filter((e) => e.status === 'completed').length;
    const completionRate = allEnrollments.length > 0 ? Math.round((completed / allEnrollments.length) * 100) : 0;

    // Engagement funnel (for active campaign)
    const activeEnrollments = activeCampaign
      ? allEnrollments.filter((e) => e.campaign_id === activeCampaign.id)
      : allEnrollments;

    const funnelThresholds = [25, 50, 75, 100];
    const funnel = funnelThresholds.map((threshold) => {
      const count = activeEnrollments.filter((e) => {
        const target = activeCampaign?.campaign_type === 'amount'
          ? activeCampaign.target_amount || 1
          : activeCampaign?.target_visits || 1;
        const current = activeCampaign?.campaign_type === 'amount'
          ? e.total_spent
          : e.total_visits;
        return calcPercentage(current, target) >= threshold;
      }).length;
      return {
        label: `${threshold}%+`,
        count,
        percentage: activeEnrollments.length > 0 ? Math.round((count / activeEnrollments.length) * 100) : 0,
      };
    });

    // Customer segments
    const segments = [
      {
        name: 'Hot',
        count: activeEnrollments.filter((e) => {
          const target = activeCampaign?.campaign_type === 'amount'
            ? activeCampaign.target_amount || 1
            : activeCampaign?.target_visits || 1;
          const current = activeCampaign?.campaign_type === 'amount' ? e.total_spent : e.total_visits;
          return calcPercentage(current, target) >= 75 && e.status === 'active';
        }).length,
        color: '#ef4444',
      },
      {
        name: 'On Track',
        count: activeEnrollments.filter((e) => {
          const target = activeCampaign?.campaign_type === 'amount'
            ? activeCampaign.target_amount || 1
            : activeCampaign?.target_visits || 1;
          const current = activeCampaign?.campaign_type === 'amount' ? e.total_spent : e.total_visits;
          const pct = calcPercentage(current, target);
          return pct >= 40 && pct < 75 && e.status === 'active';
        }).length,
        color: '#10b981',
      },
      {
        name: 'At Risk',
        count: activeEnrollments.filter((e) => {
          const target = activeCampaign?.campaign_type === 'amount'
            ? activeCampaign.target_amount || 1
            : activeCampaign?.target_visits || 1;
          const current = activeCampaign?.campaign_type === 'amount' ? e.total_spent : e.total_visits;
          const pct = calcPercentage(current, target);
          const days = daysRemaining(e.deadline_at);
          return pct < 40 && days < 7 && e.status === 'active';
        }).length,
        color: '#f59e0b',
      },
      {
        name: 'Dormant',
        count: activeEnrollments.filter((e) => {
          const target = activeCampaign?.campaign_type === 'amount'
            ? activeCampaign.target_amount || 1
            : activeCampaign?.target_visits || 1;
          const current = activeCampaign?.campaign_type === 'amount' ? e.total_spent : e.total_visits;
          const pct = calcPercentage(current, target);
          const days = daysRemaining(e.deadline_at);
          return pct < 40 && days >= 7 && e.status === 'active';
        }).length,
        color: '#64748b',
      },
      {
        name: 'Expired',
        count: activeEnrollments.filter((e) => e.status === 'expired').length,
        color: '#94a3b8',
      },
    ];

    // Daily transactions (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentTxns = allTransactions.filter(
      (t) => new Date(t.scanned_at) >= thirtyDaysAgo
    );

    const dailyMap = new Map<string, { count: number; amount: number }>();
    recentTxns.forEach((t) => {
      const date = new Date(t.scanned_at).toISOString().split('T')[0];
      const existing = dailyMap.get(date) || { count: 0, amount: 0 };
      dailyMap.set(date, {
        count: existing.count + 1,
        amount: existing.amount + Number(t.amount),
      });
    });

    const dailyTransactions = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Peak hours
    const hourMap = new Map<number, number>();
    allTransactions.forEach((t) => {
      const hour = new Date(t.scanned_at).getHours();
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    });

    const peakHours = Array.from(hourMap.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour);

    // Winners
    const completedEnrollments = allEnrollments.filter((e) => e.status === 'completed');
    const winners = {
      total: completedEnrollments.length,
      claimed: completedEnrollments.filter((e) => e.claimed).length,
      unclaimed: completedEnrollments.filter((e) => !e.claimed).length,
    };

    // Campaign comparison
    const campaignComparison = allCampaigns.map((c) => {
      const campEnrollments = allEnrollments.filter((e) => e.campaign_id === c.id);
      return {
        id: c.id,
        name: c.name,
        type: c.campaign_type,
        customers: campEnrollments.length,
        completed: campEnrollments.filter((e) => e.status === 'completed').length,
        status: c.status,
      };
    });

    return NextResponse.json({
      campaign: activeCampaign,
      totalCustomers,
      totalTransactions,
      totalRevenue,
      completionRate,
      funnel,
      segments,
      dailyTransactions,
      peakHours,
      winners,
      campaignComparison,
    });
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
