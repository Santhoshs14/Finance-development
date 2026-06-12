import { z } from "zod";
import { cycleKeySchema, firestoreIdSchema } from "./common";

/**
 * Net-worth snapshots are keyed by financial month ("YYYY-MM"). This shape
 * matches what the UI (`/wealth/net-worth`) and the `/api/net-worth/snapshots`
 * route read and write — a single source of truth across client, API, and cron.
 */
export const saveNetWorthSnapshotSchema = z.object({
  month: cycleKeySchema,
  accounts: z.number(),
  investments: z.number(),
  cc_outstanding: z.number(),
  lent: z.number(),
  borrowed: z.number(),
  net_worth: z.number(),
});

export type SaveNetWorthSnapshotInput = z.infer<typeof saveNetWorthSnapshotSchema>;

export const netWorthSnapshotDocSchema = z.object({
  id: firestoreIdSchema,
  month: cycleKeySchema,
  accounts: z.number(),
  investments: z.number(),
  cc_outstanding: z.number(),
  lent: z.number(),
  borrowed: z.number(),
  net_worth: z.number(),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
});

export type NetWorthSnapshotDoc = z.infer<typeof netWorthSnapshotDocSchema>;
