// ============================================================
// Admin Overview API — returns all data for /admin dashboard
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
          getAll() {
            return cookieStore.getAll();
          },
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
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Get all merchants
    const { data: merchants } = await service
      .from('merchants')
      .select('*')
      .order('created_at', { ascending: false });

    // Get all subscriptions
    const { data: subscriptions } = await service
      .from('subscriptions')
      .select('*');

    // Get all message logs
    const { data: messageLogs } = await service
      .from('message_logs')
      .select('*');

    // Get all customers
    const { data: customers } = await service.from('customers').select('id');

    // Get all campaigns
    const { data: campaigns } = await service.from('campaigns').select('*');

    // Get all transactions
    const { data: transactions } = await service.from('transactions').select('*');

    // Get all enrollments
    const { data: enrollments } = await service.from('enrollments').select('*');

    const allLogs = messageLogs || [];
    const allMerchants = merchants || [];
    const allCampaigns = campaigns || [];
    const allTransactions = transactions || [];
    const allEnrollments = enrollments || [];
    const allSubscriptions = subscriptions || [];

    // MTD logs
    const mtdLogs = allLogs.filter(l => l.sent_at >= startOfMonth);
    const mtdTransactions = allTransactions.filter(t => t.scanned_at >= startOfMonth);

    // Per-merchant stats
    const merchantStats = allMerchants.map((m) => {
      const mCampaigns = allCampaigns.filter((c) => c.merchant_id === m.id);
      const mTransMTD = mtdTransactions.filter(t => t.merchant_id === m.id);
      const mLogsMTD = mtdLogs.filter(l => l.merchant_id === m.id);
      const mEnrollments = allEnrollments.filter(e => e.merchant_id === m.id);

      // Unique customers this month
      const customerIds = new Set(
        mEnrollments
          .filter(e => e.enrolled_at >= startOfMonth)
          .map(e => e.customer_id)
      );

      return {
        id: m.id,
        shop_name: m.shop_name,
        shop_category: m.shop_category || '',
        email: m.email,
        current_package: m.current_package || '',
        status: m.status || 'active',
        subscription_status: m.subscription_status || 'inactive',
        subscription_plan: m.subscription_plan || null,
        subscription_end_date: m.subscription_end_date || null,
        customer_limit: m.customer_limit || null,
        campaigns: mCampaigns.length,
        customers_this_month: customerIds.size,
        transactions_this_month: mTransMTD.length,
        whatsapp_cost_this_month: mLogsMTD.reduce((s, l) => s + Number(l.cost), 0),
        revenue_this_month: 0, // Package revenue — populated when billing is implemented
        last_login_at: m.last_login_at || null,
        created_at: m.created_at,
      };
    });

    // Churn risk detection
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const churnRisks = allMerchants
      .filter(m => {
        const lastLogin = m.last_login_at ? new Date(m.last_login_at) : null;
        const noRecentLogin = !lastLogin || lastLogin < fourteenDaysAgo;
        const hasNoCampaign = !allCampaigns.some(c => c.merchant_id === m.id && c.status === 'active');
        return noRecentLogin || hasNoCampaign;
      })
      .map(m => {
        const lastLogin = m.last_login_at ? new Date(m.last_login_at) : null;
        const noRecentLogin = !lastLogin || lastLogin < fourteenDaysAgo;
        const hasNoCampaign = !allCampaigns.some(c => c.merchant_id === m.id && c.status === 'active');

        let reason = '';
        if (noRecentLogin) reason += 'No login in 14+ days. ';
        if (hasNoCampaign) reason += 'No active campaign. ';

        return {
          id: m.id,
          shop_name: m.shop_name,
          email: m.email,
          reason: reason.trim(),
          last_login_at: m.last_login_at || null,
        };
      });

    // Recent activity (last 20 events from various tables)
    const recentActivity: { id: string; text: string; timestamp: string; type: 'campaign' | 'transaction' | 'customer' | 'merchant' }[] = [];

    // Recent campaigns
    allCampaigns
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .forEach(c => {
        const merchant = allMerchants.find(m => m.id === c.merchant_id);
        recentActivity.push({
          id: c.id,
          text: `${merchant?.shop_name || 'Unknown'} launched "${c.name}"`,
          timestamp: c.created_at,
          type: 'campaign',
        });
      });

    // Recent merchants
    allMerchants
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .forEach(m => {
        recentActivity.push({
          id: m.id,
          text: `${m.shop_name} joined the platform`,
          timestamp: m.created_at,
          type: 'merchant',
        });
      });

    // Sort by timestamp descending and take 20
    recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const recentSlice = recentActivity.slice(0, 20);

    // Monthly revenue chart (last 12 months)
    const monthlyChart: { month: string; revenue: number; cost: number; margin: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = d.toISOString();
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
      const monthLabel = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

      const monthCost = allLogs
        .filter(l => l.sent_at >= monthStart && l.sent_at < nextMonth)
        .reduce((s, l) => s + Number(l.cost), 0);
        
      const monthRevenue = allSubscriptions
        .filter(s => s.start_date >= monthStart && s.start_date < nextMonth)
        .reduce((s, sub) => s + Number(sub.price), 0);

      monthlyChart.push({
        month: monthLabel,
        revenue: monthRevenue,
        cost: monthCost,
        margin: monthRevenue - monthCost,
      });
    }

    // Cost breakdown
    const costBreakdown = {
      service: allLogs.filter(l => l.category === 'service').reduce((s, l) => s + Number(l.cost), 0),
      utility: allLogs.filter(l => l.category === 'utility').reduce((s, l) => s + Number(l.cost), 0),
      marketing: allLogs.filter(l => l.category === 'marketing').reduce((s, l) => s + Number(l.cost), 0),
    };

    // Calculate MRR
    const mrr = allSubscriptions
      .filter(s => s.status === 'active')
      .reduce((s, sub) => s + Number(sub.price), 0);
      
    // Calculate MTD Revenue
    const revenueMtd = allSubscriptions
      .filter(s => s.start_date >= startOfMonth)
      .reduce((s, sub) => s + Number(sub.price), 0);
      
    // Expiring Soon (Next 7 Days)
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const expiringSoonStr = sevenDaysFromNow.toISOString().split('T')[0];
    
    const expiringSoon = merchantStats.filter(m => 
      m.subscription_status === 'active' && 
      m.subscription_end_date && 
      m.subscription_end_date <= expiringSoonStr
    );

    return NextResponse.json({
      stats: {
        total_merchants: allMerchants.length,
        active_merchants: allMerchants.filter(m => (m.subscription_status || 'inactive') === 'active').length,
        inactive_merchants: allMerchants.filter(m => (m.subscription_status || 'inactive') === 'inactive').length,
        blocked_merchants: allMerchants.filter(m => (m.subscription_status || 'inactive') === 'blocked').length,
        total_customers: (customers || []).length,
        total_transactions: allTransactions.length,
        revenue_mtd: revenueMtd,
        whatsapp_cost_mtd: mtdLogs.reduce((s, l) => s + Number(l.cost), 0),
        margin_mtd: revenueMtd - mtdLogs.reduce((s, l) => s + Number(l.cost), 0),
        mrr,
      },
      subscription_health: {
        active: allMerchants.filter(m => (m.subscription_status || 'inactive') === 'active').length,
        inactive: allMerchants.filter(m => (m.subscription_status || 'inactive') === 'inactive').length,
        blocked: allMerchants.filter(m => (m.subscription_status || 'inactive') === 'blocked').length,
      },
      expiring_soon: expiringSoon,
      merchants: merchantStats,
      churn_risks: churnRisks,
      recent_activity: recentSlice,
      monthly_revenue_chart: monthlyChart,
      costBreakdown,
    });
  } catch (error) {
    console.error('Admin API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
