/**
 * Foreign-exchange rate fetcher.
 *
 * WealthFlow stores all amounts in INR (the app is India-first); FX rates are
 * only used to *display* values in the user's chosen currency. We pull a free,
 * keyless source (open.er-api.com by default) with INR as the base, so each
 * rate is "1 INR = rates[CCY] in that currency".
 *
 * Falls back to INR-only (no conversion) if the source is unavailable, so the
 * app degrades to showing raw INR values rather than breaking.
 */
import { logger } from "@/lib/logger";

/** Currencies the app offers (must match the profile currency enum). */
export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "AED"] as const;

export interface FxRates {
  base: "INR";
  date: string; // YYYY-MM-DD
  /** 1 INR expressed in each currency. Always includes `INR: 1`. */
  rates: Record<string, number>;
  source: string;
}

export async function fetchFxRates(): Promise<FxRates> {
  const baseUrl = (
    process.env.FX_API_BASE_URL || "https://open.er-api.com/v6"
  ).replace(/\/$/, "");
  const date = new Date().toISOString().slice(0, 10);

  try {
    const res = await fetch(`${baseUrl}/latest/INR`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { rates?: Record<string, number> };
    const all = json.rates ?? {};

    const rates: Record<string, number> = { INR: 1 };
    for (const code of SUPPORTED_CURRENCIES) {
      const v = all[code];
      if (typeof v === "number" && Number.isFinite(v) && v > 0) {
        rates[code] = v;
      }
    }
    return { base: "INR", date, rates, source: baseUrl };
  } catch (err) {
    logger.warn({ event: "jobs.fetch_fx.failed" }, err);
    return { base: "INR", date, rates: { INR: 1 }, source: "fallback" };
  }
}
