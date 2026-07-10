// ============================================================
// Points Balance API — GET customer's points balance
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { createClient } from '@/lib/supabase';
import { getCustomerBalance } from '@/lib/points-logic';

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const authSupabase = createClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, loyalty_mechanism')
      .eq('email', user.email)
      .single();

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    if (merchant.loyalty_mechanism !== 'points') {
      return NextResponse.json({ error: 'Not a points merchant' }, { status: 400 });
    }

    // Get whatsapp number from query
    const whatsapp = request.nextUrl.searchParams.get('whatsapp');
    if (!whatsapp) {
      return NextResponse.json({ error: 'whatsapp parameter required' }, { status: 400 });
    }

    // Clean number (remove 91 prefix if present)
    const cleanNumber = whatsapp.startsWith('91') && whatsapp.length > 10
      ? whatsapp.substring(2)
      : whatsapp;

    // Find customer
    const { data: customer } = await supabase
      .from('customers')
      .select('id, name, whatsapp_number')
      .eq('whatsapp_number', cleanNumber)
      .single();

    if (!customer) {
      return NextResponse.json({
        error: 'Customer not found',
        balance: 0,
        customer: null,
      });
    }

    // Get balance
    const balance = await getCustomerBalance(merchant.id, customer.id, supabase);

    // Get recent ledger entries
    const { data: recentEntries } = await supabase
      .from('points_ledger')
      .select('*')
      .eq('merchant_id', merchant.id)
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      balance,
      customer: {
        id: customer.id,
        name: customer.name,
        whatsapp_number: customer.whatsapp_number,
      },
      recent_entries: recentEntries || [],
    });
  } catch (error) {
    console.error('Points balance GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
