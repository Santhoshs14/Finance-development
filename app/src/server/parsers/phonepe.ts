import type { BankParser } from "./index";
import { parseUpiRows, UPI_CREDIT_WORDS, UPI_DEBIT_WORDS } from "./upiCommon";

export const phonepeParser: BankParser = {
  bank: "PhonePe",
  detect: (text) => /PhonePe/i.test(text),
  parse: (text) => parseUpiRows(text, UPI_DEBIT_WORDS, UPI_CREDIT_WORDS),
};
