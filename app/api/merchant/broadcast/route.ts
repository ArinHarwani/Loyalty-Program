// ============================================================
// Broadcast API — send marketing messages to all active enrollments
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { message, estimate_only } = body;

    // Get all active enrollments with customers
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('*, customer:customers(*)')
      .eq('merchant_id', merchant.id)
      .eq('status', 'active');

    const uniqueCustomers = new Map();
    (enrollments || []).forEach((e: { customer?: { id: string; whatsapp_number: string } }) => {
      if (e.customer) {
        uniqueCustomers.set(e.customer.id, e.customer);
      }
    });

    const customerCount = uniqueCustomers.size;
    const estimatedCost = customerCount * 0.9; // ₹0.90 per marketing message

    // If estimate only, return cost estimate
    if (estimate_only) {
      return NextResponse.json({
        customer_count: customerCount,
        estimated_cost: estimatedCost,
      });
    }

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Send to all unique customers
    let sent = 0;
    let failed = 0;

    for (const [, customer] of uniqueCustomers) {
      await sendWhatsAppMessage(
        customer.whatsapp_number,
        `${merchant.shop_name} 📢\n\n${message}`
      );

      await supabase.from('message_logs').insert({
        merchant_id: merchant.id,
        customer_id: customer.id,
        template_name: 'broadcast',
        category: 'marketing',
        cost: 0.9,
        status: 'sent',
      });

      sent++;
    }

    return NextResponse.json({
      sent,
      failed,
      total: customerCount,
      cost: sent * 0.9,
    });
  } catch (error) {
    console.error('Broadcast API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
