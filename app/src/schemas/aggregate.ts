import { z } from "zod";
import { cycleKeySchema } from "./common";

export const aggregateDocSchema = z.object({
  totalSpent: z.number().default(0),
  totalIncome: z.number().default(0),
  /** Total spent on categories classified as "investment" (productive spending). */
  totalInvestmentSpend: z.number().default(0),
  transactionCount: z.number().int().nonnegative().default(0),
  categoryBreakdown: z.record(z.string(), z.number()).default({}),
  cycleKey: cycleKeySchema.optional(),
  updatedAt: z.string().or(z.date()).optional(),
});

export type AggregateDoc = z.infer<typeof aggregateDocSchema>;
