"use client";

import { useState, useMemo } from "react";
import { useData } from "@/providers/DataProvider";
import { fmt } from "@/utils/format";
import { useTheme } from "@/providers/ThemeProvider";
import ChartCard from "@/components/ChartCard";
import StatCard from "@/components/StatCard";
import { Calendar, TrendingUp, TrendingDown, PiggyBank, Hash, Award, Flame } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";
import ExportBar from "@/components/ExportBar";

const SKIP_CATS = new Set(["Transfer", "Credit Card Payment"]);
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function YearlyReviewPage() {
  const { transactions } = useData();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  // Filter transactions for selected year
  const yearTxns = useMemo(
    () => transactions.filter((t) => t.date.startsWith(String(year)) && !SKIP_CATS.has(t.category) && t.payment_type !== "Self Transfer"),
    [transactions, year]
  );

  // Monthly breakdown
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: MONTH_SHORT[i],
      income: 0,
      expense: 0,
      savings: 0,
    }));

    yearTxns.forEach((t) => {
      const m = parseInt(t.date.split("-")[1]) - 1;
      if (m < 0 || m > 11) return;
      if (t.category === "Income" || t.amount > 0) {
        months[m].income += Math.abs(t.amount);
      } else {
        months[m].expense += Math.abs(t.amount);
      }
    });

    months.forEach((m) => { m.savings = m.income - m.expense; });
    return months;
  }, [yearTxns]);

  // Yearly totals
  const totals = useMemo(() => {
    let income = 0, expense = 0, txnCount = 0;
    yearTxns.forEach((t) => {
      if (t.category === "Income" || t.amount > 0) income += Math.abs(t.amount);
      else { expense += Math.abs(t.amount); txnCount++; }
    });
    const saved = income - expense;
    const savingsRate = income > 0 ? (saved / income) * 100 : 0;
    const dailyAvg = expense / 365;
    return { income, expense, saved, savingsRate, txnCount, dailyAvg, totalTxns: yearTxns.length };
  }, [yearTxns]);

  // Top 3 categories
  const topCategories = useMemo(() => {
    const map: Record<string, number> = {};
    yearTxns.forEach((t) => {
      if (t.amount < 0 && t.category !== "Income") {
        map[t.category] = (map[t.category] || 0) + Math.abs(t.amount);
      }
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [yearTxns]);

  // Best & worst months
  const bestMonth = useMemo(
    () => monthlyData.reduce((best, m, idx) => (m.savings > (best?.savings || -Infinity) ? { ...m, idx } : best), null as (typeof monthlyData[0] & { idx: number }) | null),
    [monthlyData]
  );
  const worstMonth = useMemo(
    () => monthlyData.filter((m) => m.income > 0 || m.expense > 0).reduce((worst, m, idx) => (m.savings < (worst?.savings || Infinity) ? { ...m, idx } : worst), null as (typeof monthlyData[0] & { idx: number }) | null),
    [monthlyData]
  );

  // Most active day of week
  const busiestDay = useMemo(() => {
    const days = [0, 0, 0, 0, 0, 0, 0];
    yearTxns.forEach((t) => {
      if (t.amount < 0) days[new Date(t.date + "T00:00:00").getDay()]++;
    });
    const maxIdx = days.indexOf(Math.max(...days));
    return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][maxIdx];
  }, [yearTxns]);

  return (
    <div className="space-y-6">
      {/* Header with export */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Yearly Review</h1>
        <ExportBar elementId="yearly-report" filename={`yearly-${year}`} title={`Yearly Report ${year}`} />
      </div>

      <div id="yearly-report" className="space-y-6">
      {/* Year Selector */}
      <div className="flex items-center gap-3">
        {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
          <button
            key={y}
            onClick={() => setYear(y)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              y === year ? "bg-brand text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Hero Stats */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-border p-6 sm:p-8 text-center space-y-2"
        style={{ background: isDark ? "#111827" : "#ffffff" }}
      >
        <Calendar className="w-8 h-8 text-brand mx-auto mb-2" />
        <h2 className="text-xl font-extrabold text-foreground">{year} Money Wrapped</h2>
        <p className="text-sm text-muted-foreground">Your year in numbers</p>
      </motion.div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Total Earned" value={totals.income} icon={TrendingUp} color="primary" delay={0} />
        <StatCard title="Total Spent" value={totals.expense} icon={TrendingDown} color="danger" delay={0.1} />
        <StatCard title="Total Saved" value={Math.max(0, totals.saved)} icon={PiggyBank} color="accent" delay={0.15} />
        <StatCard title="Transactions" value={totals.totalTxns} prefix="" icon={Hash} delay={0.2} />
      </div>

      {/* Monthly Trend */}
      <ChartCard title="Monthly Spending" subtitle={`${year} month-over-month`}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthlyData}>
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: isDark ? "#9ca3af" : "#6b7280" }} />
            <YAxis tick={{ fontSize: 11, fill: isDark ? "#9ca3af" : "#6b7280" }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ background: isDark ? "#1f2937" : "#fff", border: "none", borderRadius: 12 }} formatter={(v) => [fmt(Number(v)), ""]} />
            <Bar dataKey="income" fill="#1abf94" radius={[3, 3, 0, 0]} name="Income" />
            <Bar dataKey="expense" fill="#ef4444" radius={[3, 3, 0, 0]} name="Expense" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Top Categories */}
        <div className="rounded-2xl border border-border p-5 space-y-3" style={{ background: isDark ? "#111827" : "#ffffff" }}>
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-brand" />
            <h3 className="text-sm font-bold text-foreground">Top Categories</h3>
          </div>
          {topCategories.map(([cat, amount], idx) => (
            <div key={cat} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">{idx + 1}</span>
                <span className="text-sm text-foreground">{cat}</span>
              </div>
              <span className="text-sm font-semibold text-foreground">{fmt(amount)}</span>
            </div>
          ))}
        </div>

        {/* Fun Stats */}
        <div className="rounded-2xl border border-border p-5 space-y-3" style={{ background: isDark ? "#111827" : "#ffffff" }}>
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-brand" />
            <h3 className="text-sm font-bold text-foreground">Fun Stats</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Daily Average Spend</span>
              <span className="font-medium text-foreground">{fmt(totals.dailyAvg)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Savings Rate</span>
              <span className="font-medium text-foreground">{totals.savingsRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Busiest Day</span>
              <span className="font-medium text-foreground">{busiestDay}</span>
            </div>
            {bestMonth && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Best Month</span>
                <span className="font-medium text-emerald-500">{MONTH_SHORT[bestMonth.idx]}</span>
              </div>
            )}
            {worstMonth && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Toughest Month</span>
                <span className="font-medium text-red-500">{MONTH_SHORT[worstMonth.idx]}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
