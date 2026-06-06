/**
 * Indian Financial Year helpers.
 *
 * The Indian tax year runs April 1 → March 31. We label it as
 * `FY{startYear}-{endYearShort}` (e.g. "FY2025-26" = Apr 1 2025 to
 * Mar 31 2026).
 */

export interface FinancialYear {
  fyStart: string; // YYYY-MM-DD
  fyEnd: string;   // YYYY-MM-DD
  startYear: number;
  endYear: number;
  fyKey: string;   // e.g. "FY2025-26"
  label: string;   // e.g. "FY 2025-26 (Apr 2025 – Mar 2026)"
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function getFinancialYearForDate(date: Date | string): FinancialYear {
  const d = typeof date === "string" ? new Date(date + "T00:00:00") : new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-11
  // April (month=3) and later → FY starts this year. Jan-Mar → FY started previous year.
  const startYear = month >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  return {
    fyStart: `${startYear}-04-01`,
    fyEnd: `${endYear}-03-31`,
    startYear,
    endYear,
    fyKey: `FY${startYear}-${String(endYear).slice(-2)}`,
    label: `FY ${startYear}-${String(endYear).slice(-2)} (Apr ${startYear} – Mar ${endYear})`,
  };
}

/** Returns the N most recent FYs (descending). */
export function getRecentFinancialYears(count: number, baseDate = new Date()): FinancialYear[] {
  const current = getFinancialYearForDate(baseDate);
  const out: FinancialYear[] = [current];
  let startYear = current.startYear;
  for (let i = 1; i < count; i++) {
    startYear--;
    const endYear = startYear + 1;
    out.push({
      fyStart: `${startYear}-04-01`,
      fyEnd: `${endYear}-03-31`,
      startYear,
      endYear,
      fyKey: `FY${startYear}-${String(endYear).slice(-2)}`,
      label: `FY ${startYear}-${String(endYear).slice(-2)} (Apr ${startYear} – Mar ${endYear})`,
    });
  }
  return out;
}

/** Quick test: is a date within an FY range? */
export function isInFinancialYear(date: string, fy: FinancialYear): boolean {
  return date >= fy.fyStart && date <= fy.fyEnd;
}

/** Month label for charts inside an FY (returns Apr-Mar order). */
export function fyMonthLabels(fy: FinancialYear): string[] {
  return [
    `Apr ${fy.startYear}`, `May ${fy.startYear}`, `Jun ${fy.startYear}`,
    `Jul ${fy.startYear}`, `Aug ${fy.startYear}`, `Sep ${fy.startYear}`,
    `Oct ${fy.startYear}`, `Nov ${fy.startYear}`, `Dec ${fy.startYear}`,
    `Jan ${fy.endYear}`,   `Feb ${fy.endYear}`,   `Mar ${fy.endYear}`,
  ];
}

/** Which calendar month within FY (0 = April, 11 = March)? */
export function fyMonthIndex(date: string): number {
  const d = new Date(date + "T00:00:00");
  const m = d.getMonth(); // 0-11 Jan-Dec
  return (m + 9) % 12; // April becomes 0, March becomes 11
}

/** Human readable month name. */
export function monthName(monthIndex0to11: number): string {
  return MONTHS[monthIndex0to11] ?? "";
}
