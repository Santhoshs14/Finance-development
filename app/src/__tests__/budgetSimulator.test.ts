import { describe, it, expect } from "vitest";
import { simulateBudgetChange } from "@/utils/budgetSimulator";

describe("budgetSimulator.simulateBudgetChange", () => {
  it("returns zero deltas when proposed = current", () => {
    const r = simulateBudgetChange({
      income: 100000,
      actualByCategory: { Food: 10000, Rent: 30000 },
      currentLimits: { Food: 10000, Rent: 30000 },
      proposedLimits: {},
    });
    expect(r.netDelta).toBe(0);
    expect(r.reductions).toEqual([]);
    expect(r.increases).toEqual([]);
  });

  it("computes savings rate correctly", () => {
    const r = simulateBudgetChange({
      income: 100000,
      actualByCategory: { Food: 20000, Rent: 30000 },
      currentLimits: {},
      proposedLimits: {},
    });
    expect(r.currentSavingsRate).toBe(50); // (100k - 50k) / 100k * 100
  });

  it("caps spend at proposed limit when lower than actual", () => {
    const r = simulateBudgetChange({
      income: 100000,
      actualByCategory: { Food: 20000, Rent: 30000 },
      currentLimits: { Food: 25000, Rent: 30000 },
      proposedLimits: { Food: 10000 },
    });
    // Proposed spend = min(20k, 10k) + min(30k, 30k) = 40k
    expect(r.proposedSavingsRate).toBe(60); // (100k - 40k) / 100k
    expect(r.netDelta).toBe(10000); // 60k - 50k
  });

  it("identifies category reductions and increases", () => {
    const r = simulateBudgetChange({
      income: 100000,
      actualByCategory: { Food: 20000 },
      currentLimits: { Food: 20000, Rent: 30000 },
      proposedLimits: { Food: 15000, Rent: 35000 },
    });
    expect(r.reductions).toEqual([{ category: "Food", from: 20000, to: 15000 }]);
    expect(r.increases).toEqual([{ category: "Rent", from: 30000, to: 35000 }]);
  });

  it("handles zero income gracefully", () => {
    const r = simulateBudgetChange({
      income: 0,
      actualByCategory: { Food: 10000 },
      currentLimits: {},
      proposedLimits: {},
    });
    expect(r.currentSavingsRate).toBe(0);
    expect(r.proposedSavingsRate).toBe(0);
  });

  it("delta percent is 0 when current net is 0", () => {
    const r = simulateBudgetChange({
      income: 50000,
      actualByCategory: { Food: 50000 },
      currentLimits: { Food: 50000 },
      proposedLimits: { Food: 30000 },
    });
    expect(r.deltaPercent).toBe(0);
  });
});
