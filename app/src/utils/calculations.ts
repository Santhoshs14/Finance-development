/**
 * Financial Calculations Utility
 * Net worth, savings rate, budget usage, CC utilization,
 * investment P/L, XIRR, SIP growth, goal completion
 */

export interface Account {
  id: string;
  account_name: string;
  type: string;
  balance?: number;
  liability?: number;
  credit_limit?: number;
  shared_limit_with?: string;
}

export interface Investment {
  id: string;
  name: string;
  investment_type?: string;
  buy_price: number;
  current_price: number;
  quantity: number;
  current_value?: number;
  invested_amount?: number;
  value?: number;
  sip_amount?: number;
  linked_goal_id?: string | null;
  account_id?: string | null;
  scheme_code?: string;
  fund_house?: string;
  purity?: number;
  weight_grams?: number;
  form?: "digital" | "physical" | "sgb" | "etf";
  purchase_date?: string;
  making_charges?: number;
}

export interface LendingItem {
  id: string;
  type: "lent" | "borrowed";
  status: string;
  amount: number;
  paid_amount?: number;
}

export interface Budget {
  id: string;
  category: string;
  monthly_limit: number;
  is_investment_target?: boolean;
}

export interface Aggregate {
  totalSpent?: number;
  totalIncome?: number;
  totalInvestmentSpend?: number;
  categoryBreakdown?: Record<string, number>;
}

export interface Goal {
  id: string;
  goal_name: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
}

const r = (v: number) => Math.round(v * 100) / 100;

/**
 * Canonical classification of a transaction for aggregate / cash-flow math.
 *
 * `type` is the source of truth — it matches the live aggregate-increment path
 * in the transactions API. `category === "Income"` and the amount sign are
 * fallbacks only for legacy rows written before the `type` field existed.
 *
 * Internal movements (self-transfers and credit-card repayments) are excluded:
 * the live increment path never counts them, so neither should any recompute.
 * Using this everywhere keeps the dashboard, nightly rollup, and the manual
 * "Recalculate" actions in agreement.
 */
export type TxnClassification = "income" | "expense" | "skip";

export const classifyAggregateTxn = (t: {
  type?: string;
  amount?: number;
  category?: string;
  payment_type?: string;
}): TxnClassification => {
  const category = t.category ?? "";
  const paymentType = t.payment_type ?? "";
  if (
    category === "Transfer" ||
    category === "Credit Card Payment" ||
    paymentType === "Self Transfer" ||
    paymentType === "Transfer"
  ) {
    return "skip";
  }
  if (t.type === "income") return "income";
  if (t.type === "expense") return "expense";
  // Legacy fallback for rows without an explicit `type`.
  if (category === "Income") return "income";
  return (t.amount ?? 0) > 0 ? "income" : "expense";
};

export const calculateNetWorth = (
  accounts: Account[],
  investments: Investment[],
  lendingItems: LendingItem[] = []
) => {
  const bankAccounts = accounts.filter((a) => a.type !== "credit");
  const creditAccounts = accounts.filter((a) => a.type === "credit");

  const totalAccountBalance = bankAccounts.reduce(
    (sum, acc) => sum + (acc.balance || 0),
    0
  );
  const totalInvestmentValue = investments.reduce(
    (sum, inv) =>
      sum +
      (inv.current_price * inv.quantity ||
        inv.current_value ||
        inv.value ||
        0),
    0
  );

  const ccOutstanding = creditAccounts.reduce(
    (sum, cc) => sum + (cc.liability || 0),
    0
  );

  const lentAmount = lendingItems
    .filter((l) => l.type === "lent" && l.status !== "paid")
    .reduce((sum, l) => sum + ((l.amount || 0) - (l.paid_amount || 0)), 0);

  const borrowedAmount = lendingItems
    .filter((l) => l.type === "borrowed" && l.status !== "paid")
    .reduce((sum, l) => sum + ((l.amount || 0) - (l.paid_amount || 0)), 0);

  return {
    total_accounts: r(totalAccountBalance),
    total_investments: r(totalInvestmentValue),
    total_cc_outstanding: r(ccOutstanding),
    total_lent: r(lentAmount),
    total_borrowed: r(borrowedAmount),
    net_worth: r(
      totalAccountBalance +
        totalInvestmentValue +
        lentAmount -
        ccOutstanding -
        borrowedAmount
    ),
  };
};

