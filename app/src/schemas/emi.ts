import { z } from "zod";
import { firestoreIdSchema, isoDateSchema, moneyInputSchema } from "./common";

export const emiStatusSchema = z.enum(["active", "completed", "closed"]);

export const createEmiSchema = z.object({
  cardId: z.string().max(128).optional().nullable(),
  description: z.string().min(1).max(200),
  totalAmount: moneyInputSchema.refine((n) => n > 0, {
    message: "totalAmount must be positive",
  }),
  emiAmount: moneyInputSchema.refine((n) => n > 0, {
    message: "emiAmount must be positive",
  }),
  tenure: z.coerce.number().int().min(1).max(360),
  monthsPaid: z.coerce.number().int().min(0).default(0),
  interestRate: z.coerce.number().min(0).max(100).default(0),
  startDate: isoDateSchema.optional(),
  status: emiStatusSchema.optional(),
  paidAmount: moneyInputSchema.optional(),
  lastPaymentDate: isoDateSchema.optional(),
});

export type CreateEmiInput = z.infer<typeof createEmiSchema>;

export const updateEmiSchema = createEmiSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateEmiInput = z.infer<typeof updateEmiSchema>;

export const emiDocSchema = z.object({
  id: firestoreIdSchema,
  cardId: z.string().nullable().optional(),
  description: z.string(),
  totalAmount: z.number().positive(),
  emiAmount: z.number().positive(),
  tenure: z.number().int(),
  monthsPaid: z.number().int(),
  interestRate: z.number(),
  startDate: isoDateSchema,
  status: emiStatusSchema.optional(),
  paidAmount: z.number().optional(),
  lastPaymentDate: isoDateSchema.optional(),
  createdAt: z.string().or(z.date()).optional(),
});

export type EmiDoc = z.infer<typeof emiDocSchema>;
