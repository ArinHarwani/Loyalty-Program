// ============================================================
// Admin — Reset Merchant Password API
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
    // Auth check — support both cookie session and Authorization header
    const authHeader = request.headers.get('authorization');
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
        global: authHeader
          ? { headers: { Authorization: authHeader } }
          : {},
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email || user.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { merchantId } = await params;
    const body = await request.json();
    const { newPassword } = body;

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Use service role client to update auth user password
    const supabaseAdmin = createServiceClient();

    // Verify merchant exists in DB and get their email
    const { data: merchantData, error: merchantError } = await supabaseAdmin
      .from('merchants')
      .select('id, email')
      .eq('id', merchantId)
      .single();

    if (merchantError || !merchantData) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // Look up the auth user by email to get the correct auth UUID
    // (the merchants.id may not always match auth.users.id)
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      return NextResponse.json({ error: 'Failed to look up auth user' }, { status: 500 });
    }
    const authUser = users.find(u => u.email === merchantData.email);
    if (!authUser) {
      return NextResponse.json({ error: `No auth account found for ${merchantData.email}` }, { status: 404 });
    }

    // Update the password in auth.users using the correct auth UUID
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authUser.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Reset password error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
