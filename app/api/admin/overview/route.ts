// ============================================================
// Admin Overview API
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

    // Get all merchants
    const { data: merchants } = await service
      .from('merchants')
      .select('*')
      .order('created_at', { ascending: false });

    // Get all message logs
    const { data: messageLogs } = await service
      .from('message_logs')
      .select('*');

    // Get all customers
    const { data: customers } = await service
      .from('customers')
      .select('id');

    // Get all campaigns
    const { data: campaigns } = await service
      .from('campaigns')
      .select('*');

    const allLogs = messageLogs || [];
    const allMerchants = merchants || [];
    const allCampaigns = campaigns || [];

    // Per-merchant stats
    const merchantStats = allMerchants.map((m) => {
      const mLogs = allLogs.filter((l) => l.merchant_id === m.id);
      const mCampaigns = allCampaigns.filter((c) => c.merchant_id === m.id);
      const mCost = mLogs.reduce((sum, l) => sum + Number(l.cost), 0);

      return {
        id: m.id,
        shop_name: m.shop_name,
        email: m.email,
        campaigns: mCampaigns.length,
        customers: 0, // Will be populated if needed
        messages: mLogs.length,
        cost: mCost,
        created_at: m.created_at,
      };
    });

    // Cost breakdown
    const costBreakdown = {
      service: allLogs.filter((l) => l.category === 'service').reduce((s, l) => s + Number(l.cost), 0),
      utility: allLogs.filter((l) => l.category === 'utility').reduce((s, l) => s + Number(l.cost), 0),
      marketing: allLogs.filter((l) => l.category === 'marketing').reduce((s, l) => s + Number(l.cost), 0),
    };

    return NextResponse.json({
      totalMerchants: allMerchants.length,
      totalCustomers: (customers || []).length,
      totalMessages: allLogs.length,
      totalCost: allLogs.reduce((sum, l) => sum + Number(l.cost), 0),
      merchants: merchantStats,
      costBreakdown,
    });
  } catch (error) {
    console.error('Admin API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
