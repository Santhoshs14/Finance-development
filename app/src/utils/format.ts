const CURRENCY_CONFIG: Record<string, { symbol: string; locale: string }> = {
  INR: { symbol: "₹", locale: "en-IN" },
  USD: { symbol: "$", locale: "en-US" },
  EUR: { symbol: "€", locale: "de-DE" },
  GBP: { symbol: "£", locale: "en-GB" },
  AED: { symbol: "AED ", locale: "en-AE" },
};

let activeCurrency = "INR";
// Display-only conversion factor: amounts are stored in INR; when the user
// picks another display currency we multiply by "1 INR = activeRate CCY".
let activeRate = 1;

export function setCurrencyFormat(code: string) {
  if (CURRENCY_CONFIG[code]) activeCurrency = code;
}

/**
 * Set the INR→display-currency conversion factor (see fetch-fx cron). Pass 1
 * (or omit) for INR / when no rate is available, leaving amounts unconverted.
 */
export function setCurrencyRate(rate: number) {
  activeRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
}

function getCfg() {
  return CURRENCY_CONFIG[activeCurrency] || CURRENCY_CONFIG.INR;
}

/**
 * fmt — full precision display (up to 2 decimal places, trailing zeros stripped)
 * e.g.  1234.5  → ₹1,234.5
 *        1234.56 → ₹1,234.56
 *        1234.00 → ₹1,234
 */
export const fmt = (n: number | string): string => {
  const cfg = getCfg();
  return cfg.symbol +
    new Intl.NumberFormat(cfg.locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format((Number(n) || 0) * activeRate);
};

/**
 * fmtCompact — shortened form for chart axes / summary tiles
 * e.g.  1500    → ₹1.5k
 *        1000000 → ₹10L (INR) or ₹1M (USD/EUR)
 *        500     → ₹500
 */
export const fmtCompact = (n: number | string): string => {
  const v = (Number(n) || 0) * activeRate;
  const cfg = getCfg();
  if (activeCurrency === "INR") {
    if (Math.abs(v) >= 100_000)
      return cfg.symbol + (v / 100_000).toFixed(1).replace(/\.0$/, "") + "L";
    if (Math.abs(v) >= 1_000)
      return cfg.symbol + (v / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
    return cfg.symbol + v.toFixed(2).replace(/\.00$/, "");
  }
  // USD/EUR
  if (Math.abs(v) >= 1_000_000)
    return cfg.symbol + (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (Math.abs(v) >= 1_000)
    return cfg.symbol + (v / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return cfg.symbol + v.toFixed(2).replace(/\.00$/, "");
};
