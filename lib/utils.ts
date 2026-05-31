// ============================================================
// LoyaltyQR — Utility Functions
// ============================================================

/**
 * Format a number as Indian Rupees (₹1,234.00)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Mask a phone number for display: 98765XXXXX
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return '***';
  return phone.slice(0, 5) + 'XXXXX';
}

/**
 * Generate a claim code like #WIN-A3F7
 */
export function generateClaimCode(): string {
  const bytes = new Uint8Array(4);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback if crypto isn't available
    for (let i = 0; i < 4; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(bytes[i % 4] % chars.length);
  }
  return `#WIN-${code}`;
}

/**
 * Calculate percentage progress
 */
export function calcPercentage(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(Math.round((current / target) * 100), 100);
}

/**
 * Calculate days remaining from a deadline
 */
export function daysRemaining(deadline: string): number {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diff = deadlineDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Validate Indian phone number (10 digits, starts with 6-9)
 */
export function isValidIndianPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone);
}

/**
 * Generate a merchant code from shop name (e.g., "Sharma Sweets" → "SHARMASWEETS")
 * Ensures uniqueness by appending random chars
 */
export function generateMerchantCode(shopName: string): string {
  const base = shopName
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 8);
  const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${base}${suffix}`;
}

/**
 * Generate a unique QR token
 */
export function generateQrToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for extremely old browsers/environments
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Format a date for display
 */
export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a date with time
 */
export function formatDateTime(date: string): string {
  return new Date(date).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get the campaign description string
 */
export function getCampaignDescription(
  type: 'amount' | 'visits',
  targetAmount: number | null,
  targetVisits: number | null,
  durationDays: number
): string {
  if (type === 'amount') {
    return `Spend ${formatCurrency(targetAmount || 0)} within ${durationDays} days`;
  }
  return `Visit ${targetVisits || 0} times within ${durationDays} days`;
}
