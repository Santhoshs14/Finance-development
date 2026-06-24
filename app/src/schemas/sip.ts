import { z } from "zod";
import { firestoreIdSchema, isoDateSchema, moneyInputSchema } from "./common";
import { recurringFrequencySchema, recurringStatusSchema } from "./recurring";

/**
 * Systematic Investment Plan (SIP) schedule.
 *
 * A SIP lives in `users/{uid}/sips/{id}` and is its own engine: the daily
 * `/api/cron/sip` job runs in the evening (after the AMFI NAV refresh) and, for
 * each due SIP, buys `amount / NAV` units of the linked mutual-fund holding,
 * deducts the cash from `account_id`, and advances `next_date`. SIPs are also
 * surfaced (read-only) on the Recurring Transactions page.
 */
export const createSipSchema = z.object({
  /** The mutual-fund holding (users/{uid}/investments/{id}) this SIP feeds. */
  investment_id: z.string().max(128).optional().nullable(),
  /** AMFI scheme code — required for the engine to look up the day's NAV. */
  scheme_code: z.string().min(1).max(50),
  fund_name: z.string().min(1).max(150),
  fund_house: z.string().max(100).optional().nullable(),
  amount: moneyInputSchema.refine((n) => n > 0, {
    message: "SIP amount must be positive",
  }),
  frequency: recurringFrequencySchema,
  /** Preferred day-of-month for monthly SIPs (1-28). Informational. */
  day_of_month: z.coerce.number().int().min(1).max(28).optional(),
  next_date: isoDateSchema,
  /** Funding account (bank/wallet/cash/credit). */
  account_id: z.string().min(1).max(128),
  linked_goal_id: z.string().max(128).optional().nullable(),
});

export type CreateSipInput = z.infer<typeof createSipSchema>;

export const updateSipSchema = createSipSchema
  .partial()
  .extend({ status: recurringStatusSchema.optional() })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateSipInput = z.infer<typeof updateSipSchema>;

export const sipDocSchema = z.object({
  id: firestoreIdSchema,
  investment_id: z.string().nullable().optional(),
  scheme_code: z.string(),
  fund_name: z.string(),
  fund_house: z.string().nullable().optional(),
  amount: z.number(),
  frequency: recurringFrequencySchema,
  day_of_month: z.number().optional(),
  next_date: isoDateSchema,
  account_id: z.string(),
  linked_goal_id: z.string().nullable().optional(),
  status: recurringStatusSchema,
  last_executed: isoDateSchema.nullable().optional(),
  installments_done: z.number().optional(),
  total_invested: z.number().optional(),
  total_units: z.number().optional(),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
});

export type SipDoc = z.infer<typeof sipDocSchema>;
