import { z } from "zod";
import { firestoreIdSchema, isoDateSchema, moneyInputSchema } from "./common";

export const lendingTypeSchema = z.enum(["lent", "borrowed"]);

export const lendingStatusSchema = z.enum(["pending", "partial", "completed"]);

export const createLendingSchema = z.object({
  type: lendingTypeSchema,
  person_name: z.string().min(1).max(100),
  amount: moneyInputSchema.refine((n) => n > 0, {
    message: "amount must be positive",
  }),
  date: isoDateSchema,
  description: z.string().max(500).optional(),
  status: lendingStatusSchema.optional(),
});

export type CreateLendingInput = z.infer<typeof createLendingSchema>;

export const updateLendingSchema = createLendingSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateLendingInput = z.infer<typeof updateLendingSchema>;

export const repayLendingSchema = z.object({
  amount: moneyInputSchema.refine((n) => n > 0, {
    message: "repayment amount must be positive",
  }),
});

export type RepayLendingInput = z.infer<typeof repayLendingSchema>;

export const lendingDocSchema = z.object({
  id: firestoreIdSchema,
  type: lendingTypeSchema,
  person_name: z.string(),
  amount: z.number(),
  paid_amount: z.number().optional(),
  date: isoDateSchema,
  description: z.string().optional(),
  status: lendingStatusSchema,
  createdAt: z.string().or(z.date()).optional(),
});

export type LendingDoc = z.infer<typeof lendingDocSchema>;
