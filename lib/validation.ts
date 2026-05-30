// ============================================================
// LoyaltyQR — Request Validation Schemas (Zod)
// ============================================================

import { z } from 'zod';

// Regex for validating exactly 10-digit Indian phone numbers starting with 6-9
const INDIAN_PHONE_REGEX = /^[6-9]\d{9}$/;

/**
 * Schema for merchant loyalty campaigns.
 * Enforces campaign properties and cross-field logic based on campaign type.
 */
export const CampaignSchema = z
  .object({
    name: z
      .string()
      .min(3, { message: 'Campaign name must be at least 3 characters long' })
      .max(100, { message: 'Campaign name cannot exceed 100 characters' })
      .trim(),
    campaign_type: z.enum(['amount', 'visits'], {
      required_error: 'Campaign type is required',
    }),
    target_amount: z.number().optional(),
    target_visits: z.number().int().optional(),
    // Either a preset duration OR a specific end date must be provided
    duration_days: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]).optional(),
    end_date: z.string().date().optional(), // ISO date string: YYYY-MM-DD
    reward_description: z
      .string()
      .min(3, { message: 'Reward description must be at least 3 characters' })
      .max(200, { message: 'Reward description cannot exceed 200 characters' })
      .trim(),
    max_winners: z.number().int().positive().nullable().optional(),
  })
  .refine(
    (data) => {
      // Exactly one of duration_days or end_date must be provided
      const hasDuration = typeof data.duration_days === 'number';
      const hasEndDate = typeof data.end_date === 'string' && data.end_date.length > 0;
      return hasDuration !== hasEndDate || (hasDuration && !hasEndDate) || (!hasDuration && hasEndDate);
    },
    {
      message: 'Either a duration or a specific end date must be provided',
      path: ['duration_days'],
    }
  )
  .refine(
    (data) => {
      // If end_date is provided, it must be in the future
      if (data.end_date) {
        return new Date(data.end_date) > new Date();
      }
      return true;
    },
    {
      message: 'Offer end date must be in the future',
      path: ['end_date'],
    }
  )
  .refine(
    (data) => {
      if (data.campaign_type === 'amount') {
        return typeof data.target_amount === 'number' && data.target_amount >= 100;
      }
      return true;
    },
    {
      message: 'Target amount must be at least ₹100 for amount milestone campaigns',
      path: ['target_amount'],
    }
  )
  .refine(
    (data) => {
      if (data.campaign_type === 'visits') {
        return typeof data.target_visits === 'number' && data.target_visits >= 2;
      }
      return true;
    },
    {
      message: 'Target visits must be at least 2 for visit milestone campaigns',
      path: ['target_visits'],
    }
  );

/**
 * Schema for creating a transaction.
 */
export const TransactionSchema = z.object({
  amount: z
    .number({ required_error: 'Amount is required' })
    .min(0, { message: 'Transaction amount cannot be negative' }),
  campaign_id: z
    .string({ required_error: 'Campaign ID is required' })
    .uuid({ message: 'Invalid Campaign ID format' }),
});

/**
 * Schema for registering scans.
 */
export const ScanRegisterSchema = z
  .object({
    token: z
      .string({ required_error: 'QR token is required' })
      .min(1, { message: 'QR token cannot be empty' }),
    whatsapp_number: z
      .string({ required_error: 'WhatsApp number is required' })
      .regex(INDIAN_PHONE_REGEX, { message: 'Please enter a valid 10-digit Indian phone number' }),
    name: z.string().max(60).trim().optional(),
    birth_month: z
      .number()
      .int()
      .min(1)
      .max(12)
      .nullable()
      .optional(),
    birth_day: z
      .number()
      .int()
      .min(1)
      .max(31)
      .nullable()
      .optional(),
  })
  .refine(
    (data) => {
      // If either month or day is provided, both must be specified
      const hasMonth = typeof data.birth_month === 'number';
      const hasDay = typeof data.birth_day === 'number';
      return hasMonth === hasDay;
    },
    {
      message: 'Both birth month and day are required if setting a birthday',
      path: ['birth_month'],
    }
  );
