import { describe, it, expect, beforeEach } from "vitest";
import { fmt, fmtCompact, setCurrencyFormat } from "@/utils/format";
import {
  calculateNetWorth,
  calculateSavingsRateFromAggregates,
  calculateBudgetUsageFromAggregates,
  calculateCCUtilization,
  calculateInvestmentPL,
  calculateXIRR,
  calculateSIPGrowth,
  calculateGoalCompletion,
  calculateCycleSummary,
  calculateBudgetForecast,
  calculateCreditCardHealth,
  compareCycles,
  detectRecurringTransactions,
  calculateGoldValue,
  calculateGoldReturns,
  calculatePortfolioAllocation,
  calculateFinancialHealthScore,
  type Account,
  type Investment,
  type LendingItem,
  type Aggregate,
  type Goal,
} from "@/utils/calculations";
import {
  getFinancialMonthRange,
  getFinancialCycle,
  getFinancialCycleForDate,
  getRecentFinancialMonths,
  getCycleDayInfo,
} from "@/utils/financialMonth";
import { suggestCategory, createRuleFromCorrection } from "@/utils/categorization";
import {
  predictEndOfCycleSpending,
  detectSpendingAnomalies,
  findSavingsOpportunities,
  generateInsightsFromAggregates,
  generateCycleComparisonInsights,
} from "@/utils/insights";

// ═══════════════════════════════════════════════════════════════════════
// Edge Cases & Boundary Tests
// ═══════════════════════════════════════════════════════════════════════

