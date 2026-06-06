import { z } from "zod";
import { moneyInputSchema } from "./common";

export const currencyCodeSchema = z.enum(["INR", "USD", "EUR", "GBP", "AED"]);

export const notificationPreferencesSchema = z.object({
  bills: z.boolean().default(true),
  budgets: z.boolean().default(true),
  recurring: z.boolean().default(true),
  anomalies: z.boolean().default(true),
  nav: z.boolean().default(false),
  weeklySummary: z.boolean().default(true),
});

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export const updateProfileSchema = z
  .object({
    cycleStartDay: z.coerce.number().int().min(1).max(28).optional(),
    monthlySalary: moneyInputSchema.optional(),
    onboardingComplete: z.boolean().optional(),
    displayName: z.string().min(1).max(100).optional(),
    currency: currencyCodeSchema.optional(),
    notificationPrefs: notificationPreferencesSchema.partial().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const profileDocSchema = z.object({
  cycleStartDay: z.number().int().min(1).max(28).default(25),
  monthlySalary: z.number().default(0),
  onboardingComplete: z.boolean().default(false),
  displayName: z.string().optional(),
  currency: currencyCodeSchema.default("INR"),
  notificationPrefs: notificationPreferencesSchema.optional(),
  updatedAt: z.string().or(z.date()).optional(),
});

export type ProfileDoc = z.infer<typeof profileDocSchema>;
