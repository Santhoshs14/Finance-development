/**
 * insights.ts
 * Centralized pure functions for generating financial insights locally.
 * Includes: spending prediction, anomaly detection, savings opportunities, streaks.
 */

import { calculateCCUtilization, type Account, type Budget, type Aggregate } from "./calculations";

export interface Insight {
  id: string;
  type: "success" | "warning" | "danger" | "info";
  priority: number; // 1 = highest
  title: string;
  message: string;
  actionLabel?: string;
  actionPath?: string;
}

interface Transaction {
  id: string;
  date: string;
  amount: number;
  category: string;
  payment_type?: string;
  notes?: string;
  description?: string;
}

interface RecurringItem {
  id: string;
  description: string;
  amount: number;
  frequency: string;
  status: string;
  next_date: string;
}

// ─── Main Insights Generator ────────────────────────────────────

export const generateInsightsFromAggregates = (
  aggregate: Aggregate,
  budgets: Budget[],
  accounts: Account[],
  actualSavingsRate?: number
): Insight[] => {
  const insights: Insight[] = [];
  if (!aggregate) return insights;

  const { totalSpent = 0, totalIncome = 0, categoryBreakdown = {} } = aggregate;
  const totalInvestmentSpend = (aggregate as { totalInvestmentSpend?: number }).totalInvestmentSpend || 0;

  // 0. Investment Contribution (positive insight)
  if (totalInvestmentSpend > 0 && totalIncome > 0) {
    const investPercent = ((totalInvestmentSpend / totalIncome) * 100).toFixed(1);
    insights.push({
      id: "investment-contribution",
      type: "success",
      priority: 4,
      title: "Investment This Month",
      message: `You invested ₹${totalInvestmentSpend.toLocaleString("en-IN")} (${investPercent}% of income). This counts toward your savings!`,
      actionLabel: "View Portfolio",
      actionPath: "/wealth/portfolio",
    });
  }

  // 1. Savings Rate Anomaly
  if (actualSavingsRate !== undefined) {
    if (actualSavingsRate > 0 && actualSavingsRate < 10) {
      insights.push({
        id: "low-savings",
        type: "warning",
        priority: 2,
        title: "Low Savings Rate",
        message: `Your savings rate is currently ${actualSavingsRate.toFixed(1)}%. Try to keep it above 20%.`,
        actionLabel: "View Budgets",
        actionPath: "/spending/budgets",
      });
    } else if (actualSavingsRate > 40) {
      insights.push({
        id: "great-savings",
        type: "success",
        priority: 5,
        title: "Excellent Savings Rate",
        message: `You are saving ${actualSavingsRate.toFixed(1)}% of your income (including investments)! Keep it up!`,
      });
    }
  } else if (totalIncome > 0) {
    // Use investment-aware savings rate
    const effectiveExpenses = totalSpent - totalInvestmentSpend;
    const savingsRate = ((totalIncome - effectiveExpenses) / totalIncome) * 100;
    if (savingsRate < 10) {
      insights.push({
        id: "low-savings",
        type: "warning",
        priority: 2,
        title: "Low Savings Rate",
        message: `Your savings rate is currently ${savingsRate.toFixed(1)}%. Try to keep it above 20%.`,
        actionLabel: "View Budgets",
        actionPath: "/spending/budgets",
      });
    } else if (savingsRate > 40) {
      insights.push({
        id: "great-savings",
        type: "success",
        priority: 5,
        title: "Excellent Savings Rate",
        message: `You are saving ${savingsRate.toFixed(1)}% of your income (including investments)! Keep it up!`,
      });
    }
  }

  // 2. Budget Warnings
  if (budgets && budgets.length > 0) {
    let warnCount = 0;
    budgets.forEach((b) => {
      const spent = categoryBreakdown[b.category] || 0;
      if (b.monthly_limit > 0) {
        if (spent > b.monthly_limit) {
          insights.push({
            id: `budget-exceeded-${b.category}`,
            type: "danger",
            priority: 1,
            title: "Budget Exceeded",
            message: `You have exceeded your ${b.category} budget by ₹${(spent - b.monthly_limit).toLocaleString("en-IN")}.`,
            actionLabel: "View Budgets",
            actionPath: "/spending/budgets",
          });
        } else if (spent >= b.monthly_limit * 0.8) {
          warnCount++;
        }
      }
    });

    if (warnCount > 0) {
      insights.push({
        id: "budget-approaching",
        type: "warning",
        priority: 3,
        title: "Approaching Budget Limits",
        message: `${warnCount} categor${warnCount > 1 ? "ies are" : "y is"} nearing the limit. Check your budgets.`,
        actionLabel: "View Budgets",
        actionPath: "/spending/budgets",
      });
    }
  }

  // 3. Credit Card Utilization
  if (accounts) {
    const ccMetrics = calculateCCUtilization(accounts);
    ccMetrics.forEach((cc) => {
      if (cc.utilization_percentage > 30) {
        insights.push({
          id: `cc-util-${cc.card_name}`,
          type: "warning",
          priority: 2,
          title: "High Credit Utilization",
          message: `${cc.card_name} is at ${cc.utilization_percentage.toFixed(1)}% utilization. Keep it below 30% for a healthy credit score.`,
          actionLabel: "View Cards",
          actionPath: "/credit/statements",
        });
      }
    });
  }

  return insights.sort((a, b) => a.priority - b.priority);
};

