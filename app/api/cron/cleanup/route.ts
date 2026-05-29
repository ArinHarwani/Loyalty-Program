import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    // In Supabase SQL, we would ideally just run a delete query, 
    // but via JS we can do it using date logic.
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { error: tokensError, count: tokensCount } = await supabase
      .from('qr_tokens')
      .delete({ count: 'exact' })
      .lt('created_at', sevenDaysAgo.toISOString());

    if (tokensError) {
      console.error('Error deleting qr_tokens:', tokensError);
    }

    const { error: logsError, count: logsCount } = await supabase
      .from('message_logs')
      .delete({ count: 'exact' })
      .lt('sent_at', sixMonthsAgo.toISOString());

    if (logsError) {
      console.error('Error deleting message_logs:', logsError);
    }

    return NextResponse.json({
      deleted_tokens: tokensCount || 0,
      deleted_logs: logsCount || 0,
      status: 'success'
    }, { status: 200 });
  } catch (error) {
    console.error('Cleanup cron error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
