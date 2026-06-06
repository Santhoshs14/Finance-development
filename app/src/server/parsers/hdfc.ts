import type { BankParser, ParsedTransaction } from "./index";

const ROW = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s+(Dr|Cr)/g;

function toIso(dmy: string): string {
  const [d, m, y] = dmy.split("/");
  if (!d || !m || !y) return dmy;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export const hdfcParser: BankParser = {
  bank: "HDFC Bank",
  detect: (text) => /HDFC\s*BANK/i.test(text),
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
