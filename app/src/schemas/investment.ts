import { z } from "zod";
import { firestoreIdSchema, moneyInputSchema } from "./common";

export const investmentTypeSchema = z.enum([
  "Mutual Fund",
  "Equity",
  "Gold",
  "Bond",
  "FD",
  "PPF",
  "NPS",
  "ELSS",
  "Other",
]);

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
});

export type InvestmentDoc = z.infer<typeof investmentDocSchema>;
