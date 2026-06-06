/**
 * Monte-Carlo simulations for goal completion forecasting.
 *
 * `simulateGoalContributions` runs N independent paths where each
 * monthly contribution is drawn from a normal distribution centered
 * on the average contribution with the historical std-dev.
 *
 * Returns p10/p50/p90 percentile bands for each future month so callers
 * (Goals page, dashboard) can render a fan chart and a "likely
 * completion date" estimate.
 */

export interface MonteCarloInput {
  /** Already-saved amount toward the goal. */
  currentAmount: number;
  /** Goal target amount. */
  targetAmount: number;
  /** Historical monthly contribution amounts. Must have ≥ 2 points. */
  history: number[];
  /** Number of future months to simulate (default 60 = 5 years). */
  horizonMonths?: number;
  /** Number of independent simulation paths (default 2000). */
  simulations?: number;
  /** Annual return rate to apply to compounding (default 0 = no growth). */
  annualReturnRate?: number;
  /** Random seed for deterministic tests. Optional. */
  seed?: number;
}

export interface MonteCarloPoint {
  /** "0" for now, "1" for 1 month out, etc. */
  monthsAhead: number;
  p10: number;
  p50: number;
  p90: number;
  /** Fraction (0..1) of paths that already hit the target by this point. */
  successProbability: number;
}

export interface MonteCarloResult {
  points: MonteCarloPoint[];
  /** Months until 50%/90% of paths reached target (null if unreachable). */
  medianCompletionMonths: number | null;
  p90CompletionMonths: number | null;
}

/** Linear congruential generator for deterministic-when-seeded sims. */
function rngFactory(seed?: number) {
  if (seed === undefined) return Math.random;
  let state = seed | 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) | 0;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
}

/** Box-Muller transform for normal-distributed random numbers. */
function gaussian(rng: () => number, mean: number, stdDev: number): number {
  const u1 = Math.max(rng(), 1e-9);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[], mu: number): number {
  if (arr.length < 2) return 0;
  const variance =
    arr.reduce((a, b) => a + (b - mu) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const rank = (sorted.length - 1) * p;
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower] ?? 0;
  return (sorted[lower] ?? 0) * (upper - rank) + (sorted[upper] ?? 0) * (rank - lower);
}

export function simulateGoalContributions(input: MonteCarloInput): MonteCarloResult {
  const {
    currentAmount,
    targetAmount,
    history,
    horizonMonths = 60,
    simulations = 2000,
    annualReturnRate = 0,
    seed,
  } = input;

  const rng = rngFactory(seed);
  const safeHistory = history.length > 0 ? history : [0];
  const mu = mean(safeHistory);
  const sigma = stdDev(safeHistory, mu);
  const monthlyReturn = annualReturnRate / 12;

  // Each path: array of balance at end of month 0..N
  const paths: number[][] = [];
  const completionMonths: number[] = [];

  for (let s = 0; s < simulations; s++) {
    let balance = currentAmount;
    const path: number[] = [balance];
    let completedAt: number | null = null;
    for (let m = 1; m <= horizonMonths; m++) {
      const contribution = Math.max(0, gaussian(rng, mu, sigma));
      balance = balance * (1 + monthlyReturn) + contribution;
      path.push(balance);
      if (completedAt === null && balance >= targetAmount) {
        completedAt = m;
      }
    }
    paths.push(path);
    completionMonths.push(completedAt ?? Number.POSITIVE_INFINITY);
  }

  // Per-month percentiles
  const points: MonteCarloPoint[] = [];
  for (let m = 0; m <= horizonMonths; m++) {
    const valuesAtM = paths.map((p) => p[m] ?? 0).sort((a, b) => a - b);
    const reached = valuesAtM.filter((v) => v >= targetAmount).length;
    points.push({
      monthsAhead: m,
      p10: percentile(valuesAtM, 0.1),
      p50: percentile(valuesAtM, 0.5),
      p90: percentile(valuesAtM, 0.9),
      successProbability: reached / simulations,
    });
  }

  const sortedCompletions = [...completionMonths].sort((a, b) => a - b);
  const med = percentile(sortedCompletions, 0.5);
  const p90 = percentile(sortedCompletions, 0.9);

  return {
    points,
    medianCompletionMonths: Number.isFinite(med) ? med : null,
    p90CompletionMonths: Number.isFinite(p90) ? p90 : null,
  };
}