// ─── Spending Prediction ────────────────────────────────────────

export function predictEndOfCycleSpending(
  currentSpent: number,
  daysElapsed: number,
  totalDays: number,
  income: number,
  investmentSpend: number = 0
): { projectedTotal: number; projectedSavings: number; dailyVelocity: number; onTrack: boolean } {
  if (daysElapsed === 0) return { projectedTotal: 0, projectedSavings: income, dailyVelocity: 0, onTrack: true };

  // Exclude investment spending from "real" expense velocity (it's productive)
  const effectiveSpent = currentSpent - investmentSpend;
  const dailyVelocity = effectiveSpent / daysElapsed;
  const projectedTotal = dailyVelocity * totalDays;
  const projectedSavings = income - projectedTotal;
  const onTrack = projectedSavings >= income * 0.2; // 20% savings target

  return { projectedTotal, projectedSavings, dailyVelocity, onTrack };
}

// ─── Anomaly Detection ──────────────────────────────────────────

export interface SpendingAnomaly {
  category: string;
  currentAmount: number;
  averageAmount: number;
  deviation: number; // multiples of std deviation
  type: "spike" | "unusual";
}

export function detectSpendingAnomalies(
  currentBreakdown: Record<string, number>,
  pastBreakdowns: Record<string, number>[]
): SpendingAnomaly[] {
  if (pastBreakdowns.length < 2) return [];

  const anomalies: SpendingAnomaly[] = [];

  for (const [category, currentAmount] of Object.entries(currentBreakdown)) {
    if (category === "Income" || category === "Transfer" || category === "Credit Card Payment") continue;

    const pastAmounts = pastBreakdowns.map((b) => b[category] || 0).filter((a) => a > 0);
    if (pastAmounts.length < 2) continue;

    const avg = pastAmounts.reduce((s, a) => s + a, 0) / pastAmounts.length;
    const variance = pastAmounts.reduce((s, a) => s + Math.pow(a - avg, 2), 0) / pastAmounts.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) {
      if (currentAmount > avg * 1.5 && currentAmount > 500) {
        anomalies.push({ category, currentAmount, averageAmount: avg, deviation: 2, type: "spike" });
      }
      continue;
    }

    const zScore = (currentAmount - avg) / stdDev;

    if (zScore > 2 && currentAmount > 500) {
      anomalies.push({
        category,
        currentAmount,
        averageAmount: Math.round(avg),
        deviation: parseFloat(zScore.toFixed(1)),
        type: zScore > 3 ? "spike" : "unusual",
      });
    }
  }

  return anomalies.sort((a, b) => b.deviation - a.deviation);
}

// ─── Savings Opportunities ──────────────────────────────────────

export interface SavingsOpportunity {
  category: string;
  currentSpend: number;
  suggestedReduction: number; // percentage
  potentialSavings: number; // monthly amount
  message: string;
}

