// ============================================================
// Admin — Block Merchant API
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(
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

    await service
      .from('merchants')
      .update({ subscription_status: 'blocked' })
      .eq('id', merchantId);

    await service.from('merchant_status_log').insert({
      merchant_id: merchantId,
      status: 'blocked',
      reason: 'Admin manually blocked access',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin block merchant error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
