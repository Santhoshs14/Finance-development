import { z } from "zod";
import { moneyInputSchema } from "./common";

/**
 * Tax profile is stored per financial year at
 * `users/{uid}/taxProfiles/{fyKey}` (e.g. "FY2025-26"). It is the
 * server-persisted replacement for the old `localStorage` tax data, so the
 * calculator syncs across devices.
 */

export const taxDeductionSectionSchema = z.enum([
  "80C",
  "80D",
  "80D_parents",
  "80CCD",
  "HRA",
  "80E",
  "80G",
  "other",
]);

export const taxDeductionEntrySchema = z.object({
  id: z.string().min(1).max(64),
  description: z.string().min(1).max(200),
  amount: moneyInputSchema,
  section: taxDeductionSectionSchema,
});

export const hraInputSchema = z.object({
  basicSalary: moneyInputSchema.optional(),
  hraReceived: moneyInputSchema.optional(),
  rentPaid: moneyInputSchema.optional(),
  isMetro: z.boolean().optional(),
});

export const capitalGainAssetClassSchema = z.enum([
  "equity_mf",
  "debt_mf",
  "gold",
  "equity",
]);

/** A realized sale used for FIFO capital-gains computation. */
export const capitalGainSaleSchema = z.object({
  id: z.string().min(1).max(64),
  asset: z.string().min(1).max(120),
  assetClass: capitalGainAssetClassSchema,
  buyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sellDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  units: z.coerce.number().positive(),
  buyPrice: moneyInputSchema,
  sellPrice: moneyInputSchema,
});

export const saveTaxProfileSchema = z.object({
  regime: z.enum(["new", "old"]).optional(),
  grossIncome: moneyInputSchema.optional(),
  npsEmployer: moneyInputSchema.optional(),
  entries: z.array(taxDeductionEntrySchema).max(100).optional(),
  hra: hraInputSchema.optional(),
  capitalGains: z.array(capitalGainSaleSchema).max(200).optional(),
});

export type SaveTaxProfileInput = z.infer<typeof saveTaxProfileSchema>;
export type TaxDeductionEntry = z.infer<typeof taxDeductionEntrySchema>;
export type CapitalGainSale = z.infer<typeof capitalGainSaleSchema>;
export type HraInput = z.infer<typeof hraInputSchema>;

export const taxProfileDocSchema = saveTaxProfileSchema.extend({
  fy: z.string(),
  updatedAt: z.string().or(z.date()).optional(),
});

export type TaxProfileDoc = z.infer<typeof taxProfileDocSchema>;
