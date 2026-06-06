import type { ParsedTransaction } from "./index";

/**
 * Generic fallback parser — catches the "date  description  amount"
 * pattern used by many Indian banks when our specific parsers don't
 * detect a match. Best-effort; user reviews everything before commit.
 */
const ROW =
  /(\d{2}[-\/](?:\d{2}|[A-Za-z]{3})[-\/]\d{2,4})\s+(.{4,80}?)\s+(-?[\d,]+\.\d{2})/g;

function toIso(raw: string): string {
  // Accept DD/MM/YYYY, DD-MM-YYYY, DD-MMM-YYYY, DD/MM/YY
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const parts = raw.split(/[-\/]/);
  if (parts.length !== 3) return raw;
  const day = parts[0] ?? "01";
  let month = parts[1] ?? "01";
  let year = parts[2] ?? "1970";
  if (month.length === 3) {
    month = months[month.toLowerCase()] ?? "01";
  }
  if (year.length === 2) {
    year = String(2000 + parseInt(year, 10));
  }
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export const genericParser = {
  bank: "Generic",
  detect: () => true,
  parse(text: string): ParsedTransaction[] {
    const txns: ParsedTransaction[] = [];
    let m: RegExpExecArray | null;
    while ((m = ROW.exec(text)) !== null) {
      const [, date, desc, amtStr] = m;
      if (!date || !desc || !amtStr) continue;
      const amount = parseFloat(amtStr.replace(/,/g, ""));
      if (!isFinite(amount) || amount === 0) continue;
      txns.push({
        date: toIso(date),
        amount,
        description: desc.trim(),
        type: amount < 0 ? "expense" : "income",
      });
    }
    return txns;
  },
};
