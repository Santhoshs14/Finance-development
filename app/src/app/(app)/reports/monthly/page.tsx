"use client";

import { useState, useMemo } from "react";
import { useData } from "@/providers/DataProvider";
import { getRecentFinancialMonths } from "@/utils/financialMonth";
import { generateInsightsFromAggregates, generateCycleComparisonInsights } from "@/utils/insights";
import { fmt } from "@/utils/format";
import { useTheme } from "@/providers/ThemeProvider";
import ChartCard from "@/components/ChartCard";
import StatCard from "@/components/StatCard";
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Lightbulb, Landmark } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { motion } from "framer-motion";
import ExportBar from "@/components/ExportBar";
import { DEFAULT_INVESTMENT_CATEGORIES } from "@/schemas/category";

const SKIP_CATS = new Set(["Transfer", "Credit Card Payment"]);

export default function MonthlyReviewPage() {
  const { transactions, cycleStartDay, accounts, categories } = useData();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Build set of investment/productive categories
  const investmentCategories = useMemo(() => {
    const set = new Set<string>(DEFAULT_INVESTMENT_CATEGORIES);
    categories.forEach((c) => {
      if ((c as { classification?: string }).classification === "investment") {
        set.add(c.name);
      }
    });
    return set;
  }, [categories]);

  const recentCycles = useMemo(
    () => getRecentFinancialMonths(8, new Date(), cycleStartDay),
    [cycleStartDay]
  );

  const [selectedIdx, setSelectedIdx] = useState(0);
  const selectedCycle = recentCycles[selectedIdx];
  const _previousCycle = recentCycles[selectedIdx + 1];

  // Compute aggregate for a cycle
  const computeAggregate = (cycleIdx: number) => {
    const cycle = recentCycles[cycleIdx];
    if (!cycle) return { totalSpent: 0, totalIncome: 0, totalInvestmentSpend: 0, categoryBreakdown: {} as Record<string, number>, txnCount: 0 };
    const txns = transactions.filter(
      (t) => t.date >= cycle.startDate && t.date <= cycle.endDate && !SKIP_CATS.has(t.category) && t.payment_type !== "Self Transfer"
    );
    let totalSpent = 0, totalIncome = 0, totalInvestmentSpend = 0;
    const categoryBreakdown: Record<string, number> = {};
    txns.forEach((t) => {
      if (t.category === "Income" || t.amount > 0) {
        totalIncome += Math.abs(t.amount);
      } else {
        const absAmt = Math.abs(t.amount);
        totalSpent += absAmt;
        categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + absAmt;
        if (investmentCategories.has(t.category)) {
          totalInvestmentSpend += absAmt;
        }
      }
    });
    return { totalSpent, totalIncome, totalInvestmentSpend, categoryBreakdown, txnCount: txns.length };
  };

  const currentAgg = useMemo(() => computeAggregate(selectedIdx), [selectedIdx, transactions, recentCycles, investmentCategories]);
  const previousAgg = useMemo(() => computeAggregate(selectedIdx + 1), [selectedIdx, transactions, recentCycles, investmentCategories]);

  // Investment-aware savings rate: investment spending counts as savings
  const effectiveExpenses = currentAgg.totalSpent - currentAgg.totalInvestmentSpend;
  const savingsRate = currentAgg.totalIncome > 0
    ? ((currentAgg.totalIncome - effectiveExpenses) / currentAgg.totalIncome) * 100
    : 0;

  // Category breakdown sorted - separate investment and regular
  const categoryData = useMemo(
    () =>
      Object.entries(currentAgg.categoryBreakdown)
        .map(([name, value]) => ({
          name,
          value: Math.round(value),
          isInvestment: investmentCategories.has(name),
        }))
        .sort((a, b) => b.value - a.value),
    [currentAgg, investmentCategories]
  );

  const productiveSpendData = categoryData.filter((c) => c.isInvestment);
  const discretionaryData = categoryData.filter((c) => !c.isInvestment);

  // Top 5 largest expenses
  const topExpenses = useMemo(() => {
    return transactions
      .filter(
        (t) =>
          t.date >= selectedCycle.startDate &&
          t.date <= selectedCycle.endDate &&
          t.amount < 0 &&
          !SKIP_CATS.has(t.category) &&
          t.payment_type !== "Self Transfer"
      )
      .sort((a, b) => a.amount - b.amount)
      .slice(0, 5);
  }, [transactions, selectedCycle]);

  // Insights
  const insights = useMemo(() => {
    const agg = { totalSpent: currentAgg.totalSpent, totalIncome: currentAgg.totalIncome, totalInvestmentSpend: currentAgg.totalInvestmentSpend, categoryBreakdown: currentAgg.categoryBreakdown };
    const prevAgg = previousAgg.totalIncome > 0 ? { totalSpent: previousAgg.totalSpent, totalIncome: previousAgg.totalIncome, totalInvestmentSpend: previousAgg.totalInvestmentSpend, categoryBreakdown: previousAgg.categoryBreakdown } : null;
    return [
      ...generateInsightsFromAggregates(agg, [], accounts, savingsRate),
      ...generateCycleComparisonInsights(agg, prevAgg),
    ];
  }, [currentAgg, previousAgg, accounts, savingsRate]);

  return (
    <div className="space-y-6">
      {/* Header with export */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Monthly Review</h1>
        <ExportBar elementId="monthly-report" filename={`monthly-${selectedCycle.cycleKey}`} title="Monthly Report" />
      </div>

      <div id="monthly-report" className="space-y-6">
      {/* Cycle Selector */}
      <div className="flex gap-2 flex-wrap">
        {recentCycles.map((c, idx) => (
          <button
            key={c.cycleKey}
            onClick={() => setSelectedIdx(idx)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              idx === selectedIdx ? "bg-brand text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {c.label.split(" ")[0].slice(0, 3)} {c.label.split(" ")[1]?.slice(2)}
          </button>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Income" value={currentAgg.totalIncome} icon={TrendingUp} color="primary" delay={0} />
        <StatCard title="Expenses" value={effectiveExpenses} icon={TrendingDown} color="danger" delay={0.1} />
        <StatCard title="Invested" value={currentAgg.totalInvestmentSpend} icon={Landmark} color="accent" delay={0.12} />
        <StatCard title="Saved + Invested" value={Math.max(0, currentAgg.totalIncome - effectiveExpenses)} icon={PiggyBank} color="accent" delay={0.15} />
      </div>

      {/* Savings Rate Ring */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border p-5 flex items-center gap-6"
        style={{ background: isDark ? "#111827" : "#ffffff" }}
      >
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="32" fill="none" stroke={isDark ? "#1f2937" : "#e5e7eb"} strokeWidth="8" />
            <circle
              cx="40" cy="40" r="32" fill="none"
              stroke={savingsRate >= 20 ? "#10b981" : savingsRate >= 10 ? "#f59e0b" : "#ef4444"}
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${(Math.min(100, Math.max(0, savingsRate)) / 100) * 201} 201`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-foreground">{savingsRate.toFixed(0)}%</span>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Savings Rate</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {savingsRate >= 20 ? "Great! You're saving well above the recommended 20% (investments included)." :
             savingsRate >= 10 ? "Decent, but try to push above 20% for better financial health." :
             "Your savings rate is low. Look for areas to cut back."}
          </p>
          {currentAgg.totalInvestmentSpend > 0 && (
            <p className="text-[11px] text-emerald-500 mt-1">
              💹 Includes ₹{currentAgg.totalInvestmentSpend.toLocaleString("en-IN")} in productive investments
            </p>
          )}
        </div>
      </motion.div>

      {/* Productive Spending (Investments) */}
      {productiveSpendData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-emerald-500/30 p-5 space-y-3"
          style={{ background: isDark ? "#052e16" : "#ecfdf5" }}
        >
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Productive Spending</h3>
          </div>
          <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">
            These expenses grow your wealth and count toward your savings rate.
          </p>
          <div className="space-y-2">
            {productiveSpendData.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between py-1">
                <span className="text-sm text-emerald-700 dark:text-emerald-300">{cat.name}</span>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{fmt(cat.value)}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Category Breakdown */}
      {discretionaryData.length > 0 && (
        <ChartCard title="Spending by Category" subtitle={selectedCycle.label}>
          <ResponsiveContainer width="100%" height={Math.max(180, discretionaryData.length * 28)}>
            <BarChart data={discretionaryData.slice(0, 10)} layout="vertical" margin={{ left: 80 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: isDark ? "#9ca3af" : "#6b7280" }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: isDark ? "#9ca3af" : "#6b7280" }} width={75} />
              <Tooltip contentStyle={{ background: isDark ? "#1f2937" : "#fff", border: "none", borderRadius: 12 }} formatter={(v) => [fmt(Number(v)), ""]} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {discretionaryData.slice(0, 10).map((_, idx) => (
                  <Cell key={idx} fill={idx === 0 ? "#ef4444" : idx < 3 ? "#f59e0b" : "#6b7280"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Top 5 Expenses */}
      {topExpenses.length > 0 && (
        <div className="rounded-2xl border border-border p-5 space-y-3" style={{ background: isDark ? "#111827" : "#ffffff" }}>
          <h3 className="text-sm font-bold text-foreground">Top 5 Expenses</h3>
          <div className="space-y-2">
            {topExpenses.map((t, idx) => (
              <div key={idx} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5">{idx + 1}</span>
                  <div>
                    <p className="text-sm text-foreground">{t.notes || t.category}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(t.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {t.category}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-foreground">{fmt(Math.abs(t.amount))}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div className="rounded-2xl border border-border p-5 space-y-3" style={{ background: isDark ? "#111827" : "#ffffff" }}>
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-brand" />
            <h3 className="text-sm font-bold text-foreground">Cycle Insights</h3>
          </div>
          <div className="space-y-2">
            {insights.map((insight, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.08 }}
                className={`rounded-xl p-3 text-sm ${
                  insight.type === "success" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" :
                  insight.type === "danger" ? "bg-red-500/10 text-red-700 dark:text-red-400" :
                  insight.type === "warning" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" :
                  "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                }`}
              >
                <p className="font-medium">{insight.title}</p>
                <p className="text-xs mt-0.5 opacity-80">{insight.message}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
