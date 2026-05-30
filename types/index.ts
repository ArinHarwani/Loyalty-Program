// ============================================================
// LoyaltyQR — Type Definitions
// ============================================================

// --- Database Table Types ---

export interface Merchant {
  id: string;
  email: string;
  shop_name: string;
  shop_category: string;
  logo_url: string | null;
  merchant_code: string | null;
  current_package: string;
  status: string;
  subscription_status: 'inactive' | 'active' | 'blocked';
  subscription_end_date: string | null;
  subscription_plan: string | null;
  last_login_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface Campaign {
  id: string;
  merchant_id: string;
  name: string;
  campaign_type: 'amount' | 'visits';
  target_amount: number | null;
  target_visits: number | null;
  duration_days: number;
  end_date: string | null;
  reward_description: string;
  max_winners: number | null;
  status: 'active' | 'ended';
  created_at: string;
}

export interface Customer {
  id: string;
  whatsapp_number: string;
  name: string | null;
  birth_month: number | null;
  birth_day: number | null;
  created_at: string;
}

export interface Enrollment {
  id: string;
  customer_id: string;
  campaign_id: string;
  merchant_id: string;
  total_spent: number;
  total_visits: number;
  enrolled_at: string;
  deadline_at: string;
  status: 'active' | 'completed' | 'expired';
  claim_code: string | null;
  claimed: boolean;
  warning_sent: boolean;
}

export interface Transaction {
  id: string;
  enrollment_id: string;
  merchant_id: string;
  amount: number;
  scanned_at: string;
  qr_token: string | null;
}

export interface QrToken {
  token: string;
  merchant_id: string;
  campaign_id: string;
  amount: number;
  created_at: string;
  expires_at: string;
  used: boolean;
}

export interface MessageLog {
  id: string;
  merchant_id: string;
  customer_id: string;
  template_name: string;
  category: 'service' | 'utility' | 'marketing';
  cost: number;
  sent_at: string;
  status: 'sent' | 'failed';
}

export interface MerchantPackage {
  id: string;
  merchant_id: string;
  package_name: 'trial' | 'starter' | 'growth';
  price: number;
  started_at: string;
  ended_at: string | null;
  is_current: boolean;
  notes: string | null;
}

export interface MerchantStatusLog {
  id: string;
  merchant_id: string;
  status: 'active' | 'inactive' | 'churned' | 'trial' | 'blocked';
  changed_at: string;
  reason: string | null;
}

export interface Subscription {
  id: string;
  merchant_id: string;
  plan_name: 'starter' | 'growth' | 'custom';
  price: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'expired' | 'cancelled';
  payment_method: string;
  utr_number: string | null;
  notes: string | null;
  created_at: string;
}

// --- API Request / Response Types ---

export interface CreateCampaignRequest {
  name: string;
  campaign_type: 'amount' | 'visits';
  target_amount?: number;
  target_visits?: number;
  duration_days?: 15 | 30 | 45 | 60;
  end_date?: string;
  reward_description: string;
  max_winners?: number;
}

export interface CreateTransactionRequest {
  amount: number;
  campaign_id: string;
}

export interface TransactionStatusResponse {
  used: boolean;
  expired: boolean;
  customer_masked?: string;
}

export interface ScanRequest {
  token: string;
  whatsapp_number: string;
  name?: string;
  birth_month?: number;
  birth_day?: number;
}

export interface ScanResult {
  success: boolean;
  message: string;
  isNewCustomer: boolean;
  isCompleted: boolean;
  claimCode?: string;
  progress: {
    current: number;
    target: number;
    percentage: number;
    daysRemaining: number;
  };
  shopName: string;
  reward: string;
}

export interface AnalyticsData {
  campaign: Campaign | null;
  totalCustomers: number;
  totalTransactions: number;
  totalRevenue: number;
  completionRate: number;
  funnel: { label: string; count: number; percentage: number }[];
  segments: { name: string; count: number; color: string }[];
  dailyTransactions: { date: string; count: number; amount: number }[];
  peakHours: { hour: number; count: number }[];
  winners: { total: number; claimed: number; unclaimed: number };
  campaignComparison: {
    id: string;
    name: string;
    type: string;
    customers: number;
    completed: number;
    status: string;
  }[];
}

// --- Admin Types ---

export interface AdminOverview {
  stats: {
    total_merchants: number;
    active_merchants: number;
    total_customers: number;
    total_transactions: number;
    revenue_mtd: number;
    whatsapp_cost_mtd: number;
    margin_mtd: number;
    blocked_merchants: number;
    inactive_merchants: number;
    mrr: number;
  };
  subscription_health: {
    active: number;
    inactive: number;
    blocked: number;
  };
  expiring_soon: AdminMerchantRow[];
  merchants: AdminMerchantRow[];
  churn_risks: ChurnRiskMerchant[];
  recent_activity: ActivityEvent[];
  monthly_revenue_chart: { month: string; revenue: number; cost: number; margin: number }[];
  costBreakdown: {
    service: number;
    utility: number;
    marketing: number;
  };
}

export interface AdminMerchantRow {
  id: string;
  shop_name: string;
  shop_category: string;
  email: string;
  current_package: string;
  status: string;
  subscription_status: 'inactive' | 'active' | 'blocked';
  subscription_plan: string | null;
  subscription_end_date: string | null;
  campaigns: number;
  customers_this_month: number;
  transactions_this_month: number;
  whatsapp_cost_this_month: number;
  revenue_this_month: number;
  last_login_at: string | null;
  created_at: string;
}

export interface ChurnRiskMerchant {
  id: string;
  shop_name: string;
  email: string;
  reason: string;
  last_login_at: string | null;
}

export interface ActivityEvent {
  id: string;
  text: string;
  timestamp: string;
  type: 'campaign' | 'transaction' | 'customer' | 'merchant';
}

export interface AdminMerchantDetail {
  merchant: Merchant;
  package_history: MerchantPackage[];
  subscription_history: Subscription[];
  campaigns: AdminCampaignRow[];
  sales_chart_daily: { date: string; transactions: number; amount: number }[];
  sales_chart_monthly: { month: string; transactions: number; amount: number }[];
  customer_stats: {
    total: number;
    new_this_month: number;
    returning_rate: number;
    by_status: { active: number; completed: number; expired: number };
  };
  whatsapp_costs: {
    service: { count: number; cost: number };
    utility: { count: number; cost: number };
    marketing: { count: number; cost: number };
    total: number;
    this_month: number;
  };
}

export interface AdminCampaignRow {
  id: string;
  name: string;
  campaign_type: string;
  target: string;
  duration_days: number;
  reward_description: string;
  enrolled: number;
  completed: number;
  completion_rate: number;
  sales_generated: number;
  created_at: string;
  status: string;
}

// --- Enrollment with joined data ---
export interface EnrollmentWithDetails extends Enrollment {
  customer?: Customer;
  campaign?: Campaign;
  merchant?: Merchant;
}
