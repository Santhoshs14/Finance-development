import { describe, it, expect } from "vitest";
import {
  getFinancialYearForDate,
  getRecentFinancialYears,
  isInFinancialYear,
  fyMonthIndex,
  fyMonthLabels,
  monthName,
} from "@/utils/financialYear";

describe("financialYear", () => {
  describe("getFinancialYearForDate", () => {
    it("classifies April 1 as start of FY", () => {
      const fy = getFinancialYearForDate("2025-04-01");
      expect(fy.startYear).toBe(2025);
      expect(fy.endYear).toBe(2026);
      expect(fy.fyKey).toBe("FY2025-26");
      expect(fy.fyStart).toBe("2025-04-01");
      expect(fy.fyEnd).toBe("2026-03-31");
    });

    it("classifies March 31 as end of previous FY", () => {
      const fy = getFinancialYearForDate("2026-03-31");
      expect(fy.startYear).toBe(2025);
      expect(fy.fyKey).toBe("FY2025-26");
    });

    it("classifies January as part of previous-year FY", () => {
      const fy = getFinancialYearForDate("2026-01-15");
      expect(fy.startYear).toBe(2025);
      expect(fy.fyKey).toBe("FY2025-26");
    });

    it("classifies April 5 as new FY", () => {
      const fy = getFinancialYearForDate("2025-04-05");
      expect(fy.startYear).toBe(2025);
      expect(fy.fyKey).toBe("FY2025-26");
    });

    it("classifies December as same-year FY", () => {
      const fy = getFinancialYearForDate("2025-12-25");
      expect(fy.startYear).toBe(2025);
      expect(fy.fyKey).toBe("FY2025-26");
    });
  });

  describe("getRecentFinancialYears", () => {
    it("returns N years descending", () => {
      const fys = getRecentFinancialYears(3, new Date("2026-06-06"));
      expect(fys).toHaveLength(3);
      expect(fys[0]!.fyKey).toBe("FY2026-27");
      expect(fys[1]!.fyKey).toBe("FY2025-26");
      expect(fys[2]!.fyKey).toBe("FY2024-25");
    });
  });

  describe("isInFinancialYear", () => {
    it("includes Apr 1 start", () => {
      const fy = getFinancialYearForDate("2025-06-01");
      expect(isInFinancialYear("2025-04-01", fy)).toBe(true);
    });
    it("includes Mar 31 end", () => {
      const fy = getFinancialYearForDate("2025-06-01");
      expect(isInFinancialYear("2026-03-31", fy)).toBe(true);
    });
    it("rejects out-of-range dates", () => {
      const fy = getFinancialYearForDate("2025-06-01");
      expect(isInFinancialYear("2025-03-31", fy)).toBe(false);
      expect(isInFinancialYear("2026-04-01", fy)).toBe(false);
    });
  });

  describe("fyMonthIndex", () => {
    it("maps April to 0", () => {
      expect(fyMonthIndex("2025-04-15")).toBe(0);
    });
    it("maps March to 11", () => {
      expect(fyMonthIndex("2026-03-15")).toBe(11);
    });
    it("maps December to 8", () => {
      expect(fyMonthIndex("2025-12-15")).toBe(8);
    });
  });

  describe("fyMonthLabels", () => {
    it("returns 12 labels in April-first order", () => {
      const fy = getFinancialYearForDate("2025-06-01");
      const labels = fyMonthLabels(fy);
      expect(labels).toHaveLength(12);
      expect(labels[0]).toBe("Apr 2025");
      expect(labels[11]).toBe("Mar 2026");
    });
  });

  describe("monthName", () => {
    it("maps 0 to January", () => {
      expect(monthName(0)).toBe("January");
    });
    it("maps 11 to December", () => {
      expect(monthName(11)).toBe("December");
    });
  });
});
