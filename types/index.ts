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
  reward_description: string;
  max_winners: number | null;
  status: 'active' | 'ended';
  created_at: string;
}

export interface Customer {
  id: string;
  whatsapp_number: string;
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

// --- API Request / Response Types ---

export interface CreateCampaignRequest {
  name: string;
  campaign_type: 'amount' | 'visits';
  target_amount?: number;
  target_visits?: number;
  duration_days: 15 | 30 | 45 | 60;
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

export interface AdminOverview {
  totalMerchants: number;
  totalCustomers: number;
  totalMessages: number;
  totalCost: number;
  merchants: {
    id: string;
    shop_name: string;
    email: string;
    campaigns: number;
    customers: number;
    messages: number;
    cost: number;
    created_at: string;
  }[];
  costBreakdown: {
    service: number;
    utility: number;
    marketing: number;
  };
}

// --- Enrollment with joined data ---
export interface EnrollmentWithDetails extends Enrollment {
  customer?: Customer;
  campaign?: Campaign;
  merchant?: Merchant;
}
