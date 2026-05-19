// ============================================================
// Scan API — processes QR scans from scan page
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { processScan } from '@/lib/scan-logic';

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

    const result = await processScan({
      token,
      whatsapp_number,
      birth_month,
      birth_day,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Scan API error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
