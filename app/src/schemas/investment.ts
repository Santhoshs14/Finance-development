import { z } from "zod";
import { firestoreIdSchema, moneyInputSchema } from "./common";

export const investmentTypeSchema = z.enum([
  "Mutual Fund",
  "Equity",
  "Gold",
  "Bond",
  "FD",
  "RD",
  "PPF",
  "EPF",
  "NPS",
  "ELSS",
  "Real Estate",
  "Crypto",
  "Other",
]);

export const goldFormSchema = z.enum(["digital", "physical", "sgb", "etf"]);

/** Interest compounding cadence for fixed-income instruments (FD/RD/Bonds). */
export const compoundingSchema = z.enum([
  "simple",
  "monthly",
  "quarterly",
  "halfyearly",
  "annually",
]);

/** Whether interest is paid out periodically or reinvested until maturity. */
export const interestPayoutSchema = z.enum(["cumulative", "payout"]);

export const createInvestmentSchema = z.object({
  name: z.string().min(1).max(150),
  investment_type: investmentTypeSchema.default("Equity"),
  buy_price: moneyInputSchema.refine((n) => n > 0, {
    message: "buy_price must be positive",
  }),
  current_price: moneyInputSchema.optional(),
  quantity: moneyInputSchema.refine((n) => n > 0, {
    message: "quantity must be positive",
  }),
  sip_amount: moneyInputSchema.optional(),
  scheme_code: z.string().max(50).optional(),
  fund_house: z.string().max(100).optional(),
  linked_goal_id: z.string().max(128).optional().nullable(),
  account_id: z.string().max(128).optional().nullable(),
  linked_transaction_id: z.string().max(128).optional().nullable(),
  needs_allocation: z.boolean().optional(),
  // Gold-specific fields
  purity: z.number().optional(),
  form: goldFormSchema.optional(),
  weight_grams: moneyInputSchema.optional(),
  making_charges: moneyInputSchema.optional(),
  purchase_date: z.string().optional(),
  // Manual "Other" instruments (FD/RD/PPF/EPF/NPS/Bonds/Real Estate/Crypto)
  interest_rate: z.number().min(0).max(100).optional(),
  start_date: z.string().optional(),
  maturity_date: z.string().optional(),
  institution: z.string().max(150).optional(),
  compounding: compoundingSchema.optional(),
  interest_payout: interestPayoutSchema.optional(),
  // Mutual-fund NAV bookkeeping (set by the fetch-nav cron / SIP engine)
  nav_date: z.string().optional(),
  last_nav_update: z.string().optional(),
});

export type CreateInvestmentInput = z.infer<typeof createInvestmentSchema>;

export const updateInvestmentSchema = createInvestmentSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateInvestmentInput = z.infer<typeof updateInvestmentSchema>;

export const investmentDocSchema = z.object({
  id: firestoreIdSchema,
  name: z.string(),
  investment_type: investmentTypeSchema.optional(),
  buy_price: z.number(),
  current_price: z.number(),
  quantity: z.number(),
  sip_amount: z.number().optional(),
  scheme_code: z.string().optional(),
  fund_house: z.string().optional(),
  linked_goal_id: z.string().nullable().optional(),
  account_id: z.string().nullable().optional(),
  linked_transaction_id: z.string().nullable().optional(),
  needs_allocation: z.boolean().optional(),
  createdAt: z.string().or(z.date()).optional(),
  _source: z.string().optional(),
  // Gold-specific fields
  purity: z.number().optional(),
  form: goldFormSchema.optional(),
  weight_grams: z.number().optional(),
  making_charges: z.number().optional(),
  purchase_date: z.string().optional(),
  // Manual "Other" instruments
  interest_rate: z.number().optional(),
  start_date: z.string().optional(),
  maturity_date: z.string().optional(),
  institution: z.string().optional(),
  compounding: compoundingSchema.optional(),
  interest_payout: interestPayoutSchema.optional(),
  // Mutual-fund NAV bookkeeping
  nav_date: z.string().optional(),
  last_nav_update: z.string().optional(),
  // Computed/alternative value fields used by UI
  invested_amount: z.number().optional(),
  current_value: z.number().optional(),
  // SIP linkage (UI convenience; populated from the sips collection)
  has_active_sip: z.boolean().optional(),
});

export type InvestmentDoc = z.infer<typeof investmentDocSchema>;
