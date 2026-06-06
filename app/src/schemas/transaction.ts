import { z } from "zod";
import { cycleKeySchema, firestoreIdSchema, isoDateSchema, moneyInputSchema } from "./common";

export const transactionTypeSchema = z.enum(["income", "expense"]);

export const paymentTypeSchema = z.enum([
  "Cash",
  "UPI",
  "Debit Card",
  "Credit Card",
  "Net Banking",
  "Self Transfer",
  "Cheque",
  "Other",
]);

// Bare object so we can derive `.partial()` for updates.
export const transactionInputBase = z.object({
  amount: moneyInputSchema.refine((n) => n !== 0, {
    message: "amount must be non-zero",
  }),
  type: transactionTypeSchema.optional(),
  category: z.string().min(1).max(100),
  account_id: z.string().max(128).optional().nullable(),
  to_account_id: z.string().max(128).optional().nullable(),
  date: isoDateSchema,
  description: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  payment_type: paymentTypeSchema.optional().nullable(),
  is_recurring: z.boolean().optional(),
  recurring_frequency: z.string().optional().nullable(),
  recurrence_interval: z.string().optional().nullable(),
  linked_investment_id: z.string().max(128).optional().nullable(),
});

/** Shape that API routes validate when creating a transaction. */
export const createTransactionSchema = transactionInputBase.refine(
  (d) =>
    d.payment_type !== "Self Transfer" ||
    (d.to_account_id && d.to_account_id.length > 0),
  {
    message: "Self Transfer requires to_account_id",
    path: ["to_account_id"],
  }
);

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

/** Patch shape (all fields optional except guard). */
export const updateTransactionSchema = transactionInputBase
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

/** Full Firestore document shape. */
export const transactionDocSchema = z.object({
  id: firestoreIdSchema,
  amount: z.number(),
  type: transactionTypeSchema,
  category: z.string(),
  account_id: z.string().nullable().optional(),
  date: isoDateSchema,
  description: z.string().optional(),
  notes: z.string().optional(),
  payment_type: z.string().nullable().optional(),
  cycleKey: cycleKeySchema.optional(),
  is_recurring: z.boolean().optional(),
  recurring_frequency: z.string().nullable().optional(),
  linked_transfer_id: z.string().nullable().optional(),
  linked_investment_id: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
  import_hash: z.string().optional(),
});

export type TransactionDoc = z.infer<typeof transactionDocSchema>;

/** Query string for GET /api/transactions */
export const transactionListQuerySchema = z.object({
  cycleKey: cycleKeySchema.optional().nullable(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().nullish(),
  type: transactionTypeSchema.optional().nullable(),
  category: z.string().optional().nullable(),
  account_id: z.string().optional().nullable(),
});

export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>;