export function findSavingsOpportunities(
  breakdown: Record<string, number>,
  income: number
): SavingsOpportunity[] {
  if (income === 0) return [];
  const opportunities: SavingsOpportunity[] = [];
  const discretionary = ["Food", "Shopping", "Entertainment", "Subscription"];

  for (const [category, amount] of Object.entries(breakdown)) {
    if (!discretionary.includes(category) || amount < 500) continue;

    const percentOfIncome = (amount / income) * 100;

    if (percentOfIncome > 15 && category === "Food") {
      const savings = Math.round(amount * 0.15);
      opportunities.push({
        category,
        currentSpend: amount,
        suggestedReduction: 15,
        potentialSavings: savings,
        message: `Reduce ${category} by 15% to save ₹${savings.toLocaleString("en-IN")}/month`,
      });
    } else if (percentOfIncome > 10 && category === "Shopping") {
      const savings = Math.round(amount * 0.2);
      opportunities.push({
        category,
        currentSpend: amount,
        suggestedReduction: 20,
        potentialSavings: savings,
        message: `Cut ${category} by 20% to save ₹${savings.toLocaleString("en-IN")}/month`,
      });
    } else if (percentOfIncome > 5 && category === "Entertainment") {
      const savings = Math.round(amount * 0.25);
      opportunities.push({
        category,
        currentSpend: amount,
        suggestedReduction: 25,
        potentialSavings: savings,
        message: `Reduce ${category} by 25% to save ₹${savings.toLocaleString("en-IN")}/month`,
      });
    } else if (category === "Subscription" && amount > 1000) {
      const savings = Math.round(amount * 0.3);
      opportunities.push({
        category,
        currentSpend: amount,
        suggestedReduction: 30,
        potentialSavings: savings,
        message: `Review subscriptions — cancel unused ones to save ₹${savings.toLocaleString("en-IN")}/month`,
      });
    }
  }

  return opportunities.sort((a, b) => b.potentialSavings - a.potentialSavings);
}

// ─── Spending Streak ────────────────────────────────────────────

export function calculateNoSpendStreak(
  transactions: Transaction[],
  excludeCategories = ["Income", "Transfer", "Credit Card Payment", "Investment"]
): { currentStreak: number; longestStreak: number } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Format a local Date as YYYY-MM-DD without timezone surprises (was a bug
  // when running in non-UTC timezones — toISOString() on local midnight
  // returned the previous day in UTC).
  const toLocalDateStr = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // Get spending days in last 60 days
  const spendDays = new Set<string>();
  transactions.forEach((t) => {
    if (t.amount < 0 && !excludeCategories.includes(t.category) && !t.payment_type?.includes("Transfer")) {
      spendDays.add(t.date);
    }
  });

  // Calculate current streak (consecutive days with no unnecessary spending from today backwards)
  let currentStreak = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = toLocalDateStr(d);
    if (!spendDays.has(dateStr)) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Calculate longest streak in the data
  const sortedDates = Array.from(spendDays).sort();
  let longestStreak = currentStreak;
  if (sortedDates.length >= 2) {
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1] + "T00:00:00");
      const curr = new Date(sortedDates[i] + "T00:00:00");
      const gap = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)) - 1;
      if (gap > longestStreak) longestStreak = gap;
    }
  }

  return { currentStreak, longestStreak };
}

// ─── Bill Due Alerts ────────────────────────────────────────────

export function getUpcomingBillAlerts(
  recurring: RecurringItem[]
): Insight[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const insights: Insight[] = [];

  const active = recurring.filter((r) => r.status === "active");

  for (const item of active) {
    const dueDate = new Date(item.next_date + "T00:00:00");
    const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) {
      insights.push({
        id: `overdue-${item.id}`,
        type: "danger",
        priority: 1,
        title: "Overdue Bill",
        message: `${item.description} was due ${Math.abs(daysUntil)} day(s) ago — ₹${Math.abs(item.amount).toLocaleString("en-IN")}`,
        actionLabel: "View Recurring",
        actionPath: "/money/recurring",
      });
    } else if (daysUntil <= 3) {
      insights.push({
        id: `due-soon-${item.id}`,
        type: "warning",
        priority: 2,
        title: "Bill Due Soon",
        message: `${item.description} is due in ${daysUntil} day(s) — ₹${Math.abs(item.amount).toLocaleString("en-IN")}`,
        actionLabel: "View Recurring",
        actionPath: "/money/recurring",
      });
    }
  }

  return insights;
}

