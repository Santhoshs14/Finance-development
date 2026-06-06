import { describe, it, expect } from "vitest";
import {
  getFinancialMonthRange,
  getFinancialCycle,
  getCurrentFinancialMonth,
  getFinancialCycleForDate,
  getRecentFinancialMonths,
  formatShortDate,
  getCycleDayInfo,
  type FinancialCycle,
} from "@/utils/financialMonth";

// ═══════════════════════════════════════════════════════════════════════
// getFinancialMonthRange - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("getFinancialMonthRange", () => {
  describe("Default start day (25)", () => {
    it("returns correct range for March 2025", () => {
      const cycle = getFinancialMonthRange(3, 2025);
      expect(cycle.cycleKey).toBe("2025-03");
      expect(cycle.startDate).toBe("2025-02-25");
      expect(cycle.endDate).toBe("2025-03-24");
      expect(cycle.label).toBe("March 2025");
      expect(cycle.month).toBe(3);
      expect(cycle.year).toBe(2025);
    });

    it("handles January (wraps to December previous year)", () => {
      const cycle = getFinancialMonthRange(1, 2025);
      expect(cycle.startDate).toBe("2024-12-25");
      expect(cycle.endDate).toBe("2025-01-24");
      expect(cycle.label).toBe("January 2025");
    });

    it("handles December", () => {
      const cycle = getFinancialMonthRange(12, 2025);
      expect(cycle.startDate).toBe("2025-11-25");
      expect(cycle.endDate).toBe("2025-12-24");
      expect(cycle.label).toBe("December 2025");
    });

    it("handles February (short month)", () => {
      const cycle = getFinancialMonthRange(2, 2025);
      expect(cycle.startDate).toBe("2025-01-25");
      expect(cycle.endDate).toBe("2025-02-24");
    });

    it("handles leap year February", () => {
      const cycle = getFinancialMonthRange(3, 2024);
      expect(cycle.startDate).toBe("2024-02-25");
      expect(cycle.endDate).toBe("2024-03-24");
    });
  });

  describe("Custom start days", () => {
    it("handles start day 1", () => {
      const cycle = getFinancialMonthRange(6, 2025, 1);
      expect(cycle.startDate).toBe("2025-05-01");
      // endDay = startDay - 1 = 0, which is edge case
      expect(cycle.endDate).toBe("2025-06-00");
    });

    it("handles start day 15", () => {
      const cycle = getFinancialMonthRange(6, 2025, 15);
      expect(cycle.startDate).toBe("2025-05-15");
      expect(cycle.endDate).toBe("2025-06-14");
    });

    it("handles start day 28", () => {
      const cycle = getFinancialMonthRange(3, 2025, 28);
      expect(cycle.startDate).toBe("2025-02-28");
      expect(cycle.endDate).toBe("2025-03-27");
    });

    it("handles start day 10", () => {
      const cycle = getFinancialMonthRange(4, 2025, 10);
      expect(cycle.startDate).toBe("2025-03-10");
      expect(cycle.endDate).toBe("2025-04-09");
    });
  });

  describe("Cycle key format", () => {
    it("pads month with leading zero", () => {
      const cycle = getFinancialMonthRange(1, 2025);
      expect(cycle.cycleKey).toBe("2025-01");
    });

    it("does not double-pad two-digit months", () => {
      const cycle = getFinancialMonthRange(12, 2025);
      expect(cycle.cycleKey).toBe("2025-12");
    });
  });

  describe("All 12 months", () => {
    for (let m = 1; m <= 12; m++) {
      it(`correctly generates range for month ${m}`, () => {
        const cycle = getFinancialMonthRange(m, 2025);
        expect(cycle.month).toBe(m);
        expect(cycle.year).toBe(2025);
        expect(cycle.cycleKey).toMatch(/^2025-\d{2}$/);
        expect(cycle.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(cycle.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// getFinancialCycle - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("getFinancialCycle", () => {
  describe("Date before start day → current month cycle", () => {
    it("day 1 of month → same month cycle", () => {
      const now = new Date(2025, 2, 1); // March 1
      const cycle = getFinancialCycle(now);
      expect(cycle.cycleKey).toBe("2025-03");
      expect(cycle.label).toBe("March 2025");
    });

    it("day 10 of month → same month cycle", () => {
      const now = new Date(2025, 2, 10); // March 10
      const cycle = getFinancialCycle(now);
      expect(cycle.cycleKey).toBe("2025-03");
    });

    it("day 24 of month → same month cycle", () => {
      const now = new Date(2025, 2, 24); // March 24
      const cycle = getFinancialCycle(now);
      expect(cycle.cycleKey).toBe("2025-03");
    });
  });

  describe("Date on or after start day → next month cycle", () => {
    it("day 25 → next month cycle", () => {
      const now = new Date(2025, 2, 25); // March 25
      const cycle = getFinancialCycle(now);
      expect(cycle.cycleKey).toBe("2025-04");
      expect(cycle.label).toBe("April 2025");
    });

    it("day 26 → next month cycle", () => {
      const now = new Date(2025, 2, 26); // March 26
      const cycle = getFinancialCycle(now);
      expect(cycle.cycleKey).toBe("2025-04");
    });

    it("day 31 → next month cycle", () => {
      const now = new Date(2025, 0, 31); // Jan 31
      const cycle = getFinancialCycle(now);
      expect(cycle.cycleKey).toBe("2025-02");
    });
  });

  describe("Year boundary handling", () => {
    it("December 25+ → January of next year", () => {
      const now = new Date(2025, 11, 25); // Dec 25
      const cycle = getFinancialCycle(now);
      expect(cycle.cycleKey).toBe("2026-01");
      expect(cycle.label).toBe("January 2026");
    });

    it("December 24 → December of same year", () => {
      const now = new Date(2025, 11, 24); // Dec 24
      const cycle = getFinancialCycle(now);
      expect(cycle.cycleKey).toBe("2025-12");
    });

    it("January 1 → January of same year", () => {
      const now = new Date(2025, 0, 1); // Jan 1
      const cycle = getFinancialCycle(now);
      expect(cycle.cycleKey).toBe("2025-01");
    });
  });

  describe("Custom start day", () => {
    it("start day 1: day 1+ → next month cycle", () => {
      const now = new Date(2025, 2, 1); // March 1
      const cycle = getFinancialCycle(now, 1);
      expect(cycle.cycleKey).toBe("2025-04");
    });

    it("start day 15: day 14 → current month cycle", () => {
      const now = new Date(2025, 2, 14); // March 14
      const cycle = getFinancialCycle(now, 15);
      expect(cycle.cycleKey).toBe("2025-03");
    });

    it("start day 15: day 15 → next month cycle", () => {
      const now = new Date(2025, 2, 15); // March 15
      const cycle = getFinancialCycle(now, 15);
      expect(cycle.cycleKey).toBe("2025-04");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// getCurrentFinancialMonth (alias) - Tests
// ═══════════════════════════════════════════════════════════════════════

describe("getCurrentFinancialMonth", () => {
  it("is an alias for getFinancialCycle", () => {
    expect(getCurrentFinancialMonth).toBe(getFinancialCycle);
  });

  it("returns same result as getFinancialCycle", () => {
    const now = new Date(2025, 5, 10);
    expect(getCurrentFinancialMonth(now)).toEqual(getFinancialCycle(now));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// getFinancialCycleForDate - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("getFinancialCycleForDate", () => {
  it("maps date string to correct cycle (after start day)", () => {
    const cycle = getFinancialCycleForDate("2025-03-26");
    expect(cycle.cycleKey).toBe("2025-04");
  });

  it("maps date string to correct cycle (before start day)", () => {
    const cycle = getFinancialCycleForDate("2025-03-10");
    expect(cycle.cycleKey).toBe("2025-03");
  });

  it("maps date on start day to next cycle", () => {
    const cycle = getFinancialCycleForDate("2025-03-25");
    expect(cycle.cycleKey).toBe("2025-04");
  });

  it("returns current cycle for empty string", () => {
    const cycle = getFinancialCycleForDate("");
    expect(cycle.cycleKey).toBeDefined();
    expect(cycle.cycleKey).toMatch(/^\d{4}-\d{2}$/);
  });

  it("handles year boundary dates", () => {
    const cycle = getFinancialCycleForDate("2024-12-26");
    expect(cycle.cycleKey).toBe("2025-01");
  });

  it("respects custom start day", () => {
    const cycle = getFinancialCycleForDate("2025-03-10", 10);
    expect(cycle.cycleKey).toBe("2025-04");
  });

  it("handles first day of year", () => {
    const cycle = getFinancialCycleForDate("2025-01-01");
    expect(cycle.cycleKey).toBe("2025-01");
  });

  it("handles last day of year", () => {
    const cycle = getFinancialCycleForDate("2025-12-31");
    expect(cycle.cycleKey).toBe("2026-01");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// getRecentFinancialMonths - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("getRecentFinancialMonths", () => {
  it("returns default 6 cycles", () => {
    const cycles = getRecentFinancialMonths(6, new Date(2025, 5, 10));
    expect(cycles).toHaveLength(6);
  });

  it("first element is current cycle", () => {
    const now = new Date(2025, 5, 10); // June 10
    const cycles = getRecentFinancialMonths(3, now);
    expect(cycles[0].cycleKey).toBe("2025-06");
  });

  it("returns cycles in descending order", () => {
    const cycles = getRecentFinancialMonths(4, new Date(2025, 5, 10));
    expect(cycles[0].cycleKey).toBe("2025-06");
    expect(cycles[1].cycleKey).toBe("2025-05");
    expect(cycles[2].cycleKey).toBe("2025-04");
    expect(cycles[3].cycleKey).toBe("2025-03");
  });

  it("wraps year boundary correctly", () => {
    const cycles = getRecentFinancialMonths(4, new Date(2025, 0, 10)); // Jan 10
    expect(cycles[0].cycleKey).toBe("2025-01");
    expect(cycles[1].cycleKey).toBe("2024-12");
    expect(cycles[2].cycleKey).toBe("2024-11");
    expect(cycles[3].cycleKey).toBe("2024-10");
  });

  it("handles count of 1", () => {
    const cycles = getRecentFinancialMonths(1, new Date(2025, 5, 10));
    expect(cycles).toHaveLength(1);
    expect(cycles[0].cycleKey).toBe("2025-06");
  });

  it("handles large count (12 months)", () => {
    const cycles = getRecentFinancialMonths(12, new Date(2025, 5, 10));
    expect(cycles).toHaveLength(12);
    expect(cycles[11].cycleKey).toBe("2024-07");
  });

  it("respects custom start day", () => {
    const cycles = getRecentFinancialMonths(2, new Date(2025, 2, 10), 15);
    // March 10 with start day 15 → current cycle is March (before 15)
    expect(cycles[0].cycleKey).toBe("2025-03");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// formatShortDate - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("formatShortDate", () => {
  it("formats standard date", () => {
    const result = formatShortDate("2025-03-24");
    expect(result).toMatch(/24.*Mar/);
  });

  it("formats first day of month", () => {
    const result = formatShortDate("2025-01-01");
    expect(result).toMatch(/01.*Jan/);
  });

  it("formats last day of month", () => {
    const result = formatShortDate("2025-12-31");
    expect(result).toMatch(/31.*Dec/);
  });

  it("formats different months correctly", () => {
    expect(formatShortDate("2025-06-15")).toMatch(/15.*Jun/);
    expect(formatShortDate("2025-09-05")).toMatch(/05.*Sep/);
    expect(formatShortDate("2025-11-20")).toMatch(/20.*Nov/);
  });

  it("handles leap year date", () => {
    const result = formatShortDate("2024-02-29");
    expect(result).toMatch(/29.*Feb/);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// getCycleDayInfo - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("getCycleDayInfo", () => {
  it("returns correct info at start of cycle", () => {
    const now = new Date(2025, 1, 25); // Feb 25 (start of March cycle)
    const info = getCycleDayInfo(now);
    expect(info.daysElapsed).toBeGreaterThanOrEqual(1);
    expect(info.totalDays).toBeGreaterThan(0);
    expect(info.daysRemaining).toBeLessThanOrEqual(info.totalDays);
  });

  it("returns correct info mid-cycle", () => {
    const now = new Date(2025, 2, 10); // March 10 (mid March cycle)
    const info = getCycleDayInfo(now);
    expect(info.daysElapsed).toBeGreaterThan(1);
    expect(info.daysRemaining).toBeGreaterThan(0);
    expect(info.daysElapsed + info.daysRemaining).toBeLessThanOrEqual(info.totalDays + 1);
  });

  it("daysElapsed is at least 1", () => {
    const now = new Date(2025, 1, 25); // Exactly on start day
    const info = getCycleDayInfo(now);
    expect(info.daysElapsed).toBeGreaterThanOrEqual(1);
  });

  it("daysRemaining is never negative", () => {
    // Even at cycle end
    const now = new Date(2025, 2, 24); // March 24 (end of March cycle)
    const info = getCycleDayInfo(now);
    expect(info.daysRemaining).toBeGreaterThanOrEqual(0);
  });

  it("totalDays is approximately 28-31", () => {
    const now = new Date(2025, 5, 10);
    const info = getCycleDayInfo(now);
    expect(info.totalDays).toBeGreaterThanOrEqual(27);
    expect(info.totalDays).toBeLessThanOrEqual(32);
  });

  it("respects custom start day", () => {
    const now = new Date(2025, 2, 5); // March 5
    const info15 = getCycleDayInfo(now, 15);
    const info25 = getCycleDayInfo(now, 25);
    // Different start days should give different elapsed days
    expect(info15.daysElapsed).not.toBe(info25.daysElapsed);
  });
});