export const calculateSavingsRateFromAggregates = (aggregate: Aggregate) => {
  const income = aggregate?.totalIncome || 0;
  const expenses = aggregate?.totalSpent || 0;
  const investmentSpend = aggregate?.totalInvestmentSpend || 0;
  if (income === 0) return { income, expenses, investmentSpend, savings: 0, savings_rate: 0 };
  // Investment spending is treated as savings (productive spend), not pure expense
  const effectiveExpenses = r(expenses - investmentSpend);
  const savings = r(income - effectiveExpenses);
  const savings_rate = parseFloat(((savings / income) * 100).toFixed(2));
  return { income, expenses, investmentSpend, savings, savings_rate };
};

export const calculateBudgetUsageFromAggregates = (
  budgets: Budget[],
  aggregate: Aggregate
) => {
  const categories = aggregate?.categoryBreakdown || {};
  return budgets.map((budget) => {
    const spent = categories[budget.category] || 0;
    const isInvestmentBudget = budget.is_investment_target || false;
    const usage_percentage =
      budget.monthly_limit > 0
        ? parseFloat(((spent / budget.monthly_limit) * 100).toFixed(2))
        : 0;
    const remaining = r(budget.monthly_limit - spent);
    return {
      category: budget.category,
      monthly_limit: budget.monthly_limit,
      spent: r(spent),
      remaining,
      usage_percentage,
      over_budget: !isInvestmentBudget && spent > budget.monthly_limit,
      // Investment budgets: over = exceeding target = GOOD
      is_investment_target: isInvestmentBudget,
      target_met: isInvestmentBudget && spent >= budget.monthly_limit,
    };
  });
};

export const calculateCCUtilization = (accounts: Account[]) => {
  const creditAccounts = accounts.filter((a) => a.type === "credit");
  return creditAccounts.map((card) => {
    let limit = card.credit_limit || 0;
    let outstanding = card.liability || 0;

    if (card.shared_limit_with) {
      const parent =
        creditAccounts.find((c) => c.id === card.shared_limit_with) || card;
      limit = parent.credit_limit || 0;
      outstanding = parent.liability || 0;
      const children = creditAccounts.filter(
        (c) => c.shared_limit_with === parent.id
      );
      children.forEach((c) => (outstanding += c.liability || 0));
    } else {
      const children = creditAccounts.filter(
        (c) => c.shared_limit_with === card.id
      );
      children.forEach((c) => (outstanding += c.liability || 0));
    }

    const utilization =
      limit > 0 ? parseFloat(((outstanding / limit) * 100).toFixed(2)) : 0;

    return {
      card_name: card.account_name,
      credit_limit: limit,
      outstanding,
      available: limit - outstanding,
      utilization_percentage: utilization,
      risk_warning: utilization > 30,
    };
  });
};

export const calculateInvestmentPL = (investments: Investment[]) => {
  return investments.map((inv) => {
    const invested =
      inv.buy_price * inv.quantity || inv.invested_amount || 0;
    const current =
      inv.current_price * inv.quantity || inv.current_value || inv.value || 0;
    const profit_loss = current - invested;
    const pl_percentage =
      invested > 0
        ? parseFloat(((profit_loss / invested) * 100).toFixed(2))
        : 0;

    return {
      name: inv.name,
      investment_type: inv.investment_type,
      invested: r(invested),
      current_value: r(current),
      profit_loss: r(profit_loss),
      pl_percentage,
    };
  });
};

