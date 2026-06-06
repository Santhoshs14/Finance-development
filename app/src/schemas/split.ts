import { z } from "zod";
import { firestoreIdSchema, isoDateSchema, moneyInputSchema } from "./common";

export const participantSchema = z.object({
  name: z.string().min(1).max(100),
  share: moneyInputSchema.refine((n) => n >= 0, {
    message: "share must be non-negative",
  }),
});

export const settlementSchema = z.object({
  from: z.string().min(1).max(100),
  to: z.string().min(1).max(100),
  amount: moneyInputSchema.refine((n) => n > 0, {
    message: "settlement amount must be positive",
  }),
  date: isoDateSchema.optional(),
});

export const createSplitSchema = z.object({
  description: z.string().min(1).max(200),
  total_amount: moneyInputSchema.refine((n) => n > 0, {
    message: "total_amount must be positive",
  }),
  date: isoDateSchema,
  paid_by: z.string().min(1).max(100),
  participants: z.array(participantSchema).min(1),
});

export type CreateSplitInput = z.infer<typeof createSplitSchema>;

export const settleSplitSchema = z.object({
  from: z.string().min(1).max(100),
  to: z.string().min(1).max(100),
  amount: moneyInputSchema.refine((n) => n > 0, {
    message: "settlement amount must be positive",
  }),
});

export type SettleSplitInput = z.infer<typeof settleSplitSchema>;

export const splitDocSchema = z.object({
  id: firestoreIdSchema,
  description: z.string(),
  total_amount: z.number().positive(),
  date: isoDateSchema,
  paid_by: z.string(),
  participants: z.array(participantSchema),
  settled: z.boolean(),
  settlements: z.array(settlementSchema),
  createdAt: z.string().or(z.date()).optional(),
});

export type SplitDoc = z.infer<typeof splitDocSchema>;
