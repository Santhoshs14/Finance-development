import { describe, it, expect } from "vitest";
import { simulateGoalContributions } from "@/utils/monteCarlo";

describe("monteCarlo.simulateGoalContributions", () => {
  it("returns horizon+1 points (0..N)", () => {
    const result = simulateGoalContributions({
      currentAmount: 0,
      targetAmount: 100000,
      history: [5000, 5000, 5000],
      horizonMonths: 12,
      simulations: 200,
      seed: 42,
    });
    expect(result.points).toHaveLength(13); // months 0..12
  });

  it("hits target with sufficient contributions", () => {
    const result = simulateGoalContributions({
      currentAmount: 0,
      targetAmount: 30000,
      history: [5000, 5000, 5000],
      horizonMonths: 12,
      simulations: 500,
      seed: 123,
    });
    expect(result.medianCompletionMonths).not.toBeNull();
    expect(result.medianCompletionMonths!).toBeLessThanOrEqual(12);
  });

  it("returns null completion when target unreachable", () => {
    const result = simulateGoalContributions({
      currentAmount: 0,
      targetAmount: 1_000_000,
      history: [100],
      horizonMonths: 6,
      simulations: 100,
      seed: 42,
    });
    expect(result.medianCompletionMonths).toBeNull();
  });

  it("is deterministic when seeded", () => {
    const a = simulateGoalContributions({
      currentAmount: 0,
      targetAmount: 50000,
      history: [3000, 4000, 5000],
      horizonMonths: 12,
      simulations: 200,
      seed: 7,
    });
    const b = simulateGoalContributions({
      currentAmount: 0,
      targetAmount: 50000,
      history: [3000, 4000, 5000],
      horizonMonths: 12,
      simulations: 200,
      seed: 7,
    });
    expect(a.medianCompletionMonths).toBe(b.medianCompletionMonths);
    expect(a.points[6]!.p50).toBeCloseTo(b.points[6]!.p50, 5);
  });

  it("compounds with annual return rate", () => {
    const noReturn = simulateGoalContributions({
      currentAmount: 100000,
      targetAmount: 200000,
      history: [0, 0, 0],
      horizonMonths: 60,
      simulations: 100,
      seed: 1,
      annualReturnRate: 0,
    });
    const withReturn = simulateGoalContributions({
      currentAmount: 100000,
      targetAmount: 200000,
      history: [0, 0, 0],
      horizonMonths: 60,
      simulations: 100,
      seed: 1,
      annualReturnRate: 0.12,
    });
    // With 12% return on 100k, in 60 months we should reach ~180k
    expect(withReturn.points[60]!.p50).toBeGreaterThan(noReturn.points[60]!.p50);
  });

  it("p10 ≤ p50 ≤ p90 at every point", () => {
    const result = simulateGoalContributions({
      currentAmount: 0,
      targetAmount: 50000,
      history: [2000, 3000, 4000, 5000],
      horizonMonths: 24,
      simulations: 500,
      seed: 99,
    });
    for (const p of result.points) {
      expect(p.p10).toBeLessThanOrEqual(p.p50);
      expect(p.p50).toBeLessThanOrEqual(p.p90);
    }
  });

  it("success probability is monotonically non-decreasing", () => {
    const result = simulateGoalContributions({
      currentAmount: 0,
      targetAmount: 10000,
      history: [1000, 1500, 2000],
      horizonMonths: 24,
      simulations: 500,
      seed: 5,
    });
    for (let i = 1; i < result.points.length; i++) {
      expect(result.points[i]!.successProbability).toBeGreaterThanOrEqual(
        result.points[i - 1]!.successProbability
      );
    }
  });
});
