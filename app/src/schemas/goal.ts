import { z } from "zod";
import { firestoreIdSchema, isoDateSchema, moneyInputSchema } from "./common";

export const createGoalSchema = z.object({
  goal_name: z.string().min(1).max(100),
  target_amount: moneyInputSchema.refine((n) => n > 0, {
    message: "target_amount must be positive",
  }),
  current_amount: moneyInputSchema.optional(),
  deadline: isoDateSchema,
  description: z.string().max(500).optional(),
  linked_funds: z.array(z.string()).optional(),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;

export const updateGoalSchema = createGoalSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;

export const goalDocSchema = z.object({
  id: firestoreIdSchema,
  goal_name: z.string(),
  target_amount: z.number().positive(),
  current_amount: z.number().optional(),
  deadline: isoDateSchema,
  description: z.string().optional(),
  linked_funds: z.array(z.string()).optional(),
  createdAt: z.string().or(z.date()).optional(),
});

export type GoalDoc = z.infer<typeof goalDocSchema>;
