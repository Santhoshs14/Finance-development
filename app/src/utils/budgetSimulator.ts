/**
 * What-if budget simulation.
 *
 * Takes the current per-category budgets and a proposed override, and
 * returns the simulated savings rate + dashboard-level deltas the user
 * would see if they adopted the new plan.
 */
export interface BudgetSimInput {
  /** Last cycle's actual income. */
  income: number;
  /** Last cycle's spend per category. */
  actualByCategory: Record<string, number>;
  /** Current limit per category. */
  currentLimits: Record<string, number>;
  /** Proposed override per category (sparse). */
  proposedLimits: Record<string, number>;
}

export interface BudgetSimResult {
  currentSavingsRate: number;
  proposedSavingsRate: number;
  /** Difference in net savings between current and proposed plans. */
  netDelta: number;
  /** Percentage change vs the current plan, where +ve = more savings. */
  deltaPercent: number;
  /** Categories that would be cut (delta < 0 in proposed). */
  reductions: { category: string; from: number; to: number }[];
  /** Categories that would be increased. */
  increases: { category: string; from: number; to: number }[];
}

export function simulateBudgetChange(input: BudgetSimInput): BudgetSimResult {
  const { income, actualByCategory, currentLimits, proposedLimits } = input;

  const currentSpend = Object.values(actualByCategory).reduce((a, b) => a + b, 0);
  const currentNet = income - currentSpend;
  const currentRate = income > 0 ? (currentNet / income) * 100 : 0;

  // For each proposed category: cap spend at min(actual, proposed limit).
  let proposedSpend = 0;
  for (const [cat, actual] of Object.entries(actualByCategory)) {
    const proposed = proposedLimits[cat] ?? currentLimits[cat] ?? actual;
    proposedSpend += Math.min(actual, proposed);
  }
  // Categories present in proposed but not in actual contribute 0 to spend.

  const proposedNet = income - proposedSpend;
  const proposedRate = income > 0 ? (proposedNet / income) * 100 : 0;

  const reductions: BudgetSimResult["reductions"] = [];
  const increases: BudgetSimResult["increases"] = [];
  const allCats = new Set([
    ...Object.keys(currentLimits),
    ...Object.keys(proposedLimits),
  ]);
  for (const cat of allCats) {
    const from = currentLimits[cat] ?? 0;
    const to = proposedLimits[cat] ?? from;
    if (to < from) reductions.push({ category: cat, from, to });
    else if (to > from) increases.push({ category: cat, from, to });
  }

  return {
    currentSavingsRate: currentRate,
    proposedSavingsRate: proposedRate,
    netDelta: proposedNet - currentNet,
    deltaPercent: currentNet !== 0 ? ((proposedNet - currentNet) / Math.abs(currentNet)) * 100 : 0,
    reductions,
    increases,
  };
}
