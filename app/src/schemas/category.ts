import { z } from "zod";
import { firestoreIdSchema } from "./common";

export const categoryTypeSchema = z.enum(["income", "expense"]);

/** Classification for how the category contributes to financial health. */
export const categoryClassificationSchema = z.enum([
  "discretionary",
  "essential",
  "investment",
]);

export type CategoryClassification = z.infer<typeof categoryClassificationSchema>;

/** Indian tax section tag for 80C/80D-eligible categories. */
export const taxSectionSchema = z.enum([
  "80C",
  "80D",
  "80CCD(1B)",
  "80E",
  "80G",
  "80TTA",
  "HRA",
  "None",
]);

export const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  type: categoryTypeSchema,
  icon: z.string().max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "color must be a hex code")
    .optional(),
  tax_section: taxSectionSchema.optional(),
  classification: categoryClassificationSchema.optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const categoryDocSchema = z.object({
  id: firestoreIdSchema,
  name: z.string(),
  type: categoryTypeSchema,
  icon: z.string().optional(),
  color: z.string().optional(),
  tax_section: taxSectionSchema.optional(),
  classification: categoryClassificationSchema.optional(),
  createdAt: z.string().or(z.date()).optional(),
});

export type CategoryDoc = z.infer<typeof categoryDocSchema>;

/**
 * Categories that are implicitly classified as "investment" (productive spending)
 * when no explicit classification is set. Used as fallback for existing data.
 */
export const DEFAULT_INVESTMENT_CATEGORIES = new Set(["Investment"]);
