import type { ParsedTransaction } from "./index";

/** Convert `DD-MM-YYYY` or `DD/MM/YYYY` to ISO `YYYY-MM-DD`. */
function toIso(d: string): string {
  const sep = d.includes("/") ? "/" : "-";
  const [dd, mm, yyyy] = d.split(sep);
  if (!dd || !mm || !yyyy) return d;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

/**
 * Parse the common UPI-statement row layout shared by PhonePe / Google Pay /
 * Paytm exports:
 *
 *   `DD-MM-YYYY <description> <DEBIT|CREDIT> ₹<amount>`
 *
 * `debitWords` / `creditWords` are the type-column labels a given app uses.
 * These are best-effort heuristics (UPI PDF exports vary); the import UI lets
 * the user review the result before committing — same contract as the generic
 * bank fallback.
 */
export function parseUpiRows(
  text: string,
  debitWords: string[],
  creditWords: string[]
): ParsedTransaction[] {
  const labels = [...debitWords, ...creditWords].join("|");
  const re = new RegExp(
    `(\\d{2}[-/]\\d{2}[-/]\\d{4})\\s+(.+?)\\s+(${labels})\\s+\u20b9?\\s*([\\d,]+(?:\\.\\d{1,2})?)`,
    "gi"
  );
  const debitSet = new Set(debitWords.map((w) => w.toLowerCase()));

  const txns: ParsedTransaction[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const [, date, desc, kind, amtStr] = m;
    if (!date || !desc || !kind || !amtStr) continue;
    const amount = parseFloat(amtStr.replace(/,/g, ""));
    if (!Number.isFinite(amount)) continue;
    const signed = debitSet.has(kind.toLowerCase()) ? -amount : amount;
    txns.push({
      date: toIso(date),
      amount: signed,
      description: desc.trim(),
      type: signed < 0 ? "expense" : "income",
    });
  }
  return txns;
}

/** Standard UPI debit/credit labels seen across PhonePe / GPay / Paytm. */
export const UPI_DEBIT_WORDS = ["DEBIT", "DEBITED"];
export const UPI_CREDIT_WORDS = ["CREDIT", "CREDITED"];
