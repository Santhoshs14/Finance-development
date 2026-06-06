import { describe, it, expect } from "vitest";
import {
  calculateNetWorth,
  calculateSavingsRateFromAggregates,
  calculateBudgetUsageFromAggregates,
  calculateCCUtilization,
  calculateInvestmentPL,
  calculatePortfolioAllocation,
  calculateFinancialHealthScore,
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
  GOLD_PURITY_MAP,
  type Account,
  type Investment,
  type LendingItem,
  type Budget,
  type Aggregate,
  type Goal,
} from "@/utils/calculations";

// ═══════════════════════════════════════════════════════════════════════
// calculateNetWorth - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("calculateNetWorth", () => {
  describe("Basic calculations", () => {
    it("calculates net worth with bank accounts only", () => {
      const accounts: Account[] = [
        { id: "1", account_name: "Savings", type: "savings", balance: 50000 },
        { id: "2", account_name: "Current", type: "current", balance: 25000 },
      ];
      const result = calculateNetWorth(accounts, [], []);
      expect(result.total_accounts).toBe(75000);
      expect(result.total_investments).toBe(0);
      expect(result.total_cc_outstanding).toBe(0);
      expect(result.net_worth).toBe(75000);
    });

    it("calculates net worth with investments only", () => {
      const investments: Investment[] = [
        { id: "i1", name: "MF A", buy_price: 100, current_price: 150, quantity: 10 },
        { id: "i2", name: "MF B", buy_price: 200, current_price: 250, quantity: 5 },
      ];
      const result = calculateNetWorth([], investments, []);
      expect(result.total_investments).toBe(2750); // 1500 + 1250
      expect(result.net_worth).toBe(2750);
    });

    it("subtracts credit card liabilities", () => {
      const accounts: Account[] = [
        { id: "1", account_name: "Savings", type: "savings", balance: 100000 },
        { id: "2", account_name: "CC1", type: "credit", liability: 15000, credit_limit: 200000 },
        { id: "3", account_name: "CC2", type: "credit", liability: 5000, credit_limit: 100000 },
      ];
      const result = calculateNetWorth(accounts, [], []);
      expect(result.total_cc_outstanding).toBe(20000);
      expect(result.net_worth).toBe(80000); // 100000 - 20000
    });

    it("handles lending items (lent vs borrowed)", () => {
      const accounts: Account[] = [
        { id: "1", account_name: "Savings", type: "savings", balance: 50000 },
      ];
      const lending: LendingItem[] = [
        { id: "l1", type: "lent", status: "pending", amount: 10000, paid_amount: 3000 },
        { id: "l2", type: "borrowed", status: "pending", amount: 8000, paid_amount: 2000 },
      ];
      const result = calculateNetWorth(accounts, [], lending);
      expect(result.total_lent).toBe(7000); // 10000 - 3000
      expect(result.total_borrowed).toBe(6000); // 8000 - 2000
      expect(result.net_worth).toBe(50000 + 7000 - 6000); // 51000
    });

    it("ignores paid lending items", () => {
      const lending: LendingItem[] = [
        { id: "l1", type: "lent", status: "paid", amount: 5000, paid_amount: 5000 },
        { id: "l2", type: "borrowed", status: "paid", amount: 3000, paid_amount: 3000 },
      ];
      const result = calculateNetWorth([], [], lending);
      expect(result.total_lent).toBe(0);
      expect(result.total_borrowed).toBe(0);
      expect(result.net_worth).toBe(0);
    });
  });

  describe("Edge cases", () => {
    it("handles empty arrays", () => {
      const result = calculateNetWorth([], [], []);
      expect(result.net_worth).toBe(0);
      expect(result.total_accounts).toBe(0);
      expect(result.total_investments).toBe(0);
    });

    it("handles accounts with zero/undefined balance", () => {
      const accounts: Account[] = [
        { id: "1", account_name: "Empty", type: "savings", balance: 0 },
        { id: "2", account_name: "Undef", type: "savings" },
      ];
      const result = calculateNetWorth(accounts, [], []);
      expect(result.total_accounts).toBe(0);
    });

    it("handles investments with current_value fallback", () => {
      const investments: Investment[] = [
        { id: "i1", name: "Fund", buy_price: 0, current_price: 0, quantity: 0, current_value: 5000 },
      ];
      const result = calculateNetWorth([], investments, []);
      expect(result.total_investments).toBe(5000);
    });

    it("handles investments with value fallback", () => {
      const investments: Investment[] = [
        { id: "i1", name: "Fund", buy_price: 0, current_price: 0, quantity: 0, value: 3000 },
      ];
      const result = calculateNetWorth([], investments, []);
      expect(result.total_investments).toBe(3000);
    });

    it("handles negative net worth", () => {
      const accounts: Account[] = [
        { id: "1", account_name: "Savings", type: "savings", balance: 5000 },
        { id: "2", account_name: "CC", type: "credit", liability: 50000, credit_limit: 100000 },
      ];
      const result = calculateNetWorth(accounts, [], []);
      expect(result.net_worth).toBe(-45000);
    });

    it("rounds to 2 decimal places", () => {
      const accounts: Account[] = [
        { id: "1", account_name: "Savings", type: "savings", balance: 33.333 },
      ];
      const result = calculateNetWorth(accounts, [], []);
      expect(result.total_accounts).toBe(33.33);
    });

    it("handles lending with no paid_amount", () => {
      const lending: LendingItem[] = [
        { id: "l1", type: "lent", status: "pending", amount: 5000 },
      ];
      const result = calculateNetWorth([], [], lending);
      expect(result.total_lent).toBe(5000);
    });

    it("handles large numbers correctly", () => {
      const accounts: Account[] = [
        { id: "1", account_name: "Savings", type: "savings", balance: 10000000 },
      ];
      const investments: Investment[] = [
        { id: "i1", name: "Stocks", buy_price: 1000, current_price: 1500, quantity: 1000 },
      ];
      const result = calculateNetWorth(accounts, investments, []);
      expect(result.net_worth).toBe(11500000);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateSavingsRateFromAggregates - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("calculateSavingsRateFromAggregates", () => {
  it("calculates correct savings rate with normal values", () => {
    const result = calculateSavingsRateFromAggregates({
      totalIncome: 100000,
      totalSpent: 60000,
    });
    expect(result.income).toBe(100000);
    expect(result.expenses).toBe(60000);
    expect(result.savings).toBe(40000);
    expect(result.savings_rate).toBe(40);
  });

  it("returns zero rate when income is zero", () => {
    const result = calculateSavingsRateFromAggregates({ totalIncome: 0, totalSpent: 5000 });
    expect(result.savings_rate).toBe(0);
    expect(result.savings).toBe(0);
  });

  it("handles negative savings (overspending)", () => {
    const result = calculateSavingsRateFromAggregates({
      totalIncome: 50000,
      totalSpent: 70000,
    });
    expect(result.savings).toBe(-20000);
    expect(result.savings_rate).toBe(-40);
  });

  it("handles undefined values in aggregate", () => {
    const result = calculateSavingsRateFromAggregates({});
    expect(result.income).toBe(0);
    expect(result.expenses).toBe(0);
    expect(result.savings).toBe(0);
    expect(result.savings_rate).toBe(0);
  });

  it("returns 100% rate when no spending", () => {
    const result = calculateSavingsRateFromAggregates({
      totalIncome: 50000,
      totalSpent: 0,
    });
    expect(result.savings_rate).toBe(100);
    expect(result.savings).toBe(50000);
  });

  it("handles decimal values correctly", () => {
    const result = calculateSavingsRateFromAggregates({
      totalIncome: 75000.50,
      totalSpent: 45000.30,
    });
    expect(result.savings).toBe(30000.2);
    expect(result.savings_rate).toBeCloseTo(40, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateBudgetUsageFromAggregates - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("calculateBudgetUsageFromAggregates", () => {
  it("calculates usage for multiple categories", () => {
    const budgets: Budget[] = [
      { id: "b1", category: "Food", monthly_limit: 10000 },
      { id: "b2", category: "Transport", monthly_limit: 5000 },
      { id: "b3", category: "Shopping", monthly_limit: 8000 },
    ];
    const aggregate: Aggregate = {
      totalSpent: 20000,
      categoryBreakdown: { Food: 8000, Transport: 3000, Shopping: 9000 },
    };
    const result = calculateBudgetUsageFromAggregates(budgets, aggregate);
    expect(result).toHaveLength(3);
    
    expect(result[0].category).toBe("Food");
    expect(result[0].spent).toBe(8000);
    expect(result[0].usage_percentage).toBe(80);
    expect(result[0].remaining).toBe(2000);
    expect(result[0].over_budget).toBe(false);

    expect(result[2].category).toBe("Shopping");
    expect(result[2].spent).toBe(9000);
    expect(result[2].over_budget).toBe(true);
    expect(result[2].remaining).toBe(-1000);
  });

  it("handles category with zero spending", () => {
    const budgets: Budget[] = [
      { id: "b1", category: "Food", monthly_limit: 10000 },
    ];
    const aggregate: Aggregate = { categoryBreakdown: {} };
    const result = calculateBudgetUsageFromAggregates(budgets, aggregate);
    expect(result[0].spent).toBe(0);
    expect(result[0].usage_percentage).toBe(0);
    expect(result[0].remaining).toBe(10000);
  });

  it("handles zero budget limit", () => {
    const budgets: Budget[] = [
      { id: "b1", category: "Food", monthly_limit: 0 },
    ];
    const aggregate: Aggregate = { categoryBreakdown: { Food: 5000 } };
    const result = calculateBudgetUsageFromAggregates(budgets, aggregate);
    expect(result[0].usage_percentage).toBe(0);
  });

  it("handles empty budgets array", () => {
    const result = calculateBudgetUsageFromAggregates([], { categoryBreakdown: { Food: 5000 } });
    expect(result).toHaveLength(0);
  });

  it("handles undefined categoryBreakdown", () => {
    const budgets: Budget[] = [
      { id: "b1", category: "Food", monthly_limit: 10000 },
    ];
    const result = calculateBudgetUsageFromAggregates(budgets, {});
    expect(result[0].spent).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateCCUtilization - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("calculateCCUtilization", () => {
  it("calculates utilization for single card", () => {
    const accounts: Account[] = [
      { id: "cc1", account_name: "HDFC CC", type: "credit", liability: 30000, credit_limit: 100000 },
    ];
    const result = calculateCCUtilization(accounts);
    expect(result).toHaveLength(1);
    expect(result[0].card_name).toBe("HDFC CC");
    expect(result[0].utilization_percentage).toBe(30);
    expect(result[0].outstanding).toBe(30000);
    expect(result[0].available).toBe(70000);
    expect(result[0].risk_warning).toBe(false);
  });

  it("flags high utilization (>30%)", () => {
    const accounts: Account[] = [
      { id: "cc1", account_name: "High CC", type: "credit", liability: 50000, credit_limit: 100000 },
    ];
    const result = calculateCCUtilization(accounts);
    expect(result[0].utilization_percentage).toBe(50);
    expect(result[0].risk_warning).toBe(true);
  });

  it("handles shared credit limit (parent-child)", () => {
    const accounts: Account[] = [
      { id: "cc1", account_name: "Primary", type: "credit", liability: 20000, credit_limit: 200000 },
      { id: "cc2", account_name: "Add-on", type: "credit", liability: 10000, credit_limit: 0, shared_limit_with: "cc1" },
    ];
    const result = calculateCCUtilization(accounts);
    // Primary card should include child's liability
    const primary = result.find(r => r.card_name === "Primary");
    expect(primary!.outstanding).toBe(30000); // 20000 + 10000
    expect(primary!.credit_limit).toBe(200000);
  });

  it("handles zero credit limit", () => {
    const accounts: Account[] = [
      { id: "cc1", account_name: "No Limit", type: "credit", liability: 5000, credit_limit: 0 },
    ];
    const result = calculateCCUtilization(accounts);
    expect(result[0].utilization_percentage).toBe(0);
  });

  it("ignores non-credit accounts", () => {
    const accounts: Account[] = [
      { id: "1", account_name: "Savings", type: "savings", balance: 50000 },
      { id: "cc1", account_name: "CC", type: "credit", liability: 5000, credit_limit: 50000 },
    ];
    const result = calculateCCUtilization(accounts);
    expect(result).toHaveLength(1);
    expect(result[0].card_name).toBe("CC");
  });

  it("handles empty accounts", () => {
    const result = calculateCCUtilization([]);
    expect(result).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateInvestmentPL - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("calculateInvestmentPL", () => {
  it("calculates profit for appreciation", () => {
    const investments: Investment[] = [
      { id: "i1", name: "Stocks", buy_price: 100, current_price: 150, quantity: 10 },
    ];
    const result = calculateInvestmentPL(investments);
    expect(result[0].invested).toBe(1000);
    expect(result[0].current_value).toBe(1500);
    expect(result[0].profit_loss).toBe(500);
    expect(result[0].pl_percentage).toBe(50);
  });

  it("calculates loss for depreciation", () => {
    const investments: Investment[] = [
      { id: "i1", name: "Stocks", buy_price: 200, current_price: 150, quantity: 5 },
    ];
    const result = calculateInvestmentPL(investments);
    expect(result[0].invested).toBe(1000);
    expect(result[0].current_value).toBe(750);
    expect(result[0].profit_loss).toBe(-250);
    expect(result[0].pl_percentage).toBe(-25);
  });

  it("handles invested_amount fallback", () => {
    const investments: Investment[] = [
      { id: "i1", name: "Fund", buy_price: 0, current_price: 0, quantity: 0, invested_amount: 10000, current_value: 12000 },
    ];
    const result = calculateInvestmentPL(investments);
    expect(result[0].invested).toBe(10000);
    expect(result[0].current_value).toBe(12000);
    expect(result[0].profit_loss).toBe(2000);
  });

  it("handles zero investment", () => {
    const investments: Investment[] = [
      { id: "i1", name: "Free", buy_price: 0, current_price: 100, quantity: 0 },
    ];
    const result = calculateInvestmentPL(investments);
    expect(result[0].invested).toBe(0);
    expect(result[0].pl_percentage).toBe(0);
  });

  it("handles multiple investments", () => {
    const investments: Investment[] = [
      { id: "i1", name: "A", buy_price: 100, current_price: 120, quantity: 10 },
      { id: "i2", name: "B", buy_price: 50, current_price: 40, quantity: 20 },
    ];
    const result = calculateInvestmentPL(investments);
    expect(result).toHaveLength(2);
    expect(result[0].profit_loss).toBe(200);
    expect(result[1].profit_loss).toBe(-200);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// calculatePortfolioAllocation - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("calculatePortfolioAllocation", () => {
  it("categorizes investments by type", () => {
    const accounts: Account[] = [
      { id: "1", account_name: "Savings", type: "savings", balance: 50000 },
    ];
    const investments: Investment[] = [
      { id: "i1", name: "Equity Fund", investment_type: "Equity", buy_price: 100, current_price: 100, quantity: 100 },
      { id: "i2", name: "Debt Fund", investment_type: "Debt", buy_price: 100, current_price: 100, quantity: 50 },
      { id: "i3", name: "Gold ETF", investment_type: "Gold", buy_price: 100, current_price: 100, quantity: 30 },
    ];
    const result = calculatePortfolioAllocation(accounts, investments);
    expect(result.totals.Equity).toBe(10000);
    expect(result.totals.Debt).toBe(5000);
    expect(result.totals.Gold).toBe(3000);
    expect(result.totals.Cash).toBe(50000);
    expect(result.totalValue).toBe(68000);
  });

  it("handles crypto type", () => {
    const investments: Investment[] = [
      { id: "i1", name: "BTC", investment_type: "Crypto", buy_price: 1000, current_price: 2000, quantity: 1 },
    ];
    const result = calculatePortfolioAllocation([], investments);
    expect(result.totals.Crypto).toBe(2000);
  });

  it("returns zero percentages for empty portfolio", () => {
    const result = calculatePortfolioAllocation([], []);
    expect(result.totalValue).toBe(0);
    expect(result.percentages.Equity).toBe(0);
    expect(result.percentages.Cash).toBe(0);
  });

  it("excludes credit accounts from cash", () => {
    const accounts: Account[] = [
      { id: "1", account_name: "Savings", type: "savings", balance: 50000 },
      { id: "2", account_name: "CC", type: "credit", liability: 10000, credit_limit: 100000 },
    ];
    const result = calculatePortfolioAllocation(accounts, []);
    expect(result.totals.Cash).toBe(50000);
  });

  it("calculates correct percentages", () => {
    const accounts: Account[] = [
      { id: "1", account_name: "Savings", type: "savings", balance: 50000 },
    ];
    const investments: Investment[] = [
      { id: "i1", name: "EQ", investment_type: "Equity", buy_price: 100, current_price: 100, quantity: 500 },
    ];
    const result = calculatePortfolioAllocation(accounts, investments);
    // Total = 50000 + 50000 = 100000
    expect(result.percentages.Cash).toBe(50);
    expect(result.percentages.Equity).toBe(50);
  });

  it("defaults unknown types to Equity", () => {
    const investments: Investment[] = [
      { id: "i1", name: "Unknown", investment_type: "RealEstate", buy_price: 100, current_price: 200, quantity: 10 },
    ];
    const result = calculatePortfolioAllocation([], investments);
    expect(result.totals.Equity).toBe(2000);
  });

  it("handles bond type as Debt", () => {
    const investments: Investment[] = [
      { id: "i1", name: "Bond Fund", investment_type: "Corporate Bond", buy_price: 100, current_price: 105, quantity: 10 },
    ];
    const result = calculatePortfolioAllocation([], investments);
    expect(result.totals.Debt).toBe(1050);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateFinancialHealthScore - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("calculateFinancialHealthScore", () => {
  it("returns max score for excellent finances", () => {
    const score = calculateFinancialHealthScore(
      { savings_rate: 40, expenses: 30000 },
      { total_cc_outstanding: 0, total_accounts: 500000, total_investments: 500000 },
      null,
      { totals: { Cash: 200000, Equity: 300000, Debt: 100000, Gold: 50000, Crypto: 50000 }, percentages: { Cash: 28.6, Equity: 42.9, Debt: 14.3, Gold: 7.1, Crypto: 7.1 } }
    );
    expect(score).toBeGreaterThanOrEqual(80);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("returns low score for poor finances", () => {
    const score = calculateFinancialHealthScore(
      { savings_rate: 2, expenses: 90000 },
      { total_cc_outstanding: 200000, total_accounts: 10000, total_investments: 0 },
      null,
      { totals: { Cash: 10000, Equity: 0, Debt: 0, Gold: 0, Crypto: 0 }, percentages: { Cash: 100, Equity: 0, Debt: 0, Gold: 0, Crypto: 0 } }
    );
    expect(score).toBeLessThan(30);
  });

  it("caps score at 100", () => {
    const score = calculateFinancialHealthScore(
      { savings_rate: 50, expenses: 10000 },
      { total_cc_outstanding: 0, total_accounts: 1000000, total_investments: 1000000 },
      null,
      { totals: { Cash: 500000, Equity: 400000, Debt: 300000, Gold: 200000, Crypto: 100000 }, percentages: { Cash: 33.3, Equity: 26.7, Debt: 20, Gold: 13.3, Crypto: 6.7 } }
    );
    expect(score).toBeLessThanOrEqual(100);
  });

  it("returns 0 minimum", () => {
    const score = calculateFinancialHealthScore(
      { savings_rate: -50, expenses: 0 },
      { total_cc_outstanding: 1000000, total_accounts: 0, total_investments: 0 },
      null,
      { totals: {}, percentages: {} }
    );
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("rewards diversification", () => {
    const diversified = calculateFinancialHealthScore(
      { savings_rate: 20, expenses: 50000 },
      { total_cc_outstanding: 0, total_accounts: 200000, total_investments: 200000 },
      null,
      { totals: { Cash: 100000, Equity: 100000, Debt: 100000, Gold: 50000, Crypto: 50000 }, percentages: { Cash: 25, Equity: 25, Debt: 25, Gold: 12.5, Crypto: 12.5 } }
    );

    const concentrated = calculateFinancialHealthScore(
      { savings_rate: 20, expenses: 50000 },
      { total_cc_outstanding: 0, total_accounts: 200000, total_investments: 200000 },
      null,
      { totals: { Cash: 0, Equity: 400000, Debt: 0, Gold: 0, Crypto: 0 }, percentages: { Cash: 0, Equity: 100, Debt: 0, Gold: 0, Crypto: 0 } }
    );

    expect(diversified).toBeGreaterThan(concentrated);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateXIRR - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("calculateXIRR", () => {
  it("calculates positive return for investment growth", () => {
    const cashflows = [
      { date: "2024-01-01", amount: -10000 },
      { date: "2025-01-01", amount: 11000 },
    ];
    const result = calculateXIRR(cashflows);
    expect(result).toBeCloseTo(10, 0); // ~10% annual return
  });

  it("returns 0 for empty cashflows", () => {
    expect(calculateXIRR([])).toBe(0);
  });

  it("returns 0 for single cashflow", () => {
    expect(calculateXIRR([{ date: "2024-01-01", amount: -10000 }])).toBe(0);
  });

  it("returns 0 if all cashflows are positive", () => {
    const cashflows = [
      { date: "2024-01-01", amount: 1000 },
      { date: "2024-06-01", amount: 2000 },
    ];
    expect(calculateXIRR(cashflows)).toBe(0);
  });

  it("returns 0 if all cashflows are negative", () => {
    const cashflows = [
      { date: "2024-01-01", amount: -1000 },
      { date: "2024-06-01", amount: -2000 },
    ];
    expect(calculateXIRR(cashflows)).toBe(0);
  });

  it("handles multiple investments and returns", () => {
    const cashflows = [
      { date: "2024-01-01", amount: -5000 },
      { date: "2024-04-01", amount: -5000 },
      { date: "2024-07-01", amount: -5000 },
      { date: "2025-01-01", amount: 16500 },
    ];
    const result = calculateXIRR(cashflows);
    expect(result).toBeGreaterThan(0); // Should be positive return
  });

  it("handles loss scenario", () => {
    const cashflows = [
      { date: "2024-01-01", amount: -10000 },
      { date: "2025-01-01", amount: 8000 },
    ];
    const result = calculateXIRR(cashflows);
    expect(result).toBeLessThan(0); // Negative return
  });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateSIPGrowth - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("calculateSIPGrowth", () => {
  it("calculates basic SIP growth", () => {
    const result = calculateSIPGrowth(5000, 12, 10);
    expect(result.total_invested).toBe(600000); // 5000 * 120 months
    expect(result.estimated_value).toBeGreaterThan(600000);
    expect(result.estimated_returns).toBeGreaterThan(0);
  });

  it("handles zero return rate", () => {
    const result = calculateSIPGrowth(5000, 0, 10);
    expect(result.total_invested).toBe(600000);
    expect(result.estimated_value).toBe(600000);
    expect(result.estimated_returns).toBe(0);
  });

  it("handles short duration (1 year)", () => {
    const result = calculateSIPGrowth(10000, 12, 1);
    expect(result.total_invested).toBe(120000);
    expect(result.estimated_value).toBeGreaterThan(120000);
  });

  it("handles high return rate", () => {
    const result = calculateSIPGrowth(5000, 24, 5);
    expect(result.estimated_value).toBeGreaterThan(result.total_invested * 1.5);
  });

  it("handles zero monthly amount", () => {
    const result = calculateSIPGrowth(0, 12, 10);
    expect(result.total_invested).toBe(0);
    expect(result.estimated_value).toBe(0);
    expect(result.estimated_returns).toBe(0);
  });

  it("returns correct invested amount", () => {
    const result = calculateSIPGrowth(1000, 10, 5);
    expect(result.total_invested).toBe(60000); // 1000 * 60 months
  });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateGoalCompletion - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("calculateGoalCompletion", () => {
  it("calculates progress for partial completion", () => {
    const goal: Goal = {
      id: "g1",
      goal_name: "Emergency Fund",
      target_amount: 100000,
      current_amount: 40000,
      deadline: "2026-12-31",
    };
    const result = calculateGoalCompletion(goal);
    expect(result.goal_name).toBe("Emergency Fund");
    expect(result.remaining).toBe(60000);
    expect(result.progress_percentage).toBe(40);
    expect(result.months_remaining).toBeGreaterThan(0);
    expect(result.monthly_savings_required).toBeGreaterThan(0);
  });

  it("handles completed goal", () => {
    const goal: Goal = {
      id: "g1",
      goal_name: "Done Goal",
      target_amount: 50000,
      current_amount: 50000,
      deadline: "2026-12-31",
    };
    const result = calculateGoalCompletion(goal);
    expect(result.remaining).toBe(0);
    expect(result.progress_percentage).toBe(100);
    expect(result.on_track).toBe(true);
  });

  it("handles over-funded goal", () => {
    const goal: Goal = {
      id: "g1",
      goal_name: "Over Goal",
      target_amount: 50000,
      current_amount: 60000,
      deadline: "2026-12-31",
    };
    const result = calculateGoalCompletion(goal);
    expect(result.remaining).toBe(-10000);
    expect(result.progress_percentage).toBe(120);
    expect(result.on_track).toBe(true);
  });

  it("handles past deadline", () => {
    const goal: Goal = {
      id: "g1",
      goal_name: "Past Goal",
      target_amount: 100000,
      current_amount: 30000,
      deadline: "2020-01-01",
    };
    const result = calculateGoalCompletion(goal);
    expect(result.months_remaining).toBe(0);
    expect(result.monthly_savings_required).toBe(70000); // All remaining at once
  });

  it("handles zero target amount", () => {
    const goal: Goal = {
      id: "g1",
      goal_name: "Zero Goal",
      target_amount: 0,
      current_amount: 0,
      deadline: "2026-12-31",
    };
    const result = calculateGoalCompletion(goal);
    expect(result.progress_percentage).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateCycleSummary - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("calculateCycleSummary", () => {
  it("calculates basic cycle summary", () => {
    const aggregate: Aggregate = {
      totalSpent: 45000,
      totalIncome: 100000,
      categoryBreakdown: { Food: 15000, Transport: 8000, Shopping: 12000, Entertainment: 10000 },
    };
    const result = calculateCycleSummary(aggregate, { daysElapsed: 15 });
    expect(result.totalSpent).toBe(45000);
    expect(result.totalIncome).toBe(100000);
    expect(result.topCategory).toBe("Food");
    expect(result.dailyAvg).toBe(3000); // 45000/15
    expect(result.savingsRate).toBe(55); // (100000-45000)/100000 * 100
  });

  it("handles null aggregate", () => {
    const result = calculateCycleSummary(null, { daysElapsed: 10 });
    expect(result.totalSpent).toBe(0);
    expect(result.totalIncome).toBe(0);
    expect(result.topCategory).toBe("—");
    expect(result.dailyAvg).toBe(0);
  });

  it("handles null cycleInfo", () => {
    const aggregate: Aggregate = { totalSpent: 10000, totalIncome: 50000 };
    const result = calculateCycleSummary(aggregate, null);
    expect(result.dailyAvg).toBe(10000); // daysElapsed defaults to 1
  });

  it("excludes Income from top category", () => {
    const aggregate: Aggregate = {
      totalSpent: 5000,
      totalIncome: 100000,
      categoryBreakdown: { Income: 100000, Food: 5000 },
    };
    const result = calculateCycleSummary(aggregate, { daysElapsed: 10 });
    expect(result.topCategory).toBe("Food");
  });

  it("handles zero income for savings rate", () => {
    const aggregate: Aggregate = { totalSpent: 5000, totalIncome: 0, categoryBreakdown: {} };
    const result = calculateCycleSummary(aggregate, { daysElapsed: 10 });
    expect(result.savingsRate).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateBudgetForecast - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("calculateBudgetForecast", () => {
  it("predicts budget will be exceeded", () => {
    const result = calculateBudgetForecast(8000, 10000, 15, 30);
    expect(result.projectedSpend).toBeCloseTo(16000, 0);
    expect(result.willExceed).toBe(true);
    expect(result.dailyAvg).toBeCloseTo(533.33, 0);
  });

  it("predicts budget will NOT be exceeded", () => {
    const result = calculateBudgetForecast(3000, 10000, 15, 30);
    expect(result.projectedSpend).toBeCloseTo(6000, 0);
    expect(result.willExceed).toBe(false);
  });

  it("handles already over-budget (willExceed should be false)", () => {
    const result = calculateBudgetForecast(12000, 10000, 15, 30);
    expect(result.willExceed).toBe(false); // Already exceeded
    expect(result.overBy).toBe(2000);
  });

  it("handles zero days elapsed", () => {
    const result = calculateBudgetForecast(0, 10000, 0, 30);
    expect(result.dailyAvg).toBe(0);
    expect(result.projectedSpend).toBe(0);
  });

  it("calculates safe daily budget", () => {
    const result = calculateBudgetForecast(4000, 10000, 10, 30);
    expect(result.remaining).toBe(6000);
    expect(result.daysLeft).toBe(20);
    expect(result.safeDailyBudget).toBe(300); // 6000/20
  });

  it("handles cycle end (no days left)", () => {
    const result = calculateBudgetForecast(9000, 10000, 30, 30);
    expect(result.daysLeft).toBe(0);
    expect(result.safeDailyBudget).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateCreditCardHealth - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("calculateCreditCardHealth", () => {
  it("returns Safe risk level for low utilization", () => {
    const card: Account = { id: "cc1", account_name: "CC1", type: "credit", liability: 10000, credit_limit: 100000 };
    const result = calculateCreditCardHealth(card);
    expect(result.utilization).toBe(10);
    expect(result.riskLevel).toBe("Safe");
    expect(result.riskColor).toBe("#10b981");
  });

  it("returns Moderate risk level for 30-60% utilization", () => {
    const card: Account = { id: "cc1", account_name: "CC1", type: "credit", liability: 40000, credit_limit: 100000 };
    const result = calculateCreditCardHealth(card);
    expect(result.riskLevel).toBe("Moderate");
    expect(result.riskColor).toBe("#f59e0b");
  });

  it("returns Warning risk level for 60-90% utilization", () => {
    const card: Account = { id: "cc1", account_name: "CC1", type: "credit", liability: 70000, credit_limit: 100000 };
    const result = calculateCreditCardHealth(card);
    expect(result.riskLevel).toBe("Warning");
    expect(result.riskColor).toBe("#f97316");
  });

  it("returns Critical risk level for >90% utilization", () => {
    const card: Account = { id: "cc1", account_name: "CC1", type: "credit", liability: 95000, credit_limit: 100000 };
    const result = calculateCreditCardHealth(card);
    expect(result.riskLevel).toBe("Critical");
    expect(result.riskColor).toBe("#ef4444");
  });

  it("calculates ideal payment to bring below 30%", () => {
    const card: Account = { id: "cc1", account_name: "CC1", type: "credit", liability: 60000, credit_limit: 100000 };
    const result = calculateCreditCardHealth(card);
    expect(result.idealPayment).toBe(30000); // 60000 - 30000 (30% of 100000)
  });

  it("handles zero outstanding", () => {
    const card: Account = { id: "cc1", account_name: "CC1", type: "credit", liability: 0, credit_limit: 100000 };
    const result = calculateCreditCardHealth(card);
    expect(result.paymentAdvice).toContain("All clear");
  });

  it("handles shared limits", () => {
    const parent: Account = { id: "cc1", account_name: "Primary", type: "credit", liability: 20000, credit_limit: 200000 };
    const child: Account = { id: "cc2", account_name: "Add-on", type: "credit", liability: 10000, credit_limit: 0, shared_limit_with: "cc1" };
    const result = calculateCreditCardHealth(child, [parent, child]);
    expect(result.limit).toBe(200000);
    expect(result.outstanding).toBe(30000); // parent + child
  });
});

// ═══════════════════════════════════════════════════════════════════════
// compareCycles - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("compareCycles", () => {
  it("compares spending between cycles", () => {
    const current: Aggregate = { totalSpent: 60000, totalIncome: 100000, categoryBreakdown: { Food: 20000 } };
    const previous: Aggregate = { totalSpent: 50000, totalIncome: 90000, categoryBreakdown: { Food: 15000 } };
    const result = compareCycles(current, previous);
    expect(result.spendingChange).toBe(10000);
    expect(result.spendingPctChange).toBe(20);
    expect(result.incomeChange).toBeCloseTo(10000);
    expect(result.categoryChanges.Food.change).toBe(5000);
  });

  it("handles null current aggregate", () => {
    const previous: Aggregate = { totalSpent: 50000, totalIncome: 90000, categoryBreakdown: {} };
    const result = compareCycles(null, previous);
    expect(result.spendingChange).toBe(-50000);
  });

  it("handles null previous aggregate", () => {
    const current: Aggregate = { totalSpent: 60000, totalIncome: 100000, categoryBreakdown: {} };
    const result = compareCycles(current, null);
    expect(result.spendingPctChange).toBe(100); // 100% increase from 0
  });

  it("handles both null aggregates", () => {
    const result = compareCycles(null, null);
    expect(result.spendingChange).toBe(0);
    expect(result.incomeChange).toBe(0);
  });

  it("tracks new categories", () => {
    const current: Aggregate = { totalSpent: 5000, categoryBreakdown: { NewCat: 5000 } };
    const previous: Aggregate = { totalSpent: 0, categoryBreakdown: {} };
    const result = compareCycles(current, previous);
    expect(result.categoryChanges.NewCat.current).toBe(5000);
    expect(result.categoryChanges.NewCat.previous).toBe(0);
    expect(result.categoryChanges.NewCat.pctChange).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// detectRecurringTransactions - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("detectRecurringTransactions", () => {
  it("detects monthly recurring transactions", () => {
    const transactions = [
      { date: "2025-01-05", amount: -499, category: "Subscription", notes: "Netflix" },
      { date: "2025-02-05", amount: -499, category: "Subscription", notes: "Netflix" },
      { date: "2025-03-05", amount: -499, category: "Subscription", notes: "Netflix" },
    ];
    const result = detectRecurringTransactions(transactions);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const netflix = result.find(r => r.description.toLowerCase().includes("netflix"));
    if (netflix) {
      expect(netflix.frequency).toBe("monthly");
      expect(netflix.occurrences).toBe(3);
    }
  });

  it("ignores positive (income) transactions", () => {
    const transactions = [
      { date: "2025-01-01", amount: 50000, category: "Income", notes: "Salary" },
      { date: "2025-02-01", amount: 50000, category: "Income", notes: "Salary" },
      { date: "2025-03-01", amount: 50000, category: "Income", notes: "Salary" },
    ];
    const result = detectRecurringTransactions(transactions);
    expect(result).toHaveLength(0);
  });

  it("ignores Transfer category", () => {
    const transactions = [
      { date: "2025-01-01", amount: -5000, category: "Transfer", notes: "To savings" },
      { date: "2025-02-01", amount: -5000, category: "Transfer", notes: "To savings" },
      { date: "2025-03-01", amount: -5000, category: "Transfer", notes: "To savings" },
    ];
    const result = detectRecurringTransactions(transactions);
    expect(result).toHaveLength(0);
  });

  it("ignores Self Transfer payment type", () => {
    const transactions = [
      { date: "2025-01-01", amount: -5000, category: "Food", notes: "Test", payment_type: "Self Transfer" },
      { date: "2025-02-01", amount: -5000, category: "Food", notes: "Test", payment_type: "Self Transfer" },
      { date: "2025-03-01", amount: -5000, category: "Food", notes: "Test", payment_type: "Self Transfer" },
    ];
    const result = detectRecurringTransactions(transactions);
    expect(result).toHaveLength(0);
  });

  it("returns empty for less than 2 transactions in a group", () => {
    const transactions = [
      { date: "2025-01-05", amount: -499, category: "Subscription", notes: "Netflix" },
    ];
    const result = detectRecurringTransactions(transactions);
    expect(result).toHaveLength(0);
  });

  it("sorts results by amount descending", () => {
    const transactions = [
      { date: "2025-01-01", amount: -200, category: "Subscription", notes: "Small sub" },
      { date: "2025-02-01", amount: -200, category: "Subscription", notes: "Small sub" },
      { date: "2025-03-01", amount: -200, category: "Subscription", notes: "Small sub" },
      { date: "2025-01-01", amount: -2000, category: "Bills", notes: "Electricity" },
      { date: "2025-02-01", amount: -2000, category: "Bills", notes: "Electricity" },
      { date: "2025-03-01", amount: -2000, category: "Bills", notes: "Electricity" },
    ];
    const result = detectRecurringTransactions(transactions);
    if (result.length >= 2) {
      expect(result[0].avgAmount).toBeGreaterThanOrEqual(result[1].avgAmount);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateGoldValue - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("calculateGoldValue", () => {
  it("calculates 24K gold value", () => {
    const result = calculateGoldValue(10, 24, 6000);
    expect(result).toBe(60000); // 10 * 6000 * 1.0
  });

  it("calculates 22K gold value", () => {
    const result = calculateGoldValue(10, 22, 6000);
    expect(result).toBe(55000); // 10 * 6000 * (22/24)
  });

  it("calculates 18K gold value", () => {
    const result = calculateGoldValue(10, 18, 6000);
    expect(result).toBe(45000); // 10 * 6000 * (18/24)
  });

  it("handles custom purity not in map", () => {
    const result = calculateGoldValue(10, 14, 6000);
    expect(result).toBeCloseTo(35000, 0); // 10 * 6000 * (14/24)
  });

  it("handles zero weight", () => {
    const result = calculateGoldValue(0, 24, 6000);
    expect(result).toBe(0);
  });

  it("handles zero price", () => {
    const result = calculateGoldValue(10, 24, 0);
    expect(result).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateGoldReturns - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("calculateGoldReturns", () => {
  it("calculates profit on gold appreciation", () => {
    const result = calculateGoldReturns(5000, 6000, 10, 0);
    expect(result.invested).toBe(50000);
    expect(result.currentValue).toBe(60000);
    expect(result.profitLoss).toBe(10000);
    expect(result.plPercentage).toBe(20);
  });

  it("includes making charges in invested amount", () => {
    const result = calculateGoldReturns(5000, 6000, 10, 2000);
    expect(result.invested).toBe(52000); // 50000 + 2000
    expect(result.currentValue).toBe(60000);
    expect(result.profitLoss).toBe(8000);
  });

  it("calculates effective buy price", () => {
    const result = calculateGoldReturns(5000, 6000, 10, 2000);
    expect(result.effectiveBuyPrice).toBe(5200); // 52000/10
  });

  it("handles zero weight", () => {
    const result = calculateGoldReturns(5000, 6000, 0, 0);
    expect(result.invested).toBe(0);
    expect(result.currentValue).toBe(0);
    expect(result.effectiveBuyPrice).toBe(0);
  });

  it("handles loss scenario", () => {
    const result = calculateGoldReturns(6000, 5000, 10, 1000);
    expect(result.invested).toBe(61000);
    expect(result.currentValue).toBe(50000);
    expect(result.profitLoss).toBe(-11000);
    expect(result.plPercentage).toBeLessThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// GOLD_PURITY_MAP - Tests
// ═══════════════════════════════════════════════════════════════════════

describe("GOLD_PURITY_MAP", () => {
  it("has correct multiplier for 24K", () => {
    expect(GOLD_PURITY_MAP[24].multiplier).toBe(1.0);
  });

  it("has correct multiplier for 22K", () => {
    expect(GOLD_PURITY_MAP[22].multiplier).toBeCloseTo(22 / 24);
  });

  it("has correct multiplier for 18K", () => {
    expect(GOLD_PURITY_MAP[18].multiplier).toBeCloseTo(18 / 24);
  });

  it("has correct labels", () => {
    expect(GOLD_PURITY_MAP[24].label).toBe("24K (999)");
    expect(GOLD_PURITY_MAP[22].label).toBe("22K (916)");
    expect(GOLD_PURITY_MAP[18].label).toBe("18K (750)");
  });
});