export const calculatePortfolioAllocation = (
  accounts: Account[],
  investments: Investment[]
) => {
  const totals: Record<string, number> = {
    Equity: 0,
    Debt: 0,
    Gold: 0,
    Crypto: 0,
    Cash: 0,
  };

  accounts
    .filter((a) => a.type !== "credit")
    .forEach((acc) => {
      totals.Cash += acc.balance || 0;
    });

  investments.forEach((inv) => {
    const value =
      inv.current_price * inv.quantity || inv.current_value || inv.value || 0;
    const type = (inv.investment_type || "Equity").toLowerCase();

    if (type.includes("debt") || type.includes("bond")) totals.Debt += value;
    else if (type.includes("gold")) totals.Gold += value;
    else if (type.includes("crypto")) totals.Crypto += value;
    else totals.Equity += value;
  });

  const totalValue = Object.values(totals).reduce(
    (sum, val) => sum + val,
    0
  );
  if (totalValue === 0)
    return {
      totals,
      percentages: { Equity: 0, Debt: 0, Gold: 0, Crypto: 0, Cash: 0 },
      totalValue: 0,
    };

  const percentages = {
    Equity: parseFloat(((totals.Equity / totalValue) * 100).toFixed(2)),
    Debt: parseFloat(((totals.Debt / totalValue) * 100).toFixed(2)),
    Gold: parseFloat(((totals.Gold / totalValue) * 100).toFixed(2)),
    Crypto: parseFloat(((totals.Crypto / totalValue) * 100).toFixed(2)),
    Cash: parseFloat(((totals.Cash / totalValue) * 100).toFixed(2)),
  };
  return { totals, percentages, totalValue };
};

/**
 * Financial-health scoring — the single source of truth used by both the
 * dashboard gauge and the `/reports/health` page so they never diverge.
 *
 * Four pillars (max 100): Savings Rate (30), Debt Health (30),
 * Emergency Fund (20), Diversification (20). Returns the individual pillar
 * scores plus the underlying metrics needed to render advice.
 */
export interface HealthPillarScores {
  savings: number;
  debt: number;
  emergency: number;
  diversification: number;
  total: number;
  metrics: {
    savingsRate: number;
    totalDebt: number;
    totalAssets: number;
    debtRatio: number;
    monthlyExpenses: number;
    targetEmergencyFund: number;
    currentCash: number;
    emergencyMonths: number;
    maxNonCashAllocation: number;
    assetClasses: number;
  };
}

export const getHealthPillars = (
  savingsRateData: { savings_rate?: number; expenses?: number },
  netWorthData: {
    total_cc_outstanding?: number;
    total_accounts?: number;
    total_investments?: number;
  },
  portfolioData: { totals?: Record<string, number>; percentages?: Record<string, number> }
): HealthPillarScores => {
  // 1. Savings Rate (0-30)
  const savingsRate = savingsRateData.savings_rate || 0;
  const savings = Math.max(0, Math.min(30, Math.round((savingsRate / 20) * 30)));

  // 2. Debt Health (0-30)
  const totalDebt = netWorthData.total_cc_outstanding || 0;
  const totalAssets =
    (netWorthData.total_accounts || 0) + (netWorthData.total_investments || 0);
  const debtRatio =
    totalAssets > 0 ? totalDebt / totalAssets : totalDebt > 0 ? 1 : 0;
  const debt = Math.max(0, Math.round(30 - debtRatio * 60));

  // 3. Emergency Fund (0-20) — target 3 months of expenses
  const monthlyExpenses = savingsRateData.expenses || 0;
  const targetEmergencyFund = monthlyExpenses > 0 ? monthlyExpenses * 3 : 50000;
  const currentCash = portfolioData.totals?.Cash || 0;
  const emergency = Math.max(0, Math.min(20, Math.round((currentCash / targetEmergencyFund) * 20)));
  const emergencyMonths = monthlyExpenses > 0 ? currentCash / monthlyExpenses : 0;

  // 4. Diversification (0-20) — penalise over-concentration in one non-cash class
  const percentages = portfolioData.percentages || {};
  const maxNonCashAllocation = Math.max(
    percentages.Equity || 0,
    percentages.Debt || 0,
    percentages.Gold || 0,
    percentages.Crypto || 0
  );
  const diversification =
    totalAssets > 0
      ? maxNonCashAllocation < 80
        ? 20
        : Math.max(0, Math.round(100 - maxNonCashAllocation))
      : 0;
  const assetClasses = Object.values(percentages).filter((v) => v > 5).length;

  const total = Math.max(0, Math.min(100, savings + debt + emergency + diversification));

  return {
    savings,
    debt,
    emergency,
    diversification,
    total,
    metrics: {
      savingsRate,
      totalDebt,
      totalAssets,
      debtRatio,
      monthlyExpenses,
      targetEmergencyFund,
      currentCash,
      emergencyMonths,
      maxNonCashAllocation,
      assetClasses,
    },
  };
};

