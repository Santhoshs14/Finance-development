import type { BankParser } from "./index";
import { parseUpiRows, UPI_CREDIT_WORDS, UPI_DEBIT_WORDS } from "./upiCommon";

export const paytmParser: BankParser = {
  bank: "Paytm",
  detect: (text) => /Paytm/i.test(text),
  parse: (text) => parseUpiRows(text, UPI_DEBIT_WORDS, UPI_CREDIT_WORDS),
};
