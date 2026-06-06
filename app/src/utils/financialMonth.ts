/**
 * Financial Month Utility
 * Cycle: cycleStartDay of previous month → (cycleStartDay-1) of current month
 * Default cycleStartDay is 25 but can be customized per user.
 */

const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export interface FinancialCycle {
  cycleKey: string;
  startDate: string;
  endDate: string;
  label: string;
  month: number;
  year: number;
}

/**
 * Get the financial month range for a display label month+year
 */
export const getFinancialMonthRange = (
  month: number,
  year: number,
  startDay: number = 25
): FinancialCycle => {
  const endDay = startDay - 1;
  const startMonth = month === 1 ? 12 : month - 1;
  const startYear = month === 1 ? year - 1 : year;
  const startDate = `${startYear}-${String(startMonth).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
  const label = `${MONTH_NAMES[month]} ${year}`;
  const cycleKey = `${year}-${String(month).padStart(2, "0")}`;
  return { cycleKey, startDate, endDate, label, month, year };
};

/**
 * Get the current active financial cycle.
 */
export const getFinancialCycle = (
  now: Date = new Date(),
  startDay: number = 25
): FinancialCycle => {
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  if (day >= startDay) {
    const labelMonth = month === 12 ? 1 : month + 1;
    const labelYear = month === 12 ? year + 1 : year;
    return getFinancialMonthRange(labelMonth, labelYear, startDay);
  } else {
    return getFinancialMonthRange(month, year, startDay);
  }
};

/** Alias for backward compat */
export const getCurrentFinancialMonth = getFinancialCycle;

/**
 * Get the financial cycle for an arbitrary date string 'YYYY-MM-DD'.
 */
export const getFinancialCycleForDate = (
  dateStr: string,
  startDay: number = 25
): FinancialCycle => {
  if (!dateStr) return getFinancialCycle(new Date(), startDay);
  const [y, m, d] = dateStr.split("-").map(Number);
  return getFinancialCycle(new Date(y, m - 1, d), startDay);
};

/**
 * Get the last N financial month ranges (most recent first)
 */
export const getRecentFinancialMonths = (
  count: number = 6,
  now: Date = new Date(),
  startDay: number = 25
): FinancialCycle[] => {
  const current = getFinancialCycle(now, startDay);
  const months: FinancialCycle[] = [current];

  for (let i = 1; i < count; i++) {
    let { month, year } = months[months.length - 1];
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    months.push(getFinancialMonthRange(month, year, startDay));
  }

  return months;
};

/**
 * Format a date string as dd MMM (e.g. "24 Mar")
 */
export const formatShortDate = (dateStr: string): string => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

/**
 * Get cycle day info for progress calculations.
 */
export const getCycleDayInfo = (
  now: Date = new Date(),
  startDay: number = 25
): { daysElapsed: number; totalDays: number; daysRemaining: number } => {
  const cycle = getFinancialCycle(now, startDay);
  const start = new Date(cycle.startDate + "T00:00:00");
  const end = new Date(cycle.endDate + "T23:59:59");
  const totalDays = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysElapsed = Math.max(
    1,
    Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  );
  const daysRemaining = Math.max(0, totalDays - daysElapsed);
  return { daysElapsed, totalDays, daysRemaining };
};
