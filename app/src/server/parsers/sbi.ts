import type { BankParser, ParsedTransaction } from "./index";

// SBI statements typically have: 04 Jun 2026  TRANSFER FROM ...  -1500.00
const ROW =
  /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s+(.+?)\s+(-?[\d,]+\.\d{2})/gi;

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

export const sbiParser: BankParser = {
  bank: "State Bank of India",
  detect: (text) => /STATE\s+BANK\s+OF\s+INDIA|SBIN0/i.test(text),
  parse: (text) => {
    const txns: ParsedTransaction[] = [];
    let m: RegExpExecArray | null;
    while ((m = ROW.exec(text)) !== null) {
      const [, day, monthRaw, year, desc, amtStr] = m;
      if (!day || !monthRaw || !year || !desc || !amtStr) continue;
      const month = MONTHS[monthRaw.slice(0, 1).toUpperCase() + monthRaw.slice(1).toLowerCase()] ?? "01";
      const amount = parseFloat(amtStr.replace(/,/g, ""));
      txns.push({
        date: `${year}-${month}-${day.padStart(2, "0")}`,
        amount,
        description: desc.trim(),
        type: amount < 0 ? "expense" : "income",
      });
    }
    return txns;
  },
};
