import { z } from "zod";

/** ISO-formatted YYYY-MM-DD calendar date (no timezone). */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

/** Firestore-friendly id (auto-generated, alphanumeric). */
export const firestoreIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid id");

/** Financial cycle key: "YYYY-MM" (e.g. "2026-06"). */
export const cycleKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "cycleKey must be YYYY-MM");

/** Standard error response shape returned by every API route. */
export const errorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/** Standard pagination cursor. */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().nullish(),
});

export type Pagination = z.infer<typeof paginationSchema>;

/** Currency amount (in INR, positive or negative, max 2dp). */
export const moneySchema = z
  .number()
  .finite()
  .refine((n) => Number.isFinite(n) && Math.round(n * 100) === n * 100, {
    message: "Amount must have at most 2 decimal places",
  });

/** Money input that accepts string or number and coerces. */
export const moneyInputSchema = z
  .union([z.string(), z.number()])
  .transform((v) => parseFloat(String(v)))
  .pipe(moneySchema);
