import { z } from "zod";
import { firestoreIdSchema, isoDateSchema, moneyInputSchema } from "./common";

export const saveNetWorthSnapshotSchema = z.object({
  date: isoDateSchema,
  assets: moneyInputSchema,
  liabilities: moneyInputSchema,
  netWorth: moneyInputSchema,
  breakdown: z
    .object({
      bank: moneyInputSchema.optional(),
      investments: moneyInputSchema.optional(),
      lending: moneyInputSchema.optional(),
      credit: moneyInputSchema.optional(),
      gold: moneyInputSchema.optional(),
    })
    .optional(),
});

export type SaveNetWorthSnapshotInput = z.infer<typeof saveNetWorthSnapshotSchema>;

export const netWorthSnapshotDocSchema = z.object({
  id: firestoreIdSchema,
  date: isoDateSchema,
  assets: z.number(),
  liabilities: z.number(),
  netWorth: z.number(),
  breakdown: z
    .object({
      bank: z.number().optional(),
      investments: z.number().optional(),
      lending: z.number().optional(),
      credit: z.number().optional(),
      gold: z.number().optional(),
    })
    .optional(),
  createdAt: z.string().or(z.date()).optional(),
});

export type NetWorthSnapshotDoc = z.infer<typeof netWorthSnapshotDocSchema>;
