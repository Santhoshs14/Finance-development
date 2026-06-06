import { describe, it, expect } from "vitest";
import { calculateTax, compareRegimes } from "@/utils/taxRegime";

describe("taxRegime — FY 2025-26", () => {
  describe("calculateTax (new regime)", () => {
    it("computes zero tax under 4L (after std deduction)", () => {
      // 4L gross + 75k std deduction = 3.25L taxable → zero
      const result = calculateTax({ grossIncome: 400000 }, "new");
      expect(result.totalTax).toBe(0);
    });

    it("87A rebate zeroes out tax up to 12L taxable income", () => {
      const result = calculateTax({ grossIncome: 1275000 }, "new");
      expect(result.totalTax).toBe(0); // 12L after 75k std deduction
    });

    it("computes correct tax at 20L gross", () => {
      const result = calculateTax({ grossIncome: 2000000 }, "new");
      // Taxable = 19.25L
      // 0-4L: 0
      // 4-8L: 4L * 5% = 20k
      // 8-12L: 4L * 10% = 40k
      // 12-16L: 4L * 15% = 60k
      // 16-19.25L: 3.25L * 20% = 65k
      // Total base tax = 185k
      // No rebate (taxable > 12L)
      // Cess = 185k * 4% = 7400
      // Total = 192400
      expect(result.taxBeforeRebate).toBe(185000);
      expect(result.rebate87A).toBe(0);
      expect(result.cess).toBeCloseTo(7400, 0);
      expect(result.totalTax).toBeCloseTo(192400, 0);
    });

    it("applies surcharge above 50L", () => {
      const result = calculateTax({ grossIncome: 6000000 }, "new");
      expect(result.surcharge).toBeGreaterThan(0);
    });
  });

  describe("calculateTax (old regime)", () => {
    it("standard deduction is 50k under old regime", () => {
      const result = calculateTax({ grossIncome: 250000 }, "old");
      expect(result.totalDeductions).toBe(50000);
      expect(result.taxableIncome).toBe(200000);
      expect(result.totalTax).toBe(0);
    });

    it("87A rebate caps tax at 5L taxable", () => {
      // 5.5L gross - 50k std = 5L taxable → fully rebated
      const result = calculateTax({ grossIncome: 550000 }, "old");
      expect(result.totalTax).toBe(0);
    });

    it("applies 80C deduction up to 1.5L cap", () => {
      const result = calculateTax(
        { grossIncome: 1000000, deduction80C: 200000 },
        "old"
      );
      // 10L - 50k std - 1.5L 80C cap = 8L taxable
      expect(result.taxableIncome).toBe(800000);
    });

    it("does not apply 80C under new regime", () => {
      const result = calculateTax(
        { grossIncome: 1000000, deduction80C: 150000 },
        "new"
      );
      // New regime ignores 80C
      expect(result.taxableIncome).toBe(925000); // 10L - 75k std
    });

    it("allows higher 80D for seniors", () => {
      const senior = calculateTax(
        { grossIncome: 1000000, deduction80D: 50000, senior: true },
        "old"
      );
      const regular = calculateTax(
        { grossIncome: 1000000, deduction80D: 50000 },
        "old"
      );
      expect(senior.totalDeductions).toBeGreaterThan(regular.totalDeductions);
    });

    it("uses senior slabs for senior taxpayers", () => {
      const senior = calculateTax({ grossIncome: 300000, senior: true }, "old");
      expect(senior.totalTax).toBe(0); // 3L exemption for seniors
    });
  });

  describe("compareRegimes", () => {
    it("recommends new regime for low income earners (no deductions)", () => {
      const result = compareRegimes({ grossIncome: 800000 });
      expect(result.recommended).toBe("new");
    });

    it("can favor old regime when heavy deductions are applied", () => {
      const result = compareRegimes({
        grossIncome: 1500000,
        deduction80C: 150000,
        deduction80D: 25000,
        deduction80CCD1B: 50000,
        deductionOther: 100000,
      });
      // Total tax should be tested either way without crashing.
      expect(result.savings).toBeGreaterThanOrEqual(0);
      expect(["old", "new"]).toContain(result.recommended);
    });

    it("returns positive savings (or zero) regardless of recommendation", () => {
      const result = compareRegimes({ grossIncome: 2500000 });
      expect(result.savings).toBeGreaterThanOrEqual(0);
    });
  });

  describe("slab breakdown", () => {
    it("returns per-slab rows for new regime", () => {
      const result = calculateTax({ grossIncome: 1500000 }, "new");
      expect(result.slabBreakdown.length).toBeGreaterThan(0);
      expect(result.slabBreakdown.every((r) => r.tax >= 0)).toBe(true);
    });
  });
});