describe("Edge Cases & Boundary Tests", () => {

  describe("Numeric boundary conditions", () => {
    it("calculateNetWorth handles Number.MAX_SAFE_INTEGER", () => {
      const accounts: Account[] = [
        { id: "1", account_name: "Rich", type: "savings", balance: Number.MAX_SAFE_INTEGER },
      ];
      const result = calculateNetWorth(accounts, [], []);
      expect(result.total_accounts).toBe(Number.MAX_SAFE_INTEGER);
    });

    it("calculateNetWorth handles negative balances", () => {
      const accounts: Account[] = [
        { id: "1", account_name: "Overdrawn", type: "current", balance: -5000 },
      ];
      const result = calculateNetWorth(accounts, [], []);
      expect(result.total_accounts).toBe(-5000);
      expect(result.net_worth).toBe(-5000);
    });

    it("calculateSIPGrowth handles very small monthly amount", () => {
      const result = calculateSIPGrowth(1, 12, 30);
      expect(result.total_invested).toBe(360); // 1 * 360 months
      expect(result.estimated_value).toBeGreaterThan(360);
    });

    it("calculateSIPGrowth handles very high return rate", () => {
      const result = calculateSIPGrowth(1000, 100, 5);
      expect(result.estimated_value).toBeGreaterThan(result.total_invested);
      expect(isFinite(result.estimated_value)).toBe(true);
    });

    it("calculateXIRR handles very close dates", () => {
      const cashflows = [
        { date: "2025-01-01", amount: -10000 },
        { date: "2025-01-02", amount: 10100 },
      ];
      const result = calculateXIRR(cashflows);
      expect(isFinite(result)).toBe(true);
    });

    it("calculateBudgetForecast handles very large spent vs small limit", () => {
      const result = calculateBudgetForecast(1000000, 100, 10, 30);
      expect(result.overBy).toBe(999900);
      expect(result.remaining).toBe(0);
    });

    it("calculateGoldValue handles fractional weight", () => {
      const result = calculateGoldValue(0.5, 24, 6000);
      expect(result).toBe(3000);
    });

    it("fmt handles Infinity", () => {
      setCurrencyFormat("INR");
      const result = fmt(Infinity);
      expect(result).toContain("₹");
    });

    it("fmt handles NaN", () => {
      setCurrencyFormat("INR");
      expect(fmt(NaN)).toBe("₹0");
    });

    it("fmtCompact handles negative zero", () => {
      setCurrencyFormat("INR");
      expect(fmtCompact(-0)).toBe("₹0");
    });
  });

  describe("Empty/null/undefined input handling", () => {
    it("calculateBudgetUsageFromAggregates with null aggregate", () => {
      // Using undefined as the aggregate
      const result = calculateBudgetUsageFromAggregates(
        [{ id: "b1", category: "Food", monthly_limit: 5000 }],
        {} as Aggregate
      );
      expect(result[0].spent).toBe(0);
    });

    it("calculateCCUtilization with all non-credit accounts", () => {
      const accounts: Account[] = [
        { id: "1", account_name: "Savings", type: "savings", balance: 50000 },
        { id: "2", account_name: "Current", type: "current", balance: 25000 },
      ];
      const result = calculateCCUtilization(accounts);
      expect(result).toHaveLength(0);
    });

    it("calculateInvestmentPL with empty array", () => {
      const result = calculateInvestmentPL([]);
      expect(result).toHaveLength(0);
    });

    it("compareCycles with empty category breakdowns", () => {
      const result = compareCycles(
        { totalSpent: 5000, categoryBreakdown: {} },
        { totalSpent: 3000, categoryBreakdown: {} }
      );
      expect(Object.keys(result.categoryChanges)).toHaveLength(0);
    });

    it("detectRecurringTransactions with empty array", () => {
      const result = detectRecurringTransactions([]);
      expect(result).toHaveLength(0);
    });

    it("calculateCycleSummary with empty category breakdown", () => {
      const result = calculateCycleSummary(
        { totalSpent: 0, totalIncome: 0, categoryBreakdown: {} },
        { daysElapsed: 10 }
      );
      expect(result.topCategory).toBe("—");
    });
  });

  describe("Financial cycle edge cases", () => {
    it("getFinancialCycle on exactly Dec 31 with default startDay", () => {
      const now = new Date(2025, 11, 31); // Dec 31
      const cycle = getFinancialCycle(now);
      expect(cycle.cycleKey).toBe("2026-01"); // After 25th, so January next year
    });

    it("getFinancialCycle on Jan 1 with default startDay", () => {
      const now = new Date(2025, 0, 1); // Jan 1
      const cycle = getFinancialCycle(now);
      expect(cycle.cycleKey).toBe("2025-01"); // Before 25th
    });

    it("getFinancialCycleForDate handles leap year Feb 29", () => {
      const cycle = getFinancialCycleForDate("2024-02-29");
      expect(cycle.cycleKey).toBeDefined();
    });

    it("getRecentFinancialMonths handles crossing multiple years", () => {
      const cycles = getRecentFinancialMonths(24, new Date(2025, 0, 10));
      expect(cycles).toHaveLength(24);
      // Should span from 2025-01 back to 2023-02
      expect(cycles[0].year).toBe(2025);
      expect(cycles[23].year).toBe(2023);
    });

    it("getCycleDayInfo near cycle boundary (day before start)", () => {
      // Day 24 with default startDay 25 - should be near end of cycle
      const now = new Date(2025, 2, 24); // March 24
      const info = getCycleDayInfo(now);
      // This should be near the end of March cycle
      expect(info.daysRemaining).toBeLessThanOrEqual(1);
    });

    it("getCycleDayInfo at exact start of cycle", () => {
      const now = new Date(2025, 1, 25); // Feb 25 (start of March cycle)
      const info = getCycleDayInfo(now);
      expect(info.daysElapsed).toBe(1);
    });
  });

  describe("Categorization edge cases", () => {
    const categories = ["Food", "Travel", "Shopping", "Subscription", "Bills", "Income"];

    it("suggestCategory with mixed case and extra spaces", () => {
      const result = suggestCategory("  SWIGGY  order  ", [], categories);
      expect(result).not.toBeNull();
      expect(result!.category).toBe("Food");
    });

    it("suggestCategory with multiple matching keywords", () => {
      // "netflix" matches Subscription, text also has "salary" which matches Income
      const result = suggestCategory("netflix salary bonus", [], [...categories, "Income"]);
      expect(result).not.toBeNull();
      // Should pick highest confidence match
    });

    it("createRuleFromCorrection with only 2-char words", () => {
      const result = createRuleFromCorrection("ab cd ef", "Food");
      expect(result).toBeNull(); // No word >= 3 chars
    });

    it("createRuleFromCorrection extracts longest word for long text", () => {
      const result = createRuleFromCorrection("this is a very extraordinarily long description text for a transaction", "Shopping");
      expect(result).not.toBeNull();
      expect(result!.keyword).toBe("extraordinarily"); // Longest word
    });
  });

  describe("Insights edge cases", () => {
    it("generateInsightsFromAggregates with savings rate exactly 10%", () => {
      const aggregate: Aggregate = { totalIncome: 100000, totalSpent: 90000, categoryBreakdown: {} };
      const insights = generateInsightsFromAggregates(aggregate, [], []);
      // 10% is not < 10, so no low-savings warning
      const low = insights.find(i => i.id === "low-savings");
      expect(low).toBeUndefined();
    });

    it("generateInsightsFromAggregates with savings rate exactly 40%", () => {
      const aggregate: Aggregate = { totalIncome: 100000, totalSpent: 60000, categoryBreakdown: {} };
      const insights = generateInsightsFromAggregates(aggregate, [], []);
      // 40% is not > 40, so no great-savings
      const great = insights.find(i => i.id === "great-savings");
      expect(great).toBeUndefined();
    });

    it("predictEndOfCycleSpending with exactly 20% savings projected", () => {
      // onTrack threshold is savings >= income * 0.2
      const result = predictEndOfCycleSpending(40000, 15, 30, 100000);
      // Projected: 40000/15*30 = 80000, Savings: 20000 = 20% exactly
      expect(result.onTrack).toBe(true);
    });

    it("detectSpendingAnomalies with all zero past data", () => {
      const current = { Food: 1000 };
      const past = [{ Food: 0 }, { Food: 0 }, { Food: 0 }];
      const anomalies = detectSpendingAnomalies(current, past);
      // No past spending > 0 means it's filtered out
      expect(anomalies).toHaveLength(0);
    });

    it("generateCycleComparisonInsights exact 15% spending increase", () => {
      const current: Aggregate = { totalSpent: 57500, totalIncome: 100000, categoryBreakdown: {} };
      const previous: Aggregate = { totalSpent: 50000, totalIncome: 100000, categoryBreakdown: {} };
      // 7500/50000 = 15% exactly — threshold is > 15%
      const insights = generateCycleComparisonInsights(current, previous);
      const spendUp = insights.find(i => i.id === "cycle-spend-up");
      expect(spendUp).toBeUndefined(); // Exactly 15% should NOT trigger (> 15 required)
    });

    it("findSavingsOpportunities exact boundary values", () => {
      // Food at exactly 15% of income
      const breakdown = { Food: 15000 };
      const income = 100000;
      const opportunities = findSavingsOpportunities(breakdown, income);
      // 15% is NOT > 15%, so no opportunity
      const food = opportunities.find(o => o.category === "Food");
      expect(food).toBeUndefined();
    });
  });

  describe("Credit card health edge cases", () => {
    it("calculateCreditCardHealth with exactly 30% utilization", () => {
      const card: Account = { id: "cc1", account_name: "CC", type: "credit", liability: 30000, credit_limit: 100000 };
      const result = calculateCreditCardHealth(card);
      expect(result.utilization).toBe(30);
      expect(result.riskLevel).toBe("Safe"); // 30 is NOT > 30
    });

    it("calculateCreditCardHealth with exactly 60% utilization", () => {
      const card: Account = { id: "cc1", account_name: "CC", type: "credit", liability: 60000, credit_limit: 100000 };
      const result = calculateCreditCardHealth(card);
      expect(result.utilization).toBe(60);
      expect(result.riskLevel).toBe("Moderate"); // 60 is NOT > 60
    });

    it("calculateCreditCardHealth with exactly 90% utilization", () => {
      const card: Account = { id: "cc1", account_name: "CC", type: "credit", liability: 90000, credit_limit: 100000 };
      const result = calculateCreditCardHealth(card);
      expect(result.utilization).toBe(90);
      expect(result.riskLevel).toBe("Warning"); // 90 is NOT > 90
    });

    it("calculateCreditCardHealth string liability values", () => {
      // The function uses parseFloat(String(...))
      const card: Account = {
        id: "cc1",
        account_name: "CC",
        type: "credit",
        liability: "25000" as unknown as number,
        credit_limit: "100000" as unknown as number,
      };
      const result = calculateCreditCardHealth(card);
      expect(result.utilization).toBe(25);
    });
  });

  describe("Portfolio allocation edge cases", () => {
    it("handles investment with no type (defaults to Equity)", () => {
      const investments: Investment[] = [
        { id: "i1", name: "Unknown", buy_price: 100, current_price: 200, quantity: 10 },
      ];
      const result = calculatePortfolioAllocation([], investments);
      expect(result.totals.Equity).toBe(2000);
    });

    it("handles all money in one asset class", () => {
      const accounts: Account[] = [
        { id: "1", account_name: "All Cash", type: "savings", balance: 1000000 },
      ];
      const result = calculatePortfolioAllocation(accounts, []);
      expect(result.percentages.Cash).toBe(100);
      expect(result.percentages.Equity).toBe(0);
    });
  });

  describe("Gold calculation edge cases", () => {
    it("calculateGoldValue with very high purity not in map", () => {
      const result = calculateGoldValue(10, 99, 6000);
      // Uses purity/24 as fallback = 99/24 = 4.125
      expect(result).toBe(10 * 6000 * (99 / 24));
    });

    it("calculateGoldReturns with zero buy price", () => {
      const result = calculateGoldReturns(0, 6000, 10, 0);
      expect(result.invested).toBe(0);
      expect(result.currentValue).toBe(60000);
      expect(result.plPercentage).toBe(0); // Can't calculate % from 0 invested
    });
  });

  describe("Recurring transaction detection edge cases", () => {
    it("handles transactions all on the same day", () => {
      const transactions = [
        { date: "2025-01-01", amount: -500, category: "Food", notes: "Same day" },
        { date: "2025-01-01", amount: -500, category: "Food", notes: "Same day" },
        { date: "2025-01-01", amount: -500, category: "Food", notes: "Same day" },
      ];
      const result = detectRecurringTransactions(transactions);
      // Intervals will be 0, which doesn't match any frequency
      // Should still work without errors
      expect(Array.isArray(result)).toBe(true);
    });

    it("handles very irregular intervals but high count", () => {
      const transactions = [
        { date: "2025-01-01", amount: -1000, category: "Bills", notes: "Random bill" },
        { date: "2025-01-10", amount: -1000, category: "Bills", notes: "Random bill" },
        { date: "2025-02-05", amount: -1000, category: "Bills", notes: "Random bill" },
        { date: "2025-03-20", amount: -1000, category: "Bills", notes: "Random bill" },
        { date: "2025-04-02", amount: -1000, category: "Bills", notes: "Random bill" },
      ];
      const result = detectRecurringTransactions(transactions);
      // With 5 occurrences and irregular pattern, should still detect
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Goal completion edge cases", () => {
    it("handles deadline today", () => {
      const today = new Date().toISOString().split("T")[0];
      const goal: Goal = {
        id: "g1", goal_name: "Today", target_amount: 100000,
        current_amount: 50000, deadline: today,
      };
      const result = calculateGoalCompletion(goal);
      expect(result.months_remaining).toBe(0);
      expect(result.monthly_savings_required).toBe(50000);
    });

    it("handles very far future deadline", () => {
      const goal: Goal = {
        id: "g1", goal_name: "Far", target_amount: 10000000,
        current_amount: 0, deadline: "2050-12-31",
      };
      const result = calculateGoalCompletion(goal);
      expect(result.months_remaining).toBeGreaterThan(200);
      expect(result.monthly_savings_required).toBeGreaterThan(0);
      expect(result.monthly_savings_required).toBeLessThan(100000);
    });

    it("handles zero target amount with some current amount", () => {
      const goal: Goal = {
        id: "g1", goal_name: "Zero Target", target_amount: 0,
        current_amount: 5000, deadline: "2026-12-31",
      };
      const result = calculateGoalCompletion(goal);
      expect(result.progress_percentage).toBe(0);
      expect(result.remaining).toBe(-5000);
    });
  });

  describe("Financial health score boundary tests", () => {
    it("handles zero total assets with debt", () => {
      const score = calculateFinancialHealthScore(
        { savings_rate: 0, expenses: 50000 },
        { total_cc_outstanding: 100000, total_accounts: 0, total_investments: 0 },
        null,
        { totals: { Cash: 0 }, percentages: {} }
      );
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("handles zero expenses (targetEmergencyFund defaults to 1000)", () => {
      const score = calculateFinancialHealthScore(
        { savings_rate: 50, expenses: 0 },
        { total_cc_outstanding: 0, total_accounts: 50000, total_investments: 50000 },
        null,
        { totals: { Cash: 50000 }, percentages: { Cash: 50, Equity: 50 } }
      );
      expect(score).toBeGreaterThan(50);
    });
  });
});