// ─── Combined Smart Insights ────────────────────────────────────

export function generateSmartInsights(params: {
  aggregate: Aggregate;
  budgets: Budget[];
  accounts: Account[];
  transactions: Transaction[];
  recurring: RecurringItem[];
  income: number;
  daysElapsed: number;
  totalDays: number;
  pastBreakdowns?: Record<string, number>[];
  savingsRate?: number;
}): Insight[] {
  const {
    aggregate,
    budgets,
    accounts,
    transactions,
    recurring,
    income,
    daysElapsed,
    totalDays,
    pastBreakdowns,
    savingsRate,
  } = params;

  const allInsights: Insight[] = [];

  // Base insights
  allInsights.push(...generateInsightsFromAggregates(aggregate, budgets, accounts, savingsRate));

  // Spending prediction
  const prediction = predictEndOfCycleSpending(
    aggregate?.totalSpent || 0,
    daysElapsed,
    totalDays,
    income,
    (aggregate as { totalInvestmentSpend?: number })?.totalInvestmentSpend || 0
  );

  if (daysElapsed >= 5 && !prediction.onTrack && income > 0) {
    allInsights.push({
      id: "spending-projection",
      type: "warning",
      priority: 2,
      title: "Spending Projection",
      message: `At current pace, you'll spend ₹${Math.round(prediction.projectedTotal).toLocaleString("en-IN")} this cycle — leaving only ${((prediction.projectedSavings / income) * 100).toFixed(0)}% savings.`,
      actionLabel: "View Cash Flow",
      actionPath: "/money/cash-flow",
    });
  } else if (daysElapsed >= 5 && prediction.onTrack && income > 0 && prediction.projectedSavings > income * 0.3) {
    allInsights.push({
      id: "spending-on-track",
      type: "success",
      priority: 5,
      title: "On Track",
      message: `Projected savings of ₹${Math.round(prediction.projectedSavings).toLocaleString("en-IN")} (${((prediction.projectedSavings / income) * 100).toFixed(0)}%) this cycle!`,
    });
  }

  // Anomaly detection
  if (pastBreakdowns && pastBreakdowns.length >= 2 && aggregate?.categoryBreakdown) {
    const anomalies = detectSpendingAnomalies(aggregate.categoryBreakdown, pastBreakdowns);
    anomalies.slice(0, 2).forEach((a) => {
      allInsights.push({
        id: `anomaly-${a.category}`,
        type: a.type === "spike" ? "danger" : "warning",
        priority: a.type === "spike" ? 1 : 3,
        title: `${a.category} Spike`,
        message: `${a.category} spending is ${a.deviation.toFixed(1)}x above normal (₹${a.currentAmount.toLocaleString("en-IN")} vs avg ₹${a.averageAmount.toLocaleString("en-IN")}).`,
        actionLabel: "View Analytics",
        actionPath: "/spending/analytics",
      });
    });
  }

  // Savings opportunities
  if (aggregate?.categoryBreakdown && income > 0) {
    const opportunities = findSavingsOpportunities(aggregate.categoryBreakdown, income);
    if (opportunities.length > 0) {
      const top = opportunities[0];
      allInsights.push({
        id: `savings-opp-${top.category}`,
        type: "info",
        priority: 4,
        title: "Savings Opportunity",
        message: top.message,
        actionLabel: "View Budgets",
        actionPath: "/spending/budgets",
      });
    }
  }

  // Bill alerts
  allInsights.push(...getUpcomingBillAlerts(recurring));

  // No-spend streak
  if (transactions.length > 0) {
    const streak = calculateNoSpendStreak(transactions);
    if (streak.currentStreak >= 2) {
      allInsights.push({
        id: "no-spend-streak",
        type: "success",
        priority: 5,
        title: "No-Spend Streak",
        message: `${streak.currentStreak} day no-spend streak! ${streak.longestStreak > streak.currentStreak ? `Record: ${streak.longestStreak} days.` : "New record!"}`,
      });
    }
  }

  // Deduplicate by id and sort by priority
  const seen = new Set<string>();
  return allInsights
    .filter((i) => { if (seen.has(i.id)) return false; seen.add(i.id); return true; })
    .sort((a, b) => a.priority - b.priority);
}