/** Overall financial-health score (0-100). Thin wrapper over getHealthPillars. */
export const calculateFinancialHealthScore = (
  savingsRateData: { savings_rate?: number; expenses?: number },
  netWorthData: {
    total_cc_outstanding?: number;
    total_accounts?: number;
    total_investments?: number;
  },
  _ccData: unknown,
  portfolioData: { totals?: Record<string, number>; percentages?: Record<string, number> }
) => getHealthPillars(savingsRateData, netWorthData, portfolioData).total;

/** Single rating scale (label + color) for a 0-100 health score. */
export const healthRating = (score: number): { label: string; color: string } => {
  if (score >= 80) return { label: "Excellent", color: "#10b981" };
  if (score >= 60) return { label: "Good", color: "#3b82f6" };
  if (score >= 40) return { label: "Fair", color: "#f59e0b" };
  return { label: "Needs Work", color: "#ef4444" };
};

interface Cashflow {
  date: string;
  amount: number;
}

export const calculateXIRR = (cashflows: Cashflow[]): number => {
  if (!cashflows || cashflows.length < 2) return 0;
  const hasPositive = cashflows.some((cf) => cf.amount > 0);
  const hasNegative = cashflows.some((cf) => cf.amount < 0);
  if (!hasPositive || !hasNegative) return 0;

  const daysInYear = 365.0;
  const f = (rate: number) => {
    let sum = 0;
    const d0 = new Date(cashflows[0].date);
    for (const cf of cashflows) {
      const d = new Date(cf.date);
      const years =
        (d.getTime() - d0.getTime()) / (daysInYear * 24 * 60 * 60 * 1000);
      sum += cf.amount / Math.pow(1 + rate, years);
    }
    return sum;
  };
  const df = (rate: number) => {
    let sum = 0;
    const d0 = new Date(cashflows[0].date);
    for (const cf of cashflows) {
      const d = new Date(cf.date);
      const years =
        (d.getTime() - d0.getTime()) / (daysInYear * 24 * 60 * 60 * 1000);
      if (years === 0) continue;
      sum -= (years * cf.amount) / Math.pow(1 + rate, years + 1);
    }
    return sum;
  };

  let rate = 0.1;
  for (let i = 0; i < 100; i++) {
    const fVal = f(rate);
    const dfVal = df(rate);
    if (Math.abs(dfVal) < 1e-10) break;
    const newRate = rate - fVal / dfVal;
    if (Math.abs(newRate - rate) < 1e-7) break;
    rate = newRate;
  }
  return parseFloat((rate * 100).toFixed(2));
};

