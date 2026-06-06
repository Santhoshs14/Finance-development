import { describe, it, expect } from "vitest";
import {
  calculateNetWorth,
  calculateSavingsRateFromAggregates,
  calculateBudgetUsageFromAggregates,
} from "@/utils/calculations";

describe("calculateNetWorth", () => {
  it("sums accounts + investments - liabilities", () => {
    const accounts = [
      { id: "1", account_name: "Savings", type: "savings", balance: 50000 },
      { id: "2", account_name: "CC", type: "credit", liability: 5000, credit_limit: 100000 },
    ];
    const investments = [
      { id: "i1", name: "MF", buy_price: 100, current_price: 120, quantity: 10 },
    ];
    const result = calculateNetWorth(accounts, investments, []);
    expect(result.total_accounts).toBe(50000);
    expect(result.total_investments).toBe(1200);
    expect(result.total_cc_outstanding).toBe(5000);
    expect(result.net_worth).toBe(50000 + 1200 - 5000);
  });

  it("includes lending in net worth", () => {
    const accounts = [{ id: "1", account_name: "Savings", type: "savings", balance: 10000 }];
    const lending = [
      { id: "l1", type: "lent" as const, status: "pending", amount: 3000, paid_amount: 1000 },
      { id: "l2", type: "borrowed" as const, status: "pending", amount: 2000, paid_amount: 500 },
    ];
    const result = calculateNetWorth(accounts, [], lending);
    expect(result.total_lent).toBe(2000); // 3000 - 1000
    expect(result.total_borrowed).toBe(1500); // 2000 - 500
    expect(result.net_worth).toBe(10000 + 2000 - 1500);
  });

  it("returns zeros for empty input", () => {
    const result = calculateNetWorth([], [], []);
    expect(result.net_worth).toBe(0);
  });
});

describe("calculateSavingsRateFromAggregates", () => {
  it("calculates savings rate", () => {
    const result = calculateSavingsRateFromAggregates({
      totalIncome: 100000,
      totalSpent: 60000,
    });
    expect(result.savings).toBe(40000);
    expect(result.savings_rate).toBe(40);
  });

  it("returns 0 when no income", () => {
    const result = calculateSavingsRateFromAggregates({
      totalIncome: 0,
      totalSpent: 5000,
    });
    expect(result.savings_rate).toBe(0);
  });
});

describe("calculateBudgetUsageFromAggregates", () => {
  it("calculates budget usage per category", () => {
    const budgets = [
      { id: "b1", category: "Food", monthly_limit: 10000 },
      { id: "b2", category: "Transport", monthly_limit: 5000 },
    ];
    const aggregate = {
      totalSpent: 12000,
      categoryBreakdown: { Food: 8000, Transport: 4000 },
    };
    const result = calculateBudgetUsageFromAggregates(budgets, aggregate);
    expect(result).toHaveLength(2);
    expect(result[0].category).toBe("Food");
    expect(result[0].spent).toBe(8000);
    expect(result[0].usage_percentage).toBe(80);
  });
});

describe("calculateSavingsRateFromAggregates - investment awareness", () => {
  it("treats investment spending as savings", () => {
    const result = calculateSavingsRateFromAggregates({
      totalIncome: 100000,
      totalSpent: 60000,
      totalInvestmentSpend: 20000,
    });
    // Effective expenses = 60000 - 20000 = 40000
    // Savings = 100000 - 40000 = 60000
    expect(result.savings).toBe(60000);
    expect(result.savings_rate).toBe(60);
    expect(result.investmentSpend).toBe(20000);
  });

  it("still works without investment spend (backward compatible)", () => {
    const result = calculateSavingsRateFromAggregates({
      totalIncome: 100000,
      totalSpent: 60000,
    });
    expect(result.savings).toBe(40000);
    expect(result.savings_rate).toBe(40);
    expect(result.investmentSpend).toBe(0);
  });

  it("handles 100% investment (all spending is investment)", () => {
    const result = calculateSavingsRateFromAggregates({
      totalIncome: 100000,
      totalSpent: 50000,
      totalInvestmentSpend: 50000,
    });
    // Effective expenses = 0, savings = 100000
    expect(result.savings).toBe(100000);
    expect(result.savings_rate).toBe(100);
  });
});
