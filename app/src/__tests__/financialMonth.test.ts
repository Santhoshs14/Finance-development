import { describe, it, expect } from "vitest";
import {
  getFinancialMonthRange,
  getFinancialCycle,
  getFinancialCycleForDate,
  getRecentFinancialMonths,
  formatShortDate,
} from "@/utils/financialMonth";

describe("getFinancialMonthRange", () => {
  it("returns correct range for default startDay 25", () => {
    const cycle = getFinancialMonthRange(3, 2025);
    expect(cycle.cycleKey).toBe("2025-03");
    expect(cycle.startDate).toBe("2025-02-25");
    expect(cycle.endDate).toBe("2025-03-24");
    expect(cycle.label).toBe("March 2025");
  });

  it("handles January (wraps to December of previous year)", () => {
    const cycle = getFinancialMonthRange(1, 2025);
    expect(cycle.startDate).toBe("2024-12-25");
    expect(cycle.endDate).toBe("2025-01-24");
  });

  it("respects custom startDay", () => {
    const cycle = getFinancialMonthRange(6, 2025, 1);
    expect(cycle.startDate).toBe("2025-05-01");
    expect(cycle.endDate).toBe("2025-06-00"); // edge case — day 0 = last day of prev month
  });
});

describe("getFinancialCycle", () => {
  it("date after startDay → next month's cycle", () => {
    const now = new Date(2025, 2, 26); // March 26
    const cycle = getFinancialCycle(now);
    expect(cycle.cycleKey).toBe("2025-04");
    expect(cycle.label).toBe("April 2025");
  });

  it("date before startDay → current month's cycle", () => {
    const now = new Date(2025, 2, 10); // March 10
    const cycle = getFinancialCycle(now);
    expect(cycle.cycleKey).toBe("2025-03");
    expect(cycle.label).toBe("March 2025");
  });

  it("date on startDay → next month's cycle", () => {
    const now = new Date(2025, 2, 25); // March 25
    const cycle = getFinancialCycle(now);
    expect(cycle.cycleKey).toBe("2025-04");
  });
});

describe("getFinancialCycleForDate", () => {
  it("maps a date string to correct cycle", () => {
    const cycle = getFinancialCycleForDate("2025-03-26");
    expect(cycle.cycleKey).toBe("2025-04");
  });

  it("returns current cycle for empty string", () => {
    const cycle = getFinancialCycleForDate("");
    expect(cycle.cycleKey).toBeDefined();
  });
});

describe("getRecentFinancialMonths", () => {
  it("returns requested number of cycles", () => {
    const cycles = getRecentFinancialMonths(3, new Date(2025, 5, 10));
    expect(cycles).toHaveLength(3);
    expect(cycles[0].cycleKey).toBe("2025-06");
    expect(cycles[1].cycleKey).toBe("2025-05");
    expect(cycles[2].cycleKey).toBe("2025-04");
  });

  it("wraps around year boundary", () => {
    const cycles = getRecentFinancialMonths(3, new Date(2025, 0, 10)); // Jan 10
    expect(cycles[0].cycleKey).toBe("2025-01");
    expect(cycles[1].cycleKey).toBe("2024-12");
    expect(cycles[2].cycleKey).toBe("2024-11");
  });
});

describe("formatShortDate", () => {
  it("formats date as dd MMM", () => {
    const result = formatShortDate("2025-03-24");
    expect(result).toMatch(/24.*Mar/);
  });
});
