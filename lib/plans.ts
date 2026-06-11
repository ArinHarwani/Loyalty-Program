// ============================================================
// LoyaltyQR — Plan Definitions & Pricing
// ============================================================

export const PLANS = {
  growth: {
    name: 'Growth',
    customer_limit: 1000,
    monthly_price: 999,
    description: 'Up to 1,000 loyalty customers',
    whatsapp_cost_estimate: 187,
  },
  business: {
    name: 'Business',
    customer_limit: 2000,
    monthly_price: 1499,
    description: 'Up to 2,000 loyalty customers',
    whatsapp_cost_estimate: 374,
  },
  pro: {
    name: 'Pro',
    customer_limit: 5000,
    monthly_price: 2999,
    description: 'Up to 5,000 loyalty customers',
    whatsapp_cost_estimate: 935,
  },
} as const;

export type PlanKey = keyof typeof PLANS;

// Multi-month discount percentages
export const MULTI_MONTH_DISCOUNTS: Record<number, number> = {
  1: 0,
  2: 10,
  3: 15,
  6: 20,
};

export type DurationMonths = 1 | 2 | 3 | 6;

export function calculateMultiMonthPrice(
  planKey: PlanKey,
  months: DurationMonths
): {
  original_total: number;
  discount_percent: number;
  discount_amount: number;
  final_total: number;
  monthly_effective: number;
} {
  const plan = PLANS[planKey];
  const originalTotal = plan.monthly_price * months;
  const discountPercent = MULTI_MONTH_DISCOUNTS[months];
  const discountAmount = Math.round((originalTotal * discountPercent) / 100);
  const finalTotal = originalTotal - discountAmount;
  const monthlyEffective = Math.round(finalTotal / months);

  return {
    original_total: originalTotal,
    discount_percent: discountPercent,
    discount_amount: discountAmount,
    final_total: finalTotal,
    monthly_effective: monthlyEffective,
  };
}

/**
 * Get the customer limit for a given plan key.
 * Returns null for custom plans (admin sets manually).
 */
export function getCustomerLimitForPlan(planKey: string): number | null {
  if (planKey in PLANS) {
    return PLANS[planKey as PlanKey].customer_limit;
  }
  return null; // custom
}
