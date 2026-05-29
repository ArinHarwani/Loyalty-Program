// ============================================================
// Admin — Platform-Wide Analytics API
// ============================================================

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email || user.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const service = createServiceClient();
    const now = new Date();

    // Fetch all data
    const { data: merchants } = await service.from('merchants').select('*');
    const { data: customers } = await service.from('customers').select('*');
    const { data: campaigns } = await service.from('campaigns').select('*');
    const { data: enrollments } = await service.from('enrollments').select('*');
    const { data: transactions } = await service.from('transactions').select('*');
    const { data: messageLogs } = await service.from('message_logs').select('*');
    const { data: subscriptions } = await service.from('subscriptions').select('*');

    const allMerchants = merchants || [];
    const allCustomers = customers || [];
    const allCampaigns = campaigns || [];
    const allEnrollments = enrollments || [];
    const allTransactions = transactions || [];
    const allLogs = messageLogs || [];
    const allSubscriptions = subscriptions || [];

    // Acquisition — new merchants per month (12 months)
    const newMerchantsPerMonth: { month: string; count: number }[] = [];
    const newCustomersPerMonth: { month: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = d.toISOString();
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

      newMerchantsPerMonth.push({
        month: label,
        count: allMerchants.filter(m => m.created_at >= monthStart && m.created_at < nextMonth).length,
      });

      newCustomersPerMonth.push({
        month: label,
        count: allCustomers.filter(c => c.created_at >= monthStart && c.created_at < nextMonth).length,
      });
    }

    // Engagement — transactions per day (last 90 days)
    const transactionsPerDay: { date: string; count: number; amount: number }[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split('T')[0];

      const dayTxns = allTransactions.filter(t => t.scanned_at.startsWith(dayStr));
      transactionsPerDay.push({
        date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        count: dayTxns.length,
        amount: dayTxns.reduce((s, t) => s + Number(t.amount), 0),
      });
    }

    // Campaign analytics
    const completedEnrollments = allEnrollments.filter(e => e.status === 'completed').length;
    const totalEnrollments = allEnrollments.length;
    const avgCompletionRate = totalEnrollments > 0
      ? Math.round((completedEnrollments / totalEnrollments) * 100)
      : 0;

    // Duration popularity
    const durationCounts = allCampaigns.reduce((acc, c) => {
      acc[c.duration_days] = (acc[c.duration_days] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const popularDurations = Object.entries(durationCounts as Record<string, number>)
      .map(([days, count]) => ({ days: Number(days), count: Number(count) }))
      .sort((a, b) => b.count - a.count);

    // Reward popularity
    const rewardCounts = allCampaigns.reduce((acc, c) => {
      const reward = c.reward_description.toLowerCase().trim();
      acc[reward] = (acc[reward] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const popularRewards = Object.entries(rewardCounts as Record<string, number>)
      .map(([reward, count]) => ({ reward, count: Number(count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // WhatsApp analytics — messages per month
    const messagesPerMonth: { month: string; count: number; cost: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = d.toISOString();
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

      const monthLogs = allLogs.filter(l => l.sent_at >= monthStart && l.sent_at < nextMonth);
      messagesPerMonth.push({
        month: label,
        count: monthLogs.length,
        cost: monthLogs.reduce((s, l) => s + Number(l.cost), 0),
      });
    }

    // Cost per merchant
    const costPerMerchant = allMerchants
      .map(m => ({
        shop_name: m.shop_name,
        cost: allLogs
          .filter(l => l.merchant_id === m.id)
          .reduce((s, l) => s + Number(l.cost), 0),
      }))
      .sort((a, b) => b.cost - a.cost);

    // Category breakdown
    const categoryBreakdown = {
      service: allLogs.filter(l => l.category === 'service').length,
      utility: allLogs.filter(l => l.category === 'utility').length,
      marketing: allLogs.filter(l => l.category === 'marketing').length,
    };

    // Calculate revenue stats
    const totalRevenue = allSubscriptions.reduce((s, sub) => s + Number(sub.price), 0);
    const mrr = allSubscriptions
      .filter(s => s.status === 'active')
      .reduce((s, sub) => s + Number(sub.price), 0);
      
    // Revenue by plan
    const revenueByPlan = allSubscriptions.reduce((acc, sub) => {
      acc[sub.plan_name] = (acc[sub.plan_name] || 0) + Number(sub.price);
      return acc;
    }, {} as Record<string, number>);

    // Upcoming renewals (next 30 days)
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const upcomingRenewalsStr = thirtyDaysFromNow.toISOString().split('T')[0];
    
    const upcomingRenewals = allMerchants
      .filter(m => 
        m.subscription_status === 'active' && 
        m.subscription_end_date && 
        m.subscription_end_date <= upcomingRenewalsStr
      )
      .map(m => ({
        shop_name: m.shop_name,
        end_date: m.subscription_end_date,
        plan: m.subscription_plan,
      }))
      .sort((a, b) => (a.end_date || '').localeCompare(b.end_date || ''));

    return NextResponse.json({
      acquisition: {
        new_merchants_per_month: newMerchantsPerMonth,
        new_customers_per_month: newCustomersPerMonth,
      },
      engagement: {
        transactions_per_day: transactionsPerDay,
        avg_completion_rate: avgCompletionRate,
        popular_durations: popularDurations,
        popular_rewards: popularRewards,
        total_transactions: allTransactions.length,
        total_sales: allTransactions.reduce((s, t) => s + Number(t.amount), 0),
      },
      whatsapp: {
        messages_per_month: messagesPerMonth,
        cost_per_merchant: costPerMerchant,
        category_breakdown: categoryBreakdown,
        total_messages: allLogs.length,
        total_cost: allLogs.reduce((s, l) => s + Number(l.cost), 0),
      },
      revenue: {
        total: totalRevenue,
        mrr: mrr,
        avg_per_merchant: allMerchants.length > 0 ? totalRevenue / allMerchants.length : 0,
        by_plan: revenueByPlan,
        upcoming_renewals: upcomingRenewals,
      }
    });
  } catch (error) {
    console.error('Admin analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
