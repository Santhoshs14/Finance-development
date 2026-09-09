import { createHash } from "crypto";
import { z } from "zod";
import { getFinancialCycleForDate } from "@/utils/financialMonth";
import {
  transitionDeltas,
  type AggregatableTxn,
  type CycleDeltas,
} from "@/server/aggregates/delta";

export const batchItemSchema = z.object({
  date: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .pipe(z.string().min(1).max(40)),
  amount: z.coerce.number().finite(),
  category: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
  notes: z.string().max(1000).optional(),
  payment_type: z.string().max(50).optional(),
  type: z.enum(["income", "expense"]).optional(),
  account_id: z.string().max(128).optional().nullable(),
});

export interface PreparedRow {
  importHash: string;
  cycleKey: string;
  category: string;
  type: "income" | "expense";
  magnitude: number;
  accountId: string | null;
  data: Record<string, unknown>;
}

export interface PrepareResult {
  rows: PreparedRow[];
  skipped: number;
}

/**
 * Normalises parsed statement rows into transaction documents.
 * The import hash doubles as the document id, so re-importing a statement is a no-op.
 */
export function prepareImportRows(
  raw: unknown[],
  opts: { ownedAccountIds: Set<string>; cycleStartDay: number }
): PrepareResult {
  const rows: PreparedRow[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const candidate of raw) {
    const item = batchItemSchema.safeParse(candidate);
    if (!item.success) {
      skipped++;
      continue;
    }

    const { date, amount, category, description, notes, payment_type, account_id } =
      item.data;

    const accountId =
      account_id && opts.ownedAccountIds.has(account_id) ? account_id : null;
    const type = item.data.type ?? (amount > 0 ? "income" : "expense");
    const magnitude = Math.abs(amount);
    const signedAmount = type === "expense" ? -magnitude : magnitude;
    const resolvedCategory = category || (type === "income" ? "Income" : "Other");
    const text = description || notes || "";

    const importHash = createHash("sha256")
      .update(`${date}|${signedAmount}|${text}|${accountId ?? ""}`)
      .digest("hex")
      .slice(0, 32);

    if (seen.has(importHash)) {
      skipped++;
      continue;
    }
    seen.add(importHash);

    const cycleKey = getFinancialCycleForDate(date, opts.cycleStartDay).cycleKey;

    rows.push({
      importHash,
      cycleKey,
      category: resolvedCategory,
      type,
      magnitude,
      accountId,
      data: {
        date,
        amount: signedAmount,
        category: resolvedCategory,
        description: description || "",
        notes: notes || "",
        payment_type: payment_type || "UPI",
        type,
        account_id: accountId ?? "",
        cycleKey,
        import_hash: importHash,
        source: "statement_import",
      },
    });
  }

  return { rows, skipped };
}

/** Aggregate field deltas keyed by cycle, plus per-account balance deltas. */
export function computeImportDeltas(
  rows: PreparedRow[],
  investmentCategories: Set<string> = new Set()
) {
  const aggregates: CycleDeltas = new Map();
  const accounts = new Map<string, number>();

  for (const row of rows) {
    for (const [cycleKey, fields] of transitionDeltas(
      null,
      row.data as AggregatableTxn,
      investmentCategories
    )) {
      const existing = aggregates.get(cycleKey) ?? new Map<string, number>();
      for (const [field, by] of fields) {
        existing.set(field, (existing.get(field) ?? 0) + by);
      }
      aggregates.set(cycleKey, existing);
    }

    if (row.accountId) {
      const delta = row.type === "expense" ? -row.magnitude : row.magnitude;
      accounts.set(row.accountId, (accounts.get(row.accountId) ?? 0) + delta);
    }
  }

  return { aggregates, accounts };
}
