import { describe, it, expect } from "vitest";
import { projectCashflow } from "@/utils/forecast";

const historyBase = [
  { cycleKey: "2026-01", totalIncome: 100000, totalSpent: 60000, categoryBreakdown: { Food: 10000, Rent: 30000, Travel: 5000, Bills: 15000 } },
  { cycleKey: "2026-02", totalIncome: 100000, totalSpent: 65000, categoryBreakdown: { Food: 12000, Rent: 30000, Travel: 7000, Bills: 16000 } },
  { cycleKey: "2026-03", totalIncome: 100000, totalSpent: 58000, categoryBreakdown: { Food: 11000, Rent: 30000, Travel: 4000, Bills: 13000 } },
];

describe("forecast.projectCashflow", () => {
  it("returns empty array for 0 periods", () => {
    expect(projectCashflow(historyBase, { periods: 0 })).toEqual([]);
  });

  it("generates the right number of future cycles", () => {
    const out = projectCashflow(historyBase, { periods: 3 });
    expect(out).toHaveLength(3);
    expect(out[0]!.cycleKey).toBe("2026-04");
    expect(out[2]!.cycleKey).toBe("2026-06");
  });

  it("uses the rolling 3-cycle average for expenses", () => {
    const out = projectCashflow(historyBase, { periods: 1 });
    // Avg Food: (10+12+11)/3 = 11k. Sum of avgByCategory = 11+30+~5.3+~14.6 ≈ 61
    expect(out[0]!.expense).toBeGreaterThan(60000);
    expect(out[0]!.expense).toBeLessThan(65000);
  });

  it("uses max of salary or historic income", () => {
    const out = projectCashflow(historyBase, { periods: 1, monthlySalary: 50000 });
    // History income 100k > salary 50k, so income should be 100k
    expect(out[0]!.income).toBe(100000);
  });

  it("includes recurring income when greater than history", () => {
    const out = projectCashflow(historyBase, {
      periods: 1,
      monthlySalary: 50000,
      recurring: [
        { amount: 100000, frequency: "monthly", next_date: "2026-07-01", status: "active" },
      ],
    });
    // 50k salary + 100k recurring = 150k > 100k historic
    expect(out[0]!.income).toBe(150000);
  });

  it("crosses year boundary correctly", () => {
    const hist = [
      { cycleKey: "2026-12", totalIncome: 100000, totalSpent: 50000, categoryBreakdown: {} },
    ];
    const out = projectCashflow(hist, { periods: 2 });
    expect(out[0]!.cycleKey).toBe("2027-01");
    expect(out[1]!.cycleKey).toBe("2027-02");
  });

  it("handles empty history gracefully", () => {
    const out = projectCashflow([], { periods: 2, monthlySalary: 100000 });
    expect(out).toHaveLength(2);
    expect(out[0]!.income).toBe(100000);
    expect(out[0]!.expense).toBe(0);
    expect(out[0]!.net).toBe(100000);
  });

  it("converts weekly recurring to monthly approximate", () => {
    const out = projectCashflow([], {
      periods: 1,
      monthlySalary: 0,
      recurring: [
        { amount: -1000, frequency: "weekly", next_date: "2026-07-01", status: "active" },
      ],
    });
    // 1000 * 4.345 ≈ 4345
    expect(out[0]!.expense).toBeGreaterThan(4000);
    expect(out[0]!.expense).toBeLessThan(5000);
  });
});
