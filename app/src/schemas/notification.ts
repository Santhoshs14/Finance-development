import { z } from "zod";
import { firestoreIdSchema } from "./common";

export const notificationTypeSchema = z.enum([
  "bill_due",
  "cc_due",
  "budget_warning",
  "budget_exceeded",
  "recurring_executed",
  "insight",
  "anomaly_detected",
  "goal_milestone",
  "security",
  "nav_update",
]);

export const createNotificationSchema = z.object({
  type: notificationTypeSchema,
  title: z.string().min(1).max(150),
  message: z.string().min(1).max(500),
  link: z.string().max(500).optional(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;

export const markReadSchema = z
  .object({
    ids: z.array(firestoreIdSchema).max(50).optional(),
    markAllRead: z.boolean().optional(),
  })
  .refine((d) => d.ids?.length || d.markAllRead, {
    message: "ids array or markAllRead required",
  });

export type MarkReadInput = z.infer<typeof markReadSchema>;

export const deleteNotificationsSchema = z
  .object({
    ids: z.array(firestoreIdSchema).max(50).optional(),
    clearAll: z.boolean().optional(),
  })
  .refine((d) => d.ids?.length || d.clearAll, {
    message: "ids array or clearAll required",
  });

export type DeleteNotificationsInput = z.infer<typeof deleteNotificationsSchema>;

export const notificationDocSchema = z.object({
  id: firestoreIdSchema,
  type: notificationTypeSchema,
  title: z.string(),
  message: z.string(),
  link: z.string().optional(),
  read: z.boolean(),
  createdAt: z.string().or(z.date()),
});

export type NotificationDoc = z.infer<typeof notificationDocSchema>;