export const calculateSIPGrowth = (
  monthlyAmount: number,
  annualReturnRate: number,
  years: number
) => {
  const months = years * 12;
  const monthlyRate = annualReturnRate / 12 / 100;

  if (monthlyRate === 0) {
    return {
      total_invested: monthlyAmount * months,
      estimated_value: monthlyAmount * months,
      estimated_returns: 0,
    };
  }

  const futureValue =
    monthlyAmount *
    ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) *
    (1 + monthlyRate);

  return {
    total_invested: monthlyAmount * months,
    estimated_value: parseFloat(futureValue.toFixed(2)),
    estimated_returns: parseFloat(
      (futureValue - monthlyAmount * months).toFixed(2)
    ),
  };
};

export const calculateGoalCompletion = (goal: Goal) => {
  const remaining = r(goal.target_amount - goal.current_amount);
  const progress =
    goal.target_amount > 0
      ? parseFloat(
          ((goal.current_amount / goal.target_amount) * 100).toFixed(2)
        )
      : 0;

  const deadline = new Date(goal.deadline);
  const now = new Date();
  const monthsRemaining = Math.max(
    0,
    (deadline.getFullYear() - now.getFullYear()) * 12 +
      (deadline.getMonth() - now.getMonth())
  );

  const monthlyRequired =
    monthsRemaining > 0
      ? parseFloat((remaining / monthsRemaining).toFixed(2))
      : remaining;

  return {
    goal_name: goal.goal_name,
    target_amount: goal.target_amount,
    current_amount: goal.current_amount,
    remaining,
    progress_percentage: progress,
    months_remaining: monthsRemaining,
    monthly_savings_required: monthlyRequired,
    on_track: monthlyRequired <= 0 || remaining <= 0,
  };
};

/**
 * Compute cycle summary metrics from an aggregate document.
 */
export const calculateCycleSummary = (
  aggregate: Aggregate | null,
  cycleInfo: { daysElapsed: number; totalDays?: number } | null
) => {
  const { totalSpent = 0, totalIncome = 0, categoryBreakdown = {} } =
    aggregate || {};
  const { daysElapsed = 1 } = cycleInfo || {};

  const topCategory =
    Object.entries(categoryBreakdown)
      .filter(([cat]) => cat !== "Income")
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  const dailyAvg = daysElapsed > 0 ? totalSpent / daysElapsed : 0;

  const savingsRate =
    totalIncome > 0
      ? parseFloat(
          (((totalIncome - totalSpent) / totalIncome) * 100).toFixed(1)
        )
      : 0;

  return {
    totalSpent: r(totalSpent),
    totalIncome: r(totalIncome),
    topCategory,
    dailyAvg: r(dailyAvg),
    savingsRate,
  };
};

/**
 * Budget forecast — predict whether a category will exceed its limit by cycle end.
 */
export const calculateBudgetForecast = (
  spent: number,
  limit: number,
  daysElapsed: number,
  totalDays: number
) => {
  const daysLeft = Math.max(0, totalDays - daysElapsed);
  const dailyAvg = daysElapsed > 0 ? spent / daysElapsed : 0;
  const projectedSpend = dailyAvg * totalDays;
  const willExceed = projectedSpend > limit && spent < limit;
  const remaining = Math.max(0, limit - spent);
  const safeDailyBudget = daysLeft > 0 ? remaining / daysLeft : 0;
  const overBy = Math.max(0, spent - limit);

  return {
    projectedSpend: r(projectedSpend),
    willExceed,
    dailyAvg: r(dailyAvg),
    safeDailyBudget: r(safeDailyBudget),
    overBy: r(overBy),
    daysLeft,
    remaining: r(remaining),
  };
};

/**
 * Credit card health assessment.
 */
