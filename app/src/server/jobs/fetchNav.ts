/**
 * AMFI NAV fetcher.
 *
 * Parses https://www.amfiindia.com/spages/NAVAll.txt (pipe-delimited,
 * updated daily ~8 PM IST). Output is the latest NAV for every Indian
 * mutual fund scheme.
 *
 * File format (header repeats per fund-house section):
 *   Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
 *   118989;INF179K01YV8;-;Franklin India Equity Fund - Direct - Growth;1234.5678;06-Jun-2026
 */
import { logger } from "@/lib/logger";

export interface NavEntry {
  schemeCode: string;
  schemeName: string;
  nav: number;
  date: string; // YYYY-MM-DD
  fundHouse: string;
  isin?: string;
}

const AMFI_URL = "https://www.amfiindia.com/spages/NAVAll.txt";
const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

function normalizeDate(raw: string): string {
  const parts = raw.split("-");
  const day = parts[0];
  const monthName = parts[1] ?? "";
  const year = parts[2];
  const month = MONTHS[monthName] ?? "01";
  return `${year}-${month}-${(day ?? "01").padStart(2, "0")}`;
}

/**
 * Fetches and parses the AMFI NAVAll.txt file. Returns one entry per
 * scheme, with the fund house resolved from context. Skips any lines
 * that fail to parse.
 */
export async function fetchAmfiNav(): Promise<NavEntry[]> {
  const res = await fetch(AMFI_URL, {
    headers: {
      "User-Agent": "WealthFlow/1.0 (+nav-fetch)",
      Accept: "text/plain",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`AMFI fetch failed: ${res.status}`);
  }
  const text = await res.text();
  return parseAmfiNav(text);
}

export function parseAmfiNav(text: string): NavEntry[] {
  const out: NavEntry[] = [];
  const lines = text.split(/\r?\n/);
  let currentFundHouse = "Unknown";

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("Scheme Code")) continue; // header
    if (!line.includes(";")) {
      // Fund-house section header — bare text line.
      currentFundHouse = line.replace(/\s+Mutual Fund.*$/i, "").trim();
      continue;
    }

    const parts = line.split(";");
    if (parts.length < 6) continue;
    const [schemeCode, isin1, , schemeName, navStr, dateStr] = parts;
    if (!schemeCode || !schemeName || !navStr || !dateStr) continue;
    const nav = parseFloat(navStr);
    if (isNaN(nav) || nav <= 0) continue;
    out.push({
      schemeCode,
      isin: isin1 && isin1 !== "-" ? isin1 : undefined,
      schemeName: schemeName.trim(),
      nav,
      date: normalizeDate(dateStr.trim()),
      fundHouse: currentFundHouse,
    });
  }

  logger.info({
    event: "amfi.parse",
    schemesParsed: out.length,
    sampleDate: out[0]?.date,
  });
  return out;
}
