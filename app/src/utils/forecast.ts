/**
 * Cashflow forecasting.
 *
 * `projectCashflow` returns N future periods (typically months/cycles)
 * with projected income, expenses, and net savings using:
 *   1. Rolling 3-cycle average expense per category.
 *   2. Active recurring schedules (treated as guaranteed).
 *   3. Salary (when set) as guaranteed income.
 *
 * Deliberately deterministic — variance is layered in by `monteCarlo.ts`.
 */

export interface HistoricalCycle {
  cycleKey: string;
  totalIncome: number;
  totalSpent: number;
  categoryBreakdown: Record<string, number>;
}

export interface RecurringSchedule {
  amount: number; // positive for income, negative for expense
  frequency: "weekly" | "monthly" | "yearly";
  next_date: string;
  status: "active" | "paused" | "stopped";
}

export interface ProjectedCycle {
  cycleKey: string;
  income: number;
  expense: number;
  net: number;
  byCategory: Record<string, number>;
}

export interface CashflowForecastOptions {
  /** Number of future cycles to project. */
  periods: number;
  /** Monthly salary (taken from profile). 0 to disable. */
  monthlySalary?: number;
  /** Active recurring templates. */
  recurring?: RecurringSchedule[];
  /** Lookback window for the rolling average. Default 3. */
  lookbackCycles?: number;
}

/**
 * Generate a list of cycle keys starting at the cycle AFTER the most
 * recent one in `history`. Uses chronological "next month" arithmetic.
 */
function nextCycleKeys(
  fromCycleKey: string,
  count: number
): string[] {
  const parts = fromCycleKey.split("-");
  let year = Number(parts[0]);
  let month = Number(parts[1]);
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return keys;
}

/** Convert a recurring template's typical monthly amount. */
function recurringMonthlyAmount(r: RecurringSchedule): number {
  switch (r.frequency) {
    case "weekly":
      return r.amount * 4.345;
    case "monthly":
      return r.amount;
    case "yearly":
      return r.amount / 12;
  }
}

export function projectCashflow(
  history: HistoricalCycle[],
  options: CashflowForecastOptions
): ProjectedCycle[] {
  const { periods, monthlySalary = 0, recurring = [], lookbackCycles = 3 } = options;
  if (periods <= 0) return [];

  // Sort history chronologically.
  const sorted = [...history].sort((a, b) => a.cycleKey.localeCompare(b.cycleKey));
  const recent = sorted.slice(-lookbackCycles);

  // Average per category, weighted equally across recent cycles.
  const avgByCategory: Record<string, number> = {};
  const avgIncome =
    recent.length > 0
      ? recent.reduce((sum, c) => sum + c.totalIncome, 0) / recent.length
      : 0;

  for (const c of recent) {
    for (const [cat, v] of Object.entries(c.categoryBreakdown ?? {})) {
      if (cat === "Income") continue;
      avgByCategory[cat] = (avgByCategory[cat] ?? 0) + v / recent.length;
    }
  }

  const baselineRecurringIncome = recurring
    .filter((r) => r.status === "active" && r.amount > 0)
    .reduce((sum, r) => sum + recurringMonthlyAmount(r), 0);

  const baselineRecurringExpense = recurring
    .filter((r) => r.status === "active" && r.amount < 0)
    .reduce((sum, r) => sum + Math.abs(recurringMonthlyAmount(r)), 0);

  const lastKey = sorted[sorted.length - 1]?.cycleKey ?? defaultCycleKey();
  const keys = nextCycleKeys(lastKey, periods);

  return keys.map((cycleKey) => {
    const income = Math.max(avgIncome, monthlySalary + baselineRecurringIncome);
    const variableExpense = Object.values(avgByCategory).reduce((a, b) => a + b, 0);
    const expense = variableExpense + baselineRecurringExpense;
    return {
      cycleKey,
      income,
      expense,
      net: income - expense,
      byCategory: { ...avgByCategory },
    };
  });
}

function defaultCycleKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
