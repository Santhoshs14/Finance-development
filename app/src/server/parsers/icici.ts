import type { BankParser, ParsedTransaction } from "./index";

// ICICI: 04-06-2026  UPI/ABCD/1234567  1,500.00  Dr  35,000.00
const ROW = /(\d{2}-\d{2}-\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s+(Dr|Cr)/g;

function toIso(dmy: string): string {
  const [d, m, y] = dmy.split("-");
  if (!d || !m || !y) return dmy;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export const iciciParser: BankParser = {
  bank: "ICICI Bank",
  detect: (text) => /ICICI\s*BANK|ICICI0/i.test(text),
  parse: (text) => {
    const txns: ParsedTransaction[] = [];
    let m: RegExpExecArray | null;
    while ((m = ROW.exec(text)) !== null) {
      const [, date, desc, amtStr, drCr] = m;
      if (!date || !desc || !amtStr || !drCr) continue;
      const amount = parseFloat(amtStr.replace(/,/g, ""));
      const signed = drCr === "Dr" ? -amount : amount;
      txns.push({
        date: toIso(date),
        amount: signed,
        description: desc.trim(),
        type: signed < 0 ? "expense" : "income",
      });
    }
    return txns;
  },
};