/**
 * Generate cycle-over-cycle comparison insights.
 */
export const generateCycleComparisonInsights = (
  current: Aggregate | null,
  previous: Aggregate | null
): Insight[] => {
  const insights: Insight[] = [];
  if (!current || !previous) return insights;

  const currSpent = current.totalSpent || 0;
  const prevSpent = previous.totalSpent || 0;
  const currIncome = current.totalIncome || 0;
  const prevIncome = previous.totalIncome || 0;

  // Spending change
  if (prevSpent > 0) {
    const spendChange = ((currSpent - prevSpent) / prevSpent) * 100;
    if (spendChange > 15) {
      insights.push({
        id: "cycle-spend-up",
        type: "warning",
        priority: 3,
        title: "Spending Increased",
        message: `Spending is up ${spendChange.toFixed(1)}% vs last cycle (₹${Math.round(currSpent - prevSpent).toLocaleString("en-IN")} more).`,
      });
    } else if (spendChange < -10) {
      insights.push({
        id: "cycle-spend-down",
        type: "success",
        priority: 5,
        title: "Spending Reduced",
        message: `Great! Spending decreased ${Math.abs(spendChange).toFixed(1)}% vs last cycle (₹${Math.round(prevSpent - currSpent).toLocaleString("en-IN")} saved).`,
      });
    }
  }

  // Income change
  if (prevIncome > 0) {
    const incomeChange = ((currIncome - prevIncome) / prevIncome) * 100;
    if (incomeChange < -10) {
      insights.push({
        id: "cycle-income-down",
        type: "warning",
        priority: 3,
        title: "Income Dropped",
        message: `Income decreased ${Math.abs(incomeChange).toFixed(1)}% vs last cycle.`,
      });
    } else if (incomeChange > 15) {
      insights.push({
        id: "cycle-income-up",
        type: "success",
        priority: 5,
        title: "Income Increased",
        message: `Income grew by ${incomeChange.toFixed(1)}% vs last cycle!`,
      });
    }
  }

  // Category-level: find biggest worsening
  const SKIP = new Set(["Income", "Transfer", "Credit Card Payment"]);
  const currBreakdown = current.categoryBreakdown || {};
  const prevBreakdown = previous.categoryBreakdown || {};
  const allCats = new Set([
    ...Object.keys(currBreakdown),
    ...Object.keys(prevBreakdown),
  ]);

  let worstCat: { cat: string; change: number; pct: number } | null = null;
  let bestCat: { cat: string; change: number; pct: number } | null = null;

  allCats.forEach((cat) => {
    if (SKIP.has(cat)) return;
    const curr = currBreakdown[cat] || 0;
    const prev = prevBreakdown[cat] || 0;
    if (prev <= 0) return;

    const change = curr - prev;
    const pct = (change / prev) * 100;

    if (pct > 30 && change > 500 && (!worstCat || change > worstCat.change)) {
      worstCat = { cat, change, pct };
    }
    if (
      pct < -20 &&
      Math.abs(change) > 300 &&
      (!bestCat || change < bestCat.change)
    ) {
      bestCat = { cat, change: Math.abs(change), pct: Math.abs(pct) };
    }
  });

  if (worstCat) {
    const w = worstCat as { cat: string; change: number; pct: number };
    insights.push({
      id: `cycle-worst-${w.cat}`,
      type: "warning",
      priority: 3,
      title: `${w.cat} Spending Spike`,
      message: `${w.cat} spending jumped ${w.pct.toFixed(0)}% (₹${Math.round(w.change).toLocaleString("en-IN")} more) vs last cycle.`,
    });
  }

  if (bestCat) {
    const b = bestCat as { cat: string; change: number; pct: number };
    insights.push({
      id: `cycle-best-${b.cat}`,
      type: "success",
      priority: 5,
      title: `${b.cat} Improved`,
      message: `${b.cat} spending dropped ${b.pct.toFixed(0)}% (₹${Math.round(b.change).toLocaleString("en-IN")} saved) vs last cycle.`,
    });
  }

  return insights;
};
