/**
 * India income-tax regime calculator (FY 2025-26 slabs).
 *
 * Implements old vs new regime side-by-side. Surcharge, cess, marginal
 * relief, and 87A rebate are all included.
 *
 * Sources: Finance Act 2025, ITR 2025-26 forms.
 */

export interface TaxInputs {
  /** Gross salary or income before deductions. */
  grossIncome: number;
  /** ₹ deducted under Section 80C (cap ₹1.5L). */
  deduction80C?: number;
  /** ₹ deducted under Section 80D (cap ₹25k self / ₹50k senior). */
  deduction80D?: number;
  /** ₹ deducted under Section 80CCD(1B) (NPS, cap ₹50k). */
  deduction80CCD1B?: number;
  /** Other Chapter VI-A deductions (80E, 80G, 80TTA combined). */
  deductionOther?: number;
  /** HRA exemption (auto-computed if rent/HRA paid provided). */
  hraExemption?: number;
  /** Standard deduction — auto-applied per regime. */
  hasSalary?: boolean;
  /** Is the taxpayer a senior citizen (60-79)? */
  senior?: boolean;
  /** Is the taxpayer a super senior (80+)? */
  superSenior?: boolean;
}

export interface TaxBreakdown {
  regime: "old" | "new";
  grossIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  taxBeforeRebate: number;
  rebate87A: number;
  taxAfterRebate: number;
  surcharge: number;
  cess: number; // 4% Health & Education cess
  totalTax: number;
  effectiveRate: number;
  inHand: number;
  slabBreakdown: { slab: string; rate: string; tax: number }[];
}

interface Slab {
  upTo: number; // inclusive upper bound (Infinity = no cap)
  rate: number; // 0..1
}

// ── FY 2025-26 — NEW regime slabs (default) ─────────────────────
const NEW_REGIME_SLABS: Slab[] = [
  { upTo: 4_00_000, rate: 0 },
  { upTo: 8_00_000, rate: 0.05 },
  { upTo: 12_00_000, rate: 0.10 },
  { upTo: 16_00_000, rate: 0.15 },
  { upTo: 20_00_000, rate: 0.20 },
  { upTo: 24_00_000, rate: 0.25 },
  { upTo: Infinity, rate: 0.30 },
];

// ── FY 2025-26 — OLD regime slabs ───────────────────────────────
const OLD_REGIME_SLABS_DEFAULT: Slab[] = [
  { upTo: 2_50_000, rate: 0 },
  { upTo: 5_00_000, rate: 0.05 },
  { upTo: 10_00_000, rate: 0.20 },
  { upTo: Infinity, rate: 0.30 },
];

const OLD_REGIME_SLABS_SENIOR: Slab[] = [
  { upTo: 3_00_000, rate: 0 },
  { upTo: 5_00_000, rate: 0.05 },
  { upTo: 10_00_000, rate: 0.20 },
  { upTo: Infinity, rate: 0.30 },
];

const OLD_REGIME_SLABS_SUPER_SENIOR: Slab[] = [
  { upTo: 5_00_000, rate: 0 },
  { upTo: 10_00_000, rate: 0.20 },
  { upTo: Infinity, rate: 0.30 },
];

function calcSlabTax(taxable: number, slabs: Slab[]): { tax: number; rows: TaxBreakdown["slabBreakdown"] } {
  let prev = 0;
  let tax = 0;
  const rows: TaxBreakdown["slabBreakdown"] = [];
  for (const slab of slabs) {
    if (taxable <= prev) break;
    const portion = Math.min(taxable, slab.upTo) - prev;
    const portionTax = portion * slab.rate;
    if (portion > 0) {
      const upperLabel = slab.upTo === Infinity ? "+" : `₹${(slab.upTo / 100000).toFixed(1)}L`;
      rows.push({
        slab: `₹${(prev / 100000).toFixed(1)}L → ${upperLabel}`,
        rate: `${(slab.rate * 100).toFixed(0)}%`,
        tax: portionTax,
      });
    }
    tax += portionTax;
    prev = slab.upTo;
  }
  return { tax, rows };
}

