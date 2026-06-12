import { z } from "zod";
import { firestoreIdSchema, moneyInputSchema } from "./common";

export const accountTypeSchema = z.enum([
  "bank",
  "wallet",
  "cash",
  "credit",
]);

export const createAccountSchema = z.object({
  account_name: z.string().min(1).max(100),
  type: accountTypeSchema,
  balance: moneyInputSchema.optional(),
  credit_limit: moneyInputSchema.optional(),
  liability: moneyInputSchema.optional(),
  shared_limit_with: z.string().max(128).optional().nullable(),
  billing_cycle_start_day: z.coerce.number().int().min(1).max(28).optional(),
  due_days_after: z.coerce.number().int().min(0).max(60).optional(),
  account_type: z.string().max(50).optional(),
  // Per-card reward configuration (credit cards only).
  reward_rate: z.coerce.number().min(0).max(100).optional(), // base points per ₹100 spent
  point_value: z.coerce.number().min(0).max(1000).optional(), // ₹ value per reward point
  reward_points_balance: z.coerce.number().min(0).optional(), // accumulated points
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = createAccountSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

export const accountDocSchema = z.object({
  id: firestoreIdSchema,
  account_name: z.string(),
  type: accountTypeSchema,
  balance: z.number().optional(),
  credit_limit: z.number().optional(),
  liability: z.number().optional(),
  shared_limit_with: z.string().nullable().optional(),
  billing_cycle_start_day: z.number().optional(),
  due_days_after: z.number().optional(),
  account_type: z.string().optional(),
  reward_rate: z.number().optional(),
  point_value: z.number().optional(),
  reward_points_balance: z.number().optional(),
  createdAt: z.string().or(z.date()).optional(),
});

export type AccountDoc = z.infer<typeof accountDocSchema>;