export const calculateCreditCardHealth = (
  card: Account,
  allCards: Account[] = []
) => {
  let limit = parseFloat(String(card.credit_limit || 0));
  let outstanding = parseFloat(String(card.liability || 0));

  if (card.shared_limit_with) {
    const parent =
      allCards.find((c) => c.id === card.shared_limit_with) || card;
    limit = parseFloat(String(parent.credit_limit || 0));
    outstanding = parseFloat(String(parent.liability || 0));
    allCards
      .filter((c) => c.shared_limit_with === parent.id)
      .forEach((c) => {
        outstanding += parseFloat(String(c.liability || 0));
      });
  } else {
    allCards
      .filter((c) => c.shared_limit_with === card.id)
      .forEach((c) => {
        outstanding += parseFloat(String(c.liability || 0));
      });
  }

  const utilization =
    limit > 0 ? parseFloat(((outstanding / limit) * 100).toFixed(1)) : 0;

  let riskLevel: string, riskColor: string;
  if (utilization > 90) {
    riskLevel = "Critical";
    riskColor = "#ef4444";
  } else if (utilization > 60) {
    riskLevel = "Warning";
    riskColor = "#f97316";
  } else if (utilization > 30) {
    riskLevel = "Moderate";
    riskColor = "#f59e0b";
  } else {
    riskLevel = "Safe";
    riskColor = "#10b981";
  }

  const ideal30 = limit * 0.3;
  const idealPayment =
    outstanding > ideal30 ? r(outstanding - ideal30) : 0;

  let paymentAdvice = "";
  if (outstanding <= 0) {
    paymentAdvice = "All clear! No outstanding balance.";
  } else if (utilization <= 30) {
    paymentAdvice = `Utilization is healthy at ${utilization}%.`;
  } else {
    paymentAdvice = `Pay ₹${idealPayment.toLocaleString("en-IN")} to bring utilization below 30%.`;
  }

  return {
    utilization,
    riskLevel,
    riskColor,
    paymentAdvice,
    idealPayment,
    outstanding,
    limit,
  };
};

/**
 * Compare two cycle aggregates to generate trend data.
 */
export const compareCycles = (
  current: Aggregate | null,
  previous: Aggregate | null
) => {
  const curr = current || { totalSpent: 0, totalIncome: 0, categoryBreakdown: {} };
  const prev = previous || { totalSpent: 0, totalIncome: 0, categoryBreakdown: {} };

  const spendingChange = (curr.totalSpent || 0) - (prev.totalSpent || 0);
  const incomeChange = (curr.totalIncome || 0) - (prev.totalIncome || 0);

  const spendingPctChange =
    (prev.totalSpent || 0) > 0
      ? parseFloat(((spendingChange / prev.totalSpent!) * 100).toFixed(1))
      : (curr.totalSpent || 0) > 0
        ? 100
        : 0;

  const incomePctChange =
    (prev.totalIncome || 0) > 0
      ? parseFloat(((incomeChange / prev.totalIncome!) * 100).toFixed(1))
      : (curr.totalIncome || 0) > 0
        ? 100
        : 0;

  const allCats = new Set([
    ...Object.keys(curr.categoryBreakdown || {}),
    ...Object.keys(prev.categoryBreakdown || {}),
  ]);

  const categoryChanges: Record<
    string,
    { current: number; previous: number; change: number; pctChange: number }
  > = {};

  allCats.forEach((cat) => {
    const c = (curr.categoryBreakdown || {})[cat] || 0;
    const p = (prev.categoryBreakdown || {})[cat] || 0;
    const change = c - p;
    const pctChange = p > 0 ? parseFloat(((change / p) * 100).toFixed(1)) : c > 0 ? 100 : 0;
    categoryChanges[cat] = { current: c, previous: p, change, pctChange };
  });

  return {
    spendingChange: r(spendingChange),
    incomeChange: r(incomeChange),
    spendingPctChange,
    incomePctChange,
    categoryChanges,
  };
};

// ─── Recurring Transaction Detection ─────────────────────────────

export interface RecurringPattern {
  key: string;
  category: string;
  description: string;
  avgAmount: number;
  frequency: "monthly" | "weekly" | "yearly" | "irregular";
  avgIntervalDays: number;
  occurrences: number;
  lastDate: string;
  nextExpectedDate: string;
}

