import { z } from "zod";
import { cycleKeySchema, firestoreIdSchema, moneyInputSchema } from "./common";

export const createBudgetSchema = z.object({
  cycleKey: cycleKeySchema,
  category: z.string().min(1).max(100),
  monthly_limit: moneyInputSchema.refine((n) => n > 0, {
    message: "monthly_limit must be positive",
  }),
  /** When true, this budget is an investment target — exceeding is positive. */
  is_investment_target: z.boolean().optional(),
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;

export const updateBudgetSchema = z.object({
  monthly_limit: moneyInputSchema.refine((n) => n > 0, {
    message: "monthly_limit must be positive",
  }),
  is_investment_target: z.boolean().optional(),
});

export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;

export const budgetDocSchema = z.object({
  id: firestoreIdSchema,
  category: z.string(),
  monthly_limit: z.number().positive(),
  is_investment_target: z.boolean().optional(),
  createdAt: z.string().or(z.date()).optional(),
});

export type BudgetDoc = z.infer<typeof budgetDocSchema>;
