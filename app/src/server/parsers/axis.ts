import type { BankParser, ParsedTransaction } from "./index";

// Axis: 04/06/26  TRANSFER TO ABC  500.00  DR
const ROW = /(\d{2}\/\d{2}\/\d{2})\s+(.+?)\s+([\d,]+\.\d{2})\s+(DR|CR)/g;

function toIso(dmYY: string): string {
  const [d, m, yy] = dmYY.split("/");
  if (!d || !m || !yy) return dmYY;
  const year = 2000 + parseInt(yy, 10);
  return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export const axisParser: BankParser = {
  bank: "Axis Bank",
  detect: (text) => /AXIS\s*BANK|UTIB0/i.test(text),
  parse: (text) => {
    const txns: ParsedTransaction[] = [];
    let m: RegExpExecArray | null;
    while ((m = ROW.exec(text)) !== null) {
      const [, date, desc, amtStr, drCr] = m;
      if (!date || !desc || !amtStr || !drCr) continue;
      const amount = parseFloat(amtStr.replace(/,/g, ""));
      const signed = drCr === "DR" ? -amount : amount;
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
