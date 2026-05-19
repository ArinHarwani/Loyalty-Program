// ============================================================
// Scan API — processes QR scans from scan page
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, whatsapp_number, birth_month, birth_day } = body;

    if (!token || !whatsapp_number) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Find or create customer to save birthday
    let { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('whatsapp_number', whatsapp_number)
      .single();

    if (!customer) {
      await supabase.from('customers').insert({
        whatsapp_number,
        birth_month: birth_month || null,
        birth_day: birth_day || null,
      });
    } else if (birth_month && birth_day && (!customer.birth_month || !customer.birth_day)) {
      await supabase
        .from('customers')
        .update({ birth_month, birth_day })
        .eq('id', customer.id);
    }

    return NextResponse.json({ success: true, message: 'Profile saved' });
  } catch (error) {
    console.error('Scan API error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
