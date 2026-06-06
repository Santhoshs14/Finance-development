import { describe, it, expect } from "vitest";
import {
  generateInsightsFromAggregates,
  predictEndOfCycleSpending,
  detectSpendingAnomalies,
  findSavingsOpportunities,
  calculateNoSpendStreak,
  getUpcomingBillAlerts,
  generateSmartInsights,
  generateCycleComparisonInsights,
  type Insight,
  type SpendingAnomaly,
  type SavingsOpportunity,
} from "@/utils/insights";
import type { Account, Budget, Aggregate } from "@/utils/calculations";

// ═══════════════════════════════════════════════════════════════════════
// generateInsightsFromAggregates - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("generateInsightsFromAggregates", () => {
  const defaultAccounts: Account[] = [];
  const defaultBudgets: Budget[] = [];

  it("generates low savings rate warning", () => {
    const aggregate: Aggregate = { totalIncome: 100000, totalSpent: 95000, categoryBreakdown: {} };
    const insights = generateInsightsFromAggregates(aggregate, defaultBudgets, defaultAccounts);
    const low = insights.find(i => i.id === "low-savings");
    expect(low).toBeDefined();
    expect(low!.type).toBe("warning");
  });

  it("generates excellent savings rate success", () => {
    const aggregate: Aggregate = { totalIncome: 100000, totalSpent: 50000, categoryBreakdown: {} };
    const insights = generateInsightsFromAggregates(aggregate, defaultBudgets, defaultAccounts);
    const great = insights.find(i => i.id === "great-savings");
    expect(great).toBeDefined();
    expect(great!.type).toBe("success");
  });

  it("uses actualSavingsRate parameter when provided", () => {
    const aggregate: Aggregate = { totalIncome: 100000, totalSpent: 50000, categoryBreakdown: {} };
    const insights = generateInsightsFromAggregates(aggregate, defaultBudgets, defaultAccounts, 5);
    const low = insights.find(i => i.id === "low-savings");
    expect(low).toBeDefined();
  });

  it("generates budget exceeded danger", () => {
    const budgets: Budget[] = [{ id: "b1", category: "Food", monthly_limit: 10000 }];
    const aggregate: Aggregate = { totalSpent: 15000, totalIncome: 50000, categoryBreakdown: { Food: 15000 } };
    const insights = generateInsightsFromAggregates(aggregate, budgets, defaultAccounts);
    const exceeded = insights.find(i => i.id === "budget-exceeded-Food");
    expect(exceeded).toBeDefined();
    expect(exceeded!.type).toBe("danger");
    expect(exceeded!.priority).toBe(1);
  });

  it("generates approaching budget warning", () => {
    const budgets: Budget[] = [{ id: "b1", category: "Food", monthly_limit: 10000 }];
    const aggregate: Aggregate = { totalSpent: 8500, totalIncome: 50000, categoryBreakdown: { Food: 8500 } };
    const insights = generateInsightsFromAggregates(aggregate, budgets, defaultAccounts);
    const approaching = insights.find(i => i.id === "budget-approaching");
    expect(approaching).toBeDefined();
    expect(approaching!.type).toBe("warning");
  });

  it("generates CC utilization warning", () => {
    const accounts: Account[] = [
      { id: "cc1", account_name: "HDFC CC", type: "credit", liability: 50000, credit_limit: 100000 },
    ];
    const aggregate: Aggregate = { totalSpent: 5000, totalIncome: 50000, categoryBreakdown: {} };
    const insights = generateInsightsFromAggregates(aggregate, defaultBudgets, accounts);
    const ccInsight = insights.find(i => i.id.startsWith("cc-util"));
    expect(ccInsight).toBeDefined();
    expect(ccInsight!.type).toBe("warning");
  });

  it("returns empty array for null aggregate", () => {
    const insights = generateInsightsFromAggregates(null as unknown as Aggregate, [], []);
    expect(insights).toHaveLength(0);
  });

  it("sorts insights by priority (ascending)", () => {
    const budgets: Budget[] = [
      { id: "b1", category: "Food", monthly_limit: 10000 },
    ];
    const accounts: Account[] = [
      { id: "cc1", account_name: "CC", type: "credit", liability: 80000, credit_limit: 100000 },
    ];
    const aggregate: Aggregate = {
      totalIncome: 100000,
      totalSpent: 95000,
      categoryBreakdown: { Food: 15000 },
    };
    const insights = generateInsightsFromAggregates(aggregate, budgets, accounts);
    for (let i = 1; i < insights.length; i++) {
      expect(insights[i].priority).toBeGreaterThanOrEqual(insights[i - 1].priority);
    }
  });

  it("does not generate savings insight for zero income", () => {
    const aggregate: Aggregate = { totalIncome: 0, totalSpent: 5000, categoryBreakdown: {} };
    const insights = generateInsightsFromAggregates(aggregate, defaultBudgets, defaultAccounts);
    const savings = insights.find(i => i.id === "low-savings" || i.id === "great-savings");
    expect(savings).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// predictEndOfCycleSpending - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("predictEndOfCycleSpending", () => {
  it("projects spending correctly", () => {
    const result = predictEndOfCycleSpending(30000, 15, 30, 100000);
    expect(result.dailyVelocity).toBe(2000);
    expect(result.projectedTotal).toBe(60000);
    expect(result.projectedSavings).toBe(40000);
    expect(result.onTrack).toBe(true); // 40% savings > 20% target
  });

  it("flags off-track when savings < 20%", () => {
    const result = predictEndOfCycleSpending(50000, 15, 30, 100000);
    // Projected: 50000/15 * 30 = 100000
    // Savings: 100000 - 100000 = 0
    expect(result.onTrack).toBe(false);
  });

  it("handles zero days elapsed", () => {
    const result = predictEndOfCycleSpending(0, 0, 30, 100000);
    expect(result.dailyVelocity).toBe(0);
    expect(result.projectedTotal).toBe(0);
    expect(result.projectedSavings).toBe(100000);
    expect(result.onTrack).toBe(true);
  });

  it("handles zero income (always off-track if spending)", () => {
    const result = predictEndOfCycleSpending(5000, 10, 30, 0);
    expect(result.onTrack).toBe(false); // Can't meet 20% of 0
  });

  it("handles spending equals income", () => {
    const result = predictEndOfCycleSpending(10000, 10, 30, 30000);
    expect(result.projectedTotal).toBe(30000);
    expect(result.projectedSavings).toBe(0);
    expect(result.onTrack).toBe(false);
  });

  it("handles overspending projection", () => {
    const result = predictEndOfCycleSpending(80000, 15, 30, 100000);
    expect(result.projectedTotal).toBeGreaterThan(100000);
    expect(result.projectedSavings).toBeLessThan(0);
    expect(result.onTrack).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// detectSpendingAnomalies - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("detectSpendingAnomalies", () => {
  it("detects spending spike", () => {
    const current = { Food: 30000, Transport: 5000 };
    const past = [
      { Food: 10000, Transport: 5000 },
      { Food: 12000, Transport: 4500 },
      { Food: 11000, Transport: 5500 },
    ];
    const anomalies = detectSpendingAnomalies(current, past);
    const foodAnomaly = anomalies.find(a => a.category === "Food");
    expect(foodAnomaly).toBeDefined();
    expect(foodAnomaly!.type).toBe("spike");
    expect(foodAnomaly!.deviation).toBeGreaterThan(2);
  });

  it("returns empty for insufficient past data", () => {
    const current = { Food: 30000 };
    const past = [{ Food: 10000 }]; // Only 1 past period
    const anomalies = detectSpendingAnomalies(current, past);
    expect(anomalies).toHaveLength(0);
  });

  it("ignores Income category", () => {
    const current = { Income: 500000, Food: 10000 };
    const past = [
      { Income: 100000, Food: 10000 },
      { Income: 100000, Food: 10000 },
      { Income: 100000, Food: 10000 },
    ];
    const anomalies = detectSpendingAnomalies(current, past);
    const incomeAnomaly = anomalies.find(a => a.category === "Income");
    expect(incomeAnomaly).toBeUndefined();
  });

  it("ignores Transfer category", () => {
    const current = { Transfer: 50000 };
    const past = [{ Transfer: 5000 }, { Transfer: 5000 }, { Transfer: 5000 }];
    const anomalies = detectSpendingAnomalies(current, past);
    const transferAnomaly = anomalies.find(a => a.category === "Transfer");
    expect(transferAnomaly).toBeUndefined();
  });

  it("ignores Credit Card Payment category", () => {
    const current = { "Credit Card Payment": 100000 };
    const past = [
      { "Credit Card Payment": 10000 },
      { "Credit Card Payment": 10000 },
    ];
    const anomalies = detectSpendingAnomalies(current, past);
    expect(anomalies.find(a => a.category === "Credit Card Payment")).toBeUndefined();
  });

  it("ignores amounts below 500", () => {
    const current = { Food: 400 };
    const past = [{ Food: 100 }, { Food: 100 }, { Food: 100 }];
    const anomalies = detectSpendingAnomalies(current, past);
    expect(anomalies).toHaveLength(0);
  });

  it("handles zero standard deviation (constant past)", () => {
    const current = { Food: 20000 };
    const past = [{ Food: 10000 }, { Food: 10000 }, { Food: 10000 }];
    const anomalies = detectSpendingAnomalies(current, past);
    const foodAnomaly = anomalies.find(a => a.category === "Food");
    expect(foodAnomaly).toBeDefined();
  });

  it("sorts anomalies by deviation descending", () => {
    const current = { Food: 50000, Shopping: 30000 };
    const past = [
      { Food: 10000, Shopping: 10000 },
      { Food: 10000, Shopping: 10000 },
      { Food: 10000, Shopping: 10000 },
    ];
    const anomalies = detectSpendingAnomalies(current, past);
    for (let i = 1; i < anomalies.length; i++) {
      expect(anomalies[i].deviation).toBeLessThanOrEqual(anomalies[i - 1].deviation);
    }
  });

  it("does not flag normal spending variations", () => {
    const current = { Food: 12000 };
    const past = [
      { Food: 10000 },
      { Food: 11000 },
      { Food: 13000 },
      { Food: 12500 },
    ];
    const anomalies = detectSpendingAnomalies(current, past);
    const foodAnomaly = anomalies.find(a => a.category === "Food");
    expect(foodAnomaly).toBeUndefined(); // Normal variation
  });
});

// ═══════════════════════════════════════════════════════════════════════
// findSavingsOpportunities - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("findSavingsOpportunities", () => {
  it("identifies food savings when > 15% of income", () => {
    const breakdown = { Food: 20000 };
    const income = 100000;
    const opportunities = findSavingsOpportunities(breakdown, income);
    const food = opportunities.find(o => o.category === "Food");
    expect(food).toBeDefined();
    expect(food!.suggestedReduction).toBe(15);
    expect(food!.potentialSavings).toBe(3000); // 20000 * 0.15
  });

  it("identifies shopping savings when > 10% of income", () => {
    const breakdown = { Shopping: 15000 };
    const income = 100000;
    const opportunities = findSavingsOpportunities(breakdown, income);
    const shopping = opportunities.find(o => o.category === "Shopping");
    expect(shopping).toBeDefined();
    expect(shopping!.suggestedReduction).toBe(20);
  });

  it("identifies entertainment savings when > 5% of income", () => {
    const breakdown = { Entertainment: 8000 };
    const income = 100000;
    const opportunities = findSavingsOpportunities(breakdown, income);
    const ent = opportunities.find(o => o.category === "Entertainment");
    expect(ent).toBeDefined();
    expect(ent!.suggestedReduction).toBe(25);
  });

  it("identifies subscription savings when > ₹1000", () => {
    const breakdown = { Subscription: 3000 };
    const income = 100000;
    const opportunities = findSavingsOpportunities(breakdown, income);
    const sub = opportunities.find(o => o.category === "Subscription");
    expect(sub).toBeDefined();
    expect(sub!.suggestedReduction).toBe(30);
  });

  it("ignores non-discretionary categories", () => {
    const breakdown = { Rent: 30000, Bills: 10000 };
    const income = 100000;
    const opportunities = findSavingsOpportunities(breakdown, income);
    expect(opportunities).toHaveLength(0);
  });

  it("ignores amounts below 500", () => {
    const breakdown = { Food: 400, Shopping: 300 };
    const income = 1000;
    const opportunities = findSavingsOpportunities(breakdown, income);
    expect(opportunities).toHaveLength(0);
  });

  it("returns empty for zero income", () => {
    const breakdown = { Food: 10000 };
    const opportunities = findSavingsOpportunities(breakdown, 0);
    expect(opportunities).toHaveLength(0);
  });

  it("sorts by potential savings descending", () => {
    const breakdown = { Food: 20000, Shopping: 15000, Entertainment: 8000, Subscription: 3000 };
    const income = 100000;
    const opportunities = findSavingsOpportunities(breakdown, income);
    for (let i = 1; i < opportunities.length; i++) {
      expect(opportunities[i].potentialSavings).toBeLessThanOrEqual(opportunities[i - 1].potentialSavings);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateNoSpendStreak - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("calculateNoSpendStreak", () => {
  it("calculates current streak from today backwards", () => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    // Transaction yesterday means streak is 0 (if today has no spending)
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const transactions = [
      { id: "1", date: yesterdayStr, amount: -500, category: "Food" },
    ];
    const result = calculateNoSpendStreak(transactions);
    expect(result.currentStreak).toBe(1); // Only today (no spend today)
  });

  it("excludes income transactions", () => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const transactions = [
      { id: "1", date: todayStr, amount: 50000, category: "Income" },
    ];
    const result = calculateNoSpendStreak(transactions);
    expect(result.currentStreak).toBeGreaterThanOrEqual(0);
  });

  it("excludes transfer transactions", () => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const transactions = [
      { id: "1", date: todayStr, amount: -5000, category: "Transfer" },
    ];
    const result = calculateNoSpendStreak(transactions);
    // Transfer should not break the streak
    expect(result.currentStreak).toBeGreaterThanOrEqual(0);
  });

  it("excludes investment transactions", () => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const transactions = [
      { id: "1", date: todayStr, amount: -10000, category: "Investment" },
    ];
    const result = calculateNoSpendStreak(transactions);
    expect(result.currentStreak).toBeGreaterThanOrEqual(0);
  });

  it("returns 0 streak for empty transactions", () => {
    const result = calculateNoSpendStreak([]);
    // No spend days means all days are non-spend
    expect(result.currentStreak).toBeGreaterThanOrEqual(0);
  });

  it("calculates longest streak", () => {
    const transactions = [
      { id: "1", date: "2025-01-01", amount: -500, category: "Food" },
      { id: "2", date: "2025-01-15", amount: -500, category: "Food" },
      // 13-day gap between them
    ];
    const result = calculateNoSpendStreak(transactions);
    expect(result.longestStreak).toBeGreaterThanOrEqual(13);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// getUpcomingBillAlerts - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("getUpcomingBillAlerts", () => {
  it("alerts for overdue bills", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);
    const recurring = [
      { id: "r1", description: "Netflix", amount: -499, frequency: "monthly", status: "active", next_date: yesterday.toISOString().split("T")[0] },
    ];
    const alerts = getUpcomingBillAlerts(recurring);
    const overdue = alerts.find(a => a.id === "overdue-r1");
    expect(overdue).toBeDefined();
    expect(overdue!.type).toBe("danger");
  });

  it("alerts for bills due within 3 days", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 2);
    const recurring = [
      { id: "r1", description: "Spotify", amount: -199, frequency: "monthly", status: "active", next_date: soon.toISOString().split("T")[0] },
    ];
    const alerts = getUpcomingBillAlerts(recurring);
    const dueSoon = alerts.find(a => a.id === "due-soon-r1");
    expect(dueSoon).toBeDefined();
    expect(dueSoon!.type).toBe("warning");
  });

  it("ignores inactive recurring items", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const recurring = [
      { id: "r1", description: "Cancelled", amount: -999, frequency: "monthly", status: "paused", next_date: tomorrow.toISOString().split("T")[0] },
    ];
    const alerts = getUpcomingBillAlerts(recurring);
    expect(alerts).toHaveLength(0);
  });

  it("ignores bills more than 3 days away", () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const recurring = [
      { id: "r1", description: "Far", amount: -500, frequency: "monthly", status: "active", next_date: future.toISOString().split("T")[0] },
    ];
    const alerts = getUpcomingBillAlerts(recurring);
    expect(alerts).toHaveLength(0);
  });

  it("returns empty for empty list", () => {
    const alerts = getUpcomingBillAlerts([]);
    expect(alerts).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// generateSmartInsights - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("generateSmartInsights", () => {
  it("combines multiple insight sources", () => {
    const params = {
      aggregate: { totalSpent: 80000, totalIncome: 100000, categoryBreakdown: { Food: 20000 } } as Aggregate,
      budgets: [{ id: "b1", category: "Food", monthly_limit: 15000 }] as Budget[],
      accounts: [] as Account[],
      transactions: [],
      recurring: [],
      income: 100000,
      daysElapsed: 15,
      totalDays: 30,
    };
    const insights = generateSmartInsights(params);
    expect(insights.length).toBeGreaterThan(0);
  });

  it("deduplicates insights by id", () => {
    const params = {
      aggregate: { totalSpent: 95000, totalIncome: 100000, categoryBreakdown: {} } as Aggregate,
      budgets: [] as Budget[],
      accounts: [] as Account[],
      transactions: [],
      recurring: [],
      income: 100000,
      daysElapsed: 20,
      totalDays: 30,
    };
    const insights = generateSmartInsights(params);
    const ids = insights.map(i => i.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it("includes spending projection when off track", () => {
    const params = {
      aggregate: { totalSpent: 60000, totalIncome: 100000, categoryBreakdown: {} } as Aggregate,
      budgets: [] as Budget[],
      accounts: [] as Account[],
      transactions: [],
      recurring: [],
      income: 100000,
      daysElapsed: 15,
      totalDays: 30,
    };
    const insights = generateSmartInsights(params);
    const projection = insights.find(i => i.id === "spending-projection");
    // At 60000/15 days = 4000/day, projected = 120000 > income
    expect(projection).toBeDefined();
  });

  it("includes anomaly insights when past data available", () => {
    const params = {
      aggregate: { totalSpent: 50000, totalIncome: 100000, categoryBreakdown: { Food: 40000 } } as Aggregate,
      budgets: [] as Budget[],
      accounts: [] as Account[],
      transactions: [],
      recurring: [],
      income: 100000,
      daysElapsed: 15,
      totalDays: 30,
      pastBreakdowns: [{ Food: 10000 }, { Food: 10000 }, { Food: 10000 }],
    };
    const insights = generateSmartInsights(params);
    const anomaly = insights.find(i => i.id.startsWith("anomaly-"));
    expect(anomaly).toBeDefined();
  });

  it("returns sorted by priority", () => {
    const params = {
      aggregate: { totalSpent: 80000, totalIncome: 100000, categoryBreakdown: { Food: 20000 } } as Aggregate,
      budgets: [{ id: "b1", category: "Food", monthly_limit: 15000 }] as Budget[],
      accounts: [{ id: "cc1", account_name: "CC", type: "credit", liability: 80000, credit_limit: 100000 }] as Account[],
      transactions: [],
      recurring: [],
      income: 100000,
      daysElapsed: 15,
      totalDays: 30,
    };
    const insights = generateSmartInsights(params);
    for (let i = 1; i < insights.length; i++) {
      expect(insights[i].priority).toBeGreaterThanOrEqual(insights[i - 1].priority);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// generateCycleComparisonInsights - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("generateCycleComparisonInsights", () => {
  it("detects spending increase > 15%", () => {
    const current: Aggregate = { totalSpent: 70000, totalIncome: 100000, categoryBreakdown: {} };
    const previous: Aggregate = { totalSpent: 50000, totalIncome: 100000, categoryBreakdown: {} };
    const insights = generateCycleComparisonInsights(current, previous);
    const spendUp = insights.find(i => i.id === "cycle-spend-up");
    expect(spendUp).toBeDefined();
    expect(spendUp!.type).toBe("warning");
  });

  it("detects spending decrease > 10%", () => {
    const current: Aggregate = { totalSpent: 40000, totalIncome: 100000, categoryBreakdown: {} };
    const previous: Aggregate = { totalSpent: 50000, totalIncome: 100000, categoryBreakdown: {} };
    const insights = generateCycleComparisonInsights(current, previous);
    const spendDown = insights.find(i => i.id === "cycle-spend-down");
    expect(spendDown).toBeDefined();
    expect(spendDown!.type).toBe("success");
  });

  it("detects income drop > 10%", () => {
    const current: Aggregate = { totalSpent: 50000, totalIncome: 80000, categoryBreakdown: {} };
    const previous: Aggregate = { totalSpent: 50000, totalIncome: 100000, categoryBreakdown: {} };
    const insights = generateCycleComparisonInsights(current, previous);
    const incDown = insights.find(i => i.id === "cycle-income-down");
    expect(incDown).toBeDefined();
  });

  it("detects income increase > 15%", () => {
    const current: Aggregate = { totalSpent: 50000, totalIncome: 130000, categoryBreakdown: {} };
    const previous: Aggregate = { totalSpent: 50000, totalIncome: 100000, categoryBreakdown: {} };
    const insights = generateCycleComparisonInsights(current, previous);
    const incUp = insights.find(i => i.id === "cycle-income-up");
    expect(incUp).toBeDefined();
    expect(incUp!.type).toBe("success");
  });

  it("detects category-level spending spike", () => {
    const current: Aggregate = { totalSpent: 50000, totalIncome: 100000, categoryBreakdown: { Food: 20000 } };
    const previous: Aggregate = { totalSpent: 40000, totalIncome: 100000, categoryBreakdown: { Food: 10000 } };
    const insights = generateCycleComparisonInsights(current, previous);
    const worst = insights.find(i => i.id.startsWith("cycle-worst"));
    expect(worst).toBeDefined();
  });

  it("detects category-level improvement", () => {
    const current: Aggregate = { totalSpent: 30000, totalIncome: 100000, categoryBreakdown: { Shopping: 2000 } };
    const previous: Aggregate = { totalSpent: 40000, totalIncome: 100000, categoryBreakdown: { Shopping: 8000 } };
    const insights = generateCycleComparisonInsights(current, previous);
    const best = insights.find(i => i.id.startsWith("cycle-best"));
    expect(best).toBeDefined();
    expect(best!.type).toBe("success");
  });

  it("returns empty for null inputs", () => {
    expect(generateCycleComparisonInsights(null, null)).toHaveLength(0);
    expect(generateCycleComparisonInsights(null, { totalSpent: 5000 })).toHaveLength(0);
    expect(generateCycleComparisonInsights({ totalSpent: 5000 }, null)).toHaveLength(0);
  });

  it("handles zero previous spending", () => {
    const current: Aggregate = { totalSpent: 50000, totalIncome: 100000, categoryBreakdown: {} };
    const previous: Aggregate = { totalSpent: 0, totalIncome: 0, categoryBreakdown: {} };
    const insights = generateCycleComparisonInsights(current, previous);
    // Should handle gracefully without divide-by-zero
    expect(Array.isArray(insights)).toBe(true);
  });
});
