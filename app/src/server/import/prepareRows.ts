import { createHash } from "crypto";
import { z } from "zod";
import { getFinancialCycleForDate } from "@/utils/financialMonth";

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
export function computeImportDeltas(rows: PreparedRow[]) {
  const aggregates = new Map<string, Map<string, number>>();
  const accounts = new Map<string, number>();

  for (const row of rows) {
    const agg = aggregates.get(row.cycleKey) ?? new Map<string, number>();
    const bump = (field: string, by: number) => agg.set(field, (agg.get(field) ?? 0) + by);

    if (row.type === "expense") {
      bump("totalSpent", row.magnitude);
      bump(`categoryBreakdown.${row.category}`, row.magnitude);
    } else {
      bump("totalIncome", row.magnitude);
      bump("categoryBreakdown.Income", row.magnitude);
    }
    bump("transactionCount", 1);
    aggregates.set(row.cycleKey, agg);

    if (row.accountId) {
      const delta = row.type === "expense" ? -row.magnitude : row.magnitude;
      accounts.set(row.accountId, (accounts.get(row.accountId) ?? 0) + delta);
    }
  }

  return { aggregates, accounts };
}
