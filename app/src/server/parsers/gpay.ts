import type { BankParser } from "./index";
import { parseUpiRows, UPI_CREDIT_WORDS, UPI_DEBIT_WORDS } from "./upiCommon";

export const gpayParser: BankParser = {
  bank: "Google Pay",
  detect: (text) => /Google\s*Pay|GPay/i.test(text),
  parse: (text) => parseUpiRows(text, UPI_DEBIT_WORDS, UPI_CREDIT_WORDS),
};