export const detectRecurringTransactions = (
  transactions: { date: string; amount: number; category: string; notes?: string; payment_type?: string }[]
): RecurringPattern[] => {
  // Group by normalized key: category + rough amount bucket
  const groups: Record<string, typeof transactions> = {};

  transactions
    .filter((t) => t.amount < 0 && t.category !== "Transfer" && t.payment_type !== "Self Transfer")
    .forEach((t) => {
      const amtBucket = Math.round(Math.abs(t.amount) / 50) * 50;
      const key = `${t.category}|${amtBucket}|${(t.notes || "").toLowerCase().trim().slice(0, 20)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });

  const patterns: RecurringPattern[] = [];

  for (const [key, txns] of Object.entries(groups)) {
    if (txns.length < 2) continue;

    // Sort by date ascending
    const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date));

    // Calculate intervals between occurrences
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const d1 = new Date(sorted[i - 1].date + "T00:00:00").getTime();
      const d2 = new Date(sorted[i].date + "T00:00:00").getTime();
      intervals.push(Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
    }

    if (intervals.length === 0) continue;

    const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;
    const avgAmount = sorted.reduce((s, t) => s + Math.abs(t.amount), 0) / sorted.length;

    // Classify frequency
    let frequency: RecurringPattern["frequency"] = "irregular";
    if (avgInterval >= 25 && avgInterval <= 35) frequency = "monthly";
    else if (avgInterval >= 5 && avgInterval <= 9) frequency = "weekly";
    else if (avgInterval >= 350 && avgInterval <= 380) frequency = "yearly";

    // Only include if it looks recurring (not irregular or has 3+ occurrences)
    if (frequency === "irregular" && sorted.length < 4) continue;

    const lastDate = sorted[sorted.length - 1].date;
    const nextMs = new Date(lastDate + "T00:00:00").getTime() + avgInterval * 24 * 60 * 60 * 1000;
    const nextExpectedDate = new Date(nextMs).toISOString().slice(0, 10);

    patterns.push({
      key,
      category: sorted[0].category,
      description: sorted[0].notes || sorted[0].category,
      avgAmount: Math.round(avgAmount),
      frequency,
      avgIntervalDays: Math.round(avgInterval),
      occurrences: sorted.length,
      lastDate,
      nextExpectedDate,
    });
  }

  return patterns.sort((a, b) => b.avgAmount - a.avgAmount);
};

// ─── Gold Investment Utilities ─────────────────────────────────────

export const GOLD_FORMS = {
  digital: { label: "Digital Gold", icon: "Smartphone" },
  physical: { label: "Physical Gold", icon: "Package" },
  sgb: { label: "Sovereign Gold Bond", icon: "Landmark" },
  etf: { label: "Gold ETF", icon: "BarChart3" },
} as const;

export const GOLD_PURITY_MAP: Record<number, { label: string; multiplier: number }> = {
  24: { label: "24K (999)", multiplier: 1.0 },
  22: { label: "22K (916)", multiplier: 22 / 24 },
  18: { label: "18K (750)", multiplier: 18 / 24 },
};

export const calculateGoldValue = (
  weightGrams: number,
  purity: number,
  pricePerGram24K: number
) => {
  const multiplier = (GOLD_PURITY_MAP[purity]?.multiplier) || (purity / 24);
  const value = weightGrams * pricePerGram24K * multiplier;
  return r(value);
};

export const calculateGoldReturns = (
  buyPricePerGram: number,
  currentPricePerGram: number,
  weightGrams: number,
  makingCharges: number = 0
) => {
  const invested = r(buyPricePerGram * weightGrams + makingCharges);
  const currentValue = r(currentPricePerGram * weightGrams);
  const profitLoss = r(currentValue - invested);
  const plPercentage = invested > 0
    ? parseFloat(((profitLoss / invested) * 100).toFixed(2))
    : 0;

  return {
    invested,
    currentValue,
    profitLoss,
    plPercentage,
    effectiveBuyPrice: weightGrams > 0 ? r(invested / weightGrams) : 0,
  };
};
