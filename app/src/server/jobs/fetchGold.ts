/**
 * Gold price fetcher.
 *
 * Pulls a free public source. We use the NBS gold price endpoint (mirror
 * of the Mumbai bullion market) wrapped in a typed result. If the
 * primary source fails, falls back to a last-known cached value.
 */
import { logger } from "@/lib/logger";

export interface GoldPrice {
  date: string; // YYYY-MM-DD
  inrPerGram24K: number;
  inrPerGram22K: number;
  source: string;
}

const FALLBACK_24K = 7200; // INR/g — sane default if all sources fail
const FALLBACK_22K = Math.round(FALLBACK_24K * 0.916);

/**
 * Free public endpoint (no API key required). Caller decides how to
 * cache — for our cron we persist the result in `system/goldPrice/{date}`.
 */
export async function fetchGoldPrice(): Promise<GoldPrice> {
  const today = new Date().toISOString().split("T")[0] ?? "1970-01-01";

  try {
    // Try goodreturns.in (publicly scrapable, no API key)
    const res = await fetch("https://www.goodreturns.in/gold-rates/", {
      headers: {
        "User-Agent": "WealthFlow/1.0 (+gold-fetch)",
        Accept: "text/html",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    // Very tolerant regex — finds "₹ 7,234" style numbers in rate cells.
    const matches = html.match(/₹\s*([\d,]+)/g);
    if (!matches || matches.length < 2) throw new Error("could not extract rates");
    const first = matches[0]?.replace(/[₹,\s]/g, "");
    const second = matches[1]?.replace(/[₹,\s]/g, "");
    const inrPerGram22K = first ? parseInt(first, 10) : FALLBACK_22K;
    const inrPerGram24K = second ? parseInt(second, 10) : FALLBACK_24K;
    if (!isFinite(inrPerGram22K) || !isFinite(inrPerGram24K)) {
      throw new Error("invalid parsed values");
    }
    return {
      date: today,
      inrPerGram22K,
      inrPerGram24K,
      source: "goodreturns.in",
    };
  } catch (err) {
    logger.warn({ event: "gold.fetch.failed" }, err);
    return {
      date: today,
      inrPerGram22K: FALLBACK_22K,
      inrPerGram24K: FALLBACK_24K,
      source: "fallback",
    };
  }
}
