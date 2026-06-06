import { z } from "zod";
import { firestoreIdSchema, isoDateSchema, moneyInputSchema } from "./common";

export const recurringFrequencySchema = z.enum(["weekly", "monthly", "yearly"]);

export const recurringStatusSchema = z.enum(["active", "paused", "stopped"]);

export const createRecurringSchema = z.object({
  description: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  amount: moneyInputSchema.refine((n) => n !== 0, {
    message: "amount must be non-zero",
  }),
  frequency: recurringFrequencySchema,
  next_date: isoDateSchema,
  account_id: z.string().max(128).optional().nullable(),
  payment_type: z.string().max(50).optional().nullable(),
  type: z.enum(["income", "expense"]).default("expense"),
});

export type CreateRecurringInput = z.infer<typeof createRecurringSchema>;

export const updateRecurringSchema = createRecurringSchema
  .partial()
  .extend({ status: recurringStatusSchema.optional() })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>;

export const recurringDocSchema = z.object({
  id: firestoreIdSchema,
  description: z.string(),
  category: z.string(),
  amount: z.number(),
  frequency: recurringFrequencySchema,
  next_date: isoDateSchema,
  account_id: z.string().nullable().optional(),
  payment_type: z.string().nullable().optional(),
  type: z.enum(["income", "expense"]),
  status: recurringStatusSchema,
  last_executed: isoDateSchema.nullable().optional(),
  createdAt: z.string().or(z.date()).optional(),
});

export type RecurringDoc = z.infer<typeof recurringDocSchema>;
