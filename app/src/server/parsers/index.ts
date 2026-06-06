/**
 * Bank-statement parser registry.
 *
 * Each bank module exports `detect(text)` (returns true if the text
 * looks like that bank's statement) and `parse(text)` (yields
 * `ParsedTransaction[]`). Adding a new bank is a single file.
 */
import { hdfcParser } from "./hdfc";
import { sbiParser } from "./sbi";
import { iciciParser } from "./icici";
import { axisParser } from "./axis";
import { kotakParser } from "./kotak";
import { genericParser } from "./generic";

export interface ParsedTransaction {
  date: string;         // YYYY-MM-DD
  amount: number;       // negative for debit, positive for credit
  description: string;
  type: "income" | "expense";
  /** SHA-256 hash for de-dup (computed by caller). */
  import_hash?: string;
}

export interface BankParser {
  bank: string;
  detect(text: string): boolean;
  parse(text: string): ParsedTransaction[];
}

const PARSERS: BankParser[] = [
  hdfcParser,
  sbiParser,
  iciciParser,
  axisParser,
  kotakParser,
];

export interface DetectionResult {
  bank: string;
  transactions: ParsedTransaction[];
  matched: boolean;
}

export function detectAndParse(text: string): DetectionResult {
  for (const p of PARSERS) {
    if (p.detect(text)) {
      const transactions = p.parse(text);
      if (transactions.length > 0) {
        return { bank: p.bank, transactions, matched: true };
      }
    }
  }
  // Fall back to a generic parser that hunts for the common
  // date | description | amount layout.
  const generic = genericParser.parse(text);
  return {
    bank: "Generic",
    transactions: generic,
    matched: generic.length > 0,
  };
}
