// ============================================================
// Scan Register API — registers customer + enrollment before WhatsApp redirect
// Does NOT process the transaction. That happens in the webhook.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { ScanRegisterSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = ScanRegisterSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { token, whatsapp_number, name, birth_month, birth_day } = validationResult.data;

    const supabase = createServiceClient();

    // 2. Validate token
    const { data: qrToken, error: tokenError } = await supabase
      .from('qr_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError || !qrToken) {
      return NextResponse.json(
        { error: 'Invalid QR code' },
        { status: 400 }
      );
    }

    if (qrToken.used) {
      return NextResponse.json(
        { error: 'QR already used' },
        { status: 400 }
      );
    }

    if (new Date(qrToken.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'QR expired' },
        { status: 400 }
      );
    }

    // 3. Get merchant + campaign
    const { data: merchant } = await supabase
      .from('merchants')
      .select('*')
      .eq('id', qrToken.merchant_id)
      .single();

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', qrToken.campaign_id)
      .single();

    if (!merchant || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 400 }
      );
    }

    if (campaign.status !== 'active') {
      return NextResponse.json(
        { error: 'No active campaign' },
        { status: 400 }
      );
    }

    // 4. Find or create customer
    let isNewCustomer = false;
    let { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('whatsapp_number', whatsapp_number)
      .single();

    if (!customer) {
      isNewCustomer = true;
      const { data: newCustomer, error: createError } = await supabase
        .from('customers')
        .insert({
          whatsapp_number,
          name: name || null,
          birth_month: birth_month || null,
          birth_day: birth_day || null,
        })
        .select()
        .single();

      if (createError || !newCustomer) {
        return NextResponse.json(
          { error: 'Failed to register customer' },
          { status: 500 }
        );
      }
      customer = newCustomer;
    } else {
      // Update name if the customer gave one but doesn't have one saved yet
      const updates: Record<string, unknown> = {};
      if (name && !customer.name) updates.name = name;
      if (birth_month && birth_day && (!customer.birth_month || !customer.birth_day)) {
        updates.birth_month = birth_month;
        updates.birth_day = birth_day;
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from('customers').update(updates).eq('id', customer.id);
        customer = { ...customer, ...updates };
      }
    }

    // 5. Find or create enrollment
    let isNewEnrollment = false;

    // Check for any existing enrollment (active or completed)
    let { data: enrollment } = await supabase
      .from('enrollments')
      .select('*')
      .eq('customer_id', customer.id)
      .eq('campaign_id', campaign.id)
      .eq('merchant_id', merchant.id)
      .order('enrolled_at', { ascending: false })
      .limit(1)
      .single();

    if (enrollment) {
      // Check status
      if (enrollment.status === 'expired') {
        // Allow re-enrollment by creating a new enrollment
        enrollment = null; // fall through to creation below
      } else if (enrollment.status === 'completed') {
        // Already won — let them scan anyway, return success
        return NextResponse.json({
          success: true,
          merchant_id: merchant.id,
          is_new_customer: false,
          is_new_enrollment: false,
          campaign: {
            name: campaign.name,
            target_amount: campaign.target_amount,
            target_visits: campaign.target_visits,
            campaign_type: campaign.campaign_type,
            reward_description: campaign.reward_description,
            duration_days: campaign.duration_days,
          },
          enrollment: {
            total_spent: enrollment.total_spent,
            total_visits: enrollment.total_visits,
            deadline_at: enrollment.deadline_at,
            status: enrollment.status,
          },
        });
      } else if (enrollment.status === 'active') {
        // Check if deadline passed
        if (new Date(enrollment.deadline_at) < new Date()) {
          await supabase
            .from('enrollments')
            .update({ status: 'expired' })
            .eq('id', enrollment.id);
          enrollment = null; // fall through to creation
        }
      }
    }

    if (!enrollment) {
      isNewEnrollment = true;

      // Check max winners
      if (campaign.max_winners) {
        const { count } = await supabase
          .from('enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id)
          .eq('status', 'completed');

        if (count !== null && count >= campaign.max_winners) {
          return NextResponse.json(
            { error: 'This campaign has reached its maximum number of winners' },
            { status: 400 }
          );
        }
      }

      // Calculate deadline: use campaign end_date if set, else duration_days from now
      let deadline: Date;
      if (campaign.end_date) {
        deadline = new Date(campaign.end_date);
        // Set to end of day IST
        deadline.setHours(23, 59, 59, 999);
      } else {
        deadline = new Date();
        deadline.setDate(deadline.getDate() + campaign.duration_days);
      }

      const { data: newEnrollment, error: enrollError } = await supabase
        .from('enrollments')
        .insert({
          customer_id: customer.id,
          campaign_id: campaign.id,
          merchant_id: merchant.id,
          total_spent: 0,
          total_visits: 0,
          deadline_at: deadline.toISOString(),
          status: 'active',
        })
        .select()
        .single();

      if (enrollError || !newEnrollment) {
        return NextResponse.json(
          { error: 'Failed to enroll in campaign' },
          { status: 500 }
        );
      }
      enrollment = newEnrollment;
    }

    // 6. Return success
    const businessNumber = (process.env.WHATSAPP_BUSINESS_NUMBER || '').replace(/\D/g, '');
    // Build WhatsApp deep link — include country code 91 for India if not already present
    const waNumber = businessNumber.startsWith('91') ? businessNumber : `91${businessNumber}`;
    const whatsappUrl = businessNumber
      ? `https://wa.me/${waNumber}?text=TXN-${token}`
      : null;

    return NextResponse.json({
      success: true,
      merchant_id: merchant.id,
      whatsapp_url: whatsappUrl,
      is_new_customer: isNewCustomer,
      is_new_enrollment: isNewEnrollment,
      campaign: {
        name: campaign.name,
        target_amount: campaign.target_amount,
        target_visits: campaign.target_visits,
        campaign_type: campaign.campaign_type,
        reward_description: campaign.reward_description,
        duration_days: campaign.duration_days,
      },
      enrollment: {
        total_spent: enrollment.total_spent,
        total_visits: enrollment.total_visits,
        deadline_at: enrollment.deadline_at,
        status: enrollment.status,
      },
    });
  } catch (error) {
    console.error('Scan register error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
