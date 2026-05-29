// ============================================================
// Admin — Individual Merchant Detail API
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ merchantId: string }> }
) {
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

    const { merchantId } = await params;
    const service = createServiceClient();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Merchant
    const { data: merchant, error: merchantError } = await service
      .from('merchants')
      .select('*')
      .eq('id', merchantId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // Package history (legacy)
    const { data: packageHistory } = await service
      .from('merchant_packages')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('started_at', { ascending: false });

    // Subscription history (new)
    const { data: subscriptionHistory } = await service
      .from('subscriptions')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('start_date', { ascending: false });

    // All campaigns
    const { data: campaigns } = await service
      .from('campaigns')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });

    // All enrollments
    const { data: enrollments } = await service
      .from('enrollments')
      .select('*')
      .eq('merchant_id', merchantId);

    // All transactions
    const { data: transactions } = await service
      .from('transactions')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('scanned_at', { ascending: false });

    // Message logs
    const { data: messageLogs } = await service
      .from('message_logs')
      .select('*')
      .eq('merchant_id', merchantId);

    const allCampaigns = campaigns || [];
    const allEnrollments = enrollments || [];
    const allTransactions = transactions || [];
    const allLogs = messageLogs || [];

    // Campaign stats
    const campaignStats = allCampaigns.map(c => {
      const cEnrollments = allEnrollments.filter(e => e.campaign_id === c.id);
      const completed = cEnrollments.filter(e => e.status === 'completed').length;
      const salesGenerated = allTransactions
        .filter(t => cEnrollments.some(e => e.id === t.enrollment_id))
        .reduce((s, t) => s + Number(t.amount), 0);

      return {
        id: c.id,
        name: c.name,
        campaign_type: c.campaign_type,
        target: c.campaign_type === 'amount'
          ? `₹${c.target_amount}`
          : `${c.target_visits} visits`,
        duration_days: c.duration_days,
        reward_description: c.reward_description,
        enrolled: cEnrollments.length,
        completed,
        completion_rate: cEnrollments.length > 0
          ? Math.round((completed / cEnrollments.length) * 100)
          : 0,
        sales_generated: salesGenerated,
        created_at: c.created_at,
        status: c.status,
      };
    });

    // Daily sales chart (last 30 days)
    const dailyChart: { date: string; transactions: number; amount: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split('T')[0];
      const dayTxns = allTransactions.filter(t =>
        t.scanned_at.startsWith(dayStr)
      );
      dailyChart.push({
        date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        transactions: dayTxns.length,
        amount: dayTxns.reduce((s, t) => s + Number(t.amount), 0),
      });
    }

    // Monthly sales chart (last 12 months)
    const monthlyChart: { month: string; transactions: number; amount: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = d.toISOString();
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
      const monthLabel = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

      const monthTxns = allTransactions.filter(t =>
        t.scanned_at >= monthStart && t.scanned_at < nextMonth
      );

      monthlyChart.push({
        month: monthLabel,
        transactions: monthTxns.length,
        amount: monthTxns.reduce((s, t) => s + Number(t.amount), 0),
      });
    }

    // Customer stats
    const uniqueCustomerIds = new Set(allEnrollments.map(e => e.customer_id));
    const newThisMonth = new Set(
      allEnrollments
        .filter(e => e.enrolled_at >= startOfMonth)
        .map(e => e.customer_id)
    ).size;

    const byStatus = {
      active: allEnrollments.filter(e => e.status === 'active').length,
      completed: allEnrollments.filter(e => e.status === 'completed').length,
      expired: allEnrollments.filter(e => e.status === 'expired').length,
    };

    // WhatsApp costs
    const serviceLogs = allLogs.filter(l => l.category === 'service');
    const utilityLogs = allLogs.filter(l => l.category === 'utility');
    const marketingLogs = allLogs.filter(l => l.category === 'marketing');
    const mtdLogs = allLogs.filter(l => l.sent_at >= startOfMonth);

    return NextResponse.json({
      merchant,
      package_history: packageHistory || [],
      subscription_history: subscriptionHistory || [],
      campaigns: campaignStats,
      sales_chart_daily: dailyChart,
      sales_chart_monthly: monthlyChart,
      customer_stats: {
        total: uniqueCustomerIds.size,
        new_this_month: newThisMonth,
        returning_rate: uniqueCustomerIds.size > 0
          ? Math.round(((uniqueCustomerIds.size - newThisMonth) / uniqueCustomerIds.size) * 100)
          : 0,
        by_status: byStatus,
      },
      whatsapp_costs: {
        service: { count: serviceLogs.length, cost: serviceLogs.reduce((s, l) => s + Number(l.cost), 0) },
        utility: { count: utilityLogs.length, cost: utilityLogs.reduce((s, l) => s + Number(l.cost), 0) },
        marketing: { count: marketingLogs.length, cost: marketingLogs.reduce((s, l) => s + Number(l.cost), 0) },
        total: allLogs.reduce((s, l) => s + Number(l.cost), 0),
        this_month: mtdLogs.reduce((s, l) => s + Number(l.cost), 0),
      },
    });
  } catch (error) {
    console.error('Admin merchant detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
