import type { BankParser, ParsedTransaction } from "./index";

const ROW = /(\d{2}-[A-Za-z]{3}-\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s+(D|C)/g;

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function toIso(s: string): string {
  const parts = s.split("-");
  const day = parts[0];
  const mon = parts[1]?.toLowerCase() ?? "";
  const year = parts[2];
  const m = MONTHS[mon] ?? "01";
  return `${year}-${m}-${(day ?? "01").padStart(2, "0")}`;
}

export const kotakParser: BankParser = {
  bank: "Kotak Mahindra Bank",
  detect: (text) => /KOTAK\s+MAHINDRA|KKBK0/i.test(text),
  parse: (text) => {
    const txns: ParsedTransaction[] = [];
    let m: RegExpExecArray | null;
    while ((m = ROW.exec(text)) !== null) {
      const [, date, desc, amtStr, dc] = m;
      if (!date || !desc || !amtStr || !dc) continue;
      const amount = parseFloat(amtStr.replace(/,/g, ""));
      const signed = dc === "D" ? -amount : amount;
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