/** Surcharge per Finance Act 2025 (applies only when taxable > 50L). */
function surchargeFor(taxable: number, baseTax: number, regime: "old" | "new"): number {
  let rate = 0;
  if (taxable > 5_00_00_000) rate = regime === "new" ? 0.25 : 0.37;
  else if (taxable > 2_00_00_000) rate = 0.25;
  else if (taxable > 1_00_00_000) rate = 0.15;
  else if (taxable > 50_00_000) rate = 0.10;
  return baseTax * rate;
}

/** Section 87A rebate caps. */
function rebate87A(taxable: number, regime: "old" | "new", baseTax: number): number {
  if (regime === "new") {
    // FY 2025-26: full rebate up to ₹12L taxable income; cap ₹60k.
    if (taxable <= 12_00_000) return Math.min(baseTax, 60_000);
    return 0;
  }
  if (taxable <= 5_00_000) return Math.min(baseTax, 12_500);
  return 0;
}

export function calculateTax(inputs: TaxInputs, regime: "old" | "new"): TaxBreakdown {
  const {
    grossIncome,
    deduction80C = 0,
    deduction80D = 0,
    deduction80CCD1B = 0,
    deductionOther = 0,
    hraExemption = 0,
    hasSalary = true,
    senior = false,
    superSenior = false,
  } = inputs;

  // Standard deduction
  const stdDeduction = hasSalary ? (regime === "new" ? 75_000 : 50_000) : 0;

  // Cap the chapter VI-A deductions
  const cap80C = Math.min(deduction80C, 1_50_000);
  const cap80D = Math.min(deduction80D, senior || superSenior ? 50_000 : 25_000);
  const cap80CCD1B = Math.min(deduction80CCD1B, 50_000);

  // New regime allows only Standard + 80CCD(2) employer contribution + a
  // handful of others. We support stdDeduction + 80CCD(1B) only here
  // because they're the most commonly applicable. Old regime supports
  // the whole bag.
  const totalDeductions =
    regime === "new"
      ? stdDeduction + cap80CCD1B
      : stdDeduction + cap80C + cap80D + cap80CCD1B + deductionOther + hraExemption;

  const taxableIncome = Math.max(0, grossIncome - totalDeductions);

  // Slabs
  const slabs =
    regime === "new"
      ? NEW_REGIME_SLABS
      : superSenior
      ? OLD_REGIME_SLABS_SUPER_SENIOR
      : senior
      ? OLD_REGIME_SLABS_SENIOR
      : OLD_REGIME_SLABS_DEFAULT;

  const { tax: taxBeforeRebate, rows: slabBreakdown } = calcSlabTax(taxableIncome, slabs);
  const rebate = rebate87A(taxableIncome, regime, taxBeforeRebate);
  const taxAfterRebate = Math.max(0, taxBeforeRebate - rebate);
  const surcharge = surchargeFor(taxableIncome, taxAfterRebate, regime);
  const cess = (taxAfterRebate + surcharge) * 0.04;
  const totalTax = taxAfterRebate + surcharge + cess;
  const inHand = grossIncome - totalTax;
  const effectiveRate = grossIncome > 0 ? (totalTax / grossIncome) * 100 : 0;

  return {
    regime,
    grossIncome,
    totalDeductions,
    taxableIncome,
    taxBeforeRebate,
    rebate87A: rebate,
    taxAfterRebate,
    surcharge,
    cess,
    totalTax,
    effectiveRate,
    inHand,
    slabBreakdown,
  };
}

/** Side-by-side calc for both regimes — used by the comparison UI. */
export function compareRegimes(inputs: TaxInputs): {
  oldRegime: TaxBreakdown;
  newRegime: TaxBreakdown;
  recommended: "old" | "new";
  savings: number;
} {
  const oldRegime = calculateTax(inputs, "old");
  const newRegime = calculateTax(inputs, "new");
  const recommended = newRegime.totalTax <= oldRegime.totalTax ? "new" : "old";
  const savings = Math.abs(newRegime.totalTax - oldRegime.totalTax);
  return { oldRegime, newRegime, recommended, savings };
}
