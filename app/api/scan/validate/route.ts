import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    
    // Fetch QR token with relations using service role to bypass RLS
    const { data: qrToken, error } = await supabase
      .from('qr_tokens')
      .select('*, merchant:merchants(*), campaign:campaigns(*)')
      .eq('token', token)
      .single();

    if (error || !qrToken) {
      return NextResponse.json({ error: 'Invalid QR code' }, { status: 400 });
    }

    if (qrToken.used) {
      return NextResponse.json({ error: 'QR code already used' }, { status: 400 });
    }

    if (new Date(qrToken.expires_at) < new Date()) {
      return NextResponse.json({ error: 'QR code expired' }, { status: 400 });
    }

    return NextResponse.json({ success: true, qrToken });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
