"use client";

import { useMemo } from "react";
import { useData } from "@/providers/DataProvider";
import { getRecentFinancialMonths } from "@/utils/financialMonth";
import { detectRecurringTransactions } from "@/utils/calculations";
import { generateInsightsFromAggregates } from "@/utils/insights";
import { fmt } from "@/utils/format";
import { useTheme } from "@/providers/ThemeProvider";
import ChartCard from "@/components/ChartCard";
import StatCard from "@/components/StatCard";
import { BarChart3, Zap, CreditCard, Lightbulb, TrendingDown } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
} from "recharts";
import { motion } from "framer-motion";
import { SkeletonCard } from "@/components/SkeletonLoader";
import { DEFAULT_INVESTMENT_CATEGORIES } from "@/schemas/category";

const SKIP_CATS = new Set(["Transfer", "Credit Card Payment", "Income"]);
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PIE_COLORS = ["#1abf94", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444", "#6b7280", "#ec4899"];

export default function AnalyticsPage() {
  const { transactions, cycleStartDay, accounts, categories, dataReady } = useData();
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

  const currentCycle = useMemo(
    () => getRecentFinancialMonths(1, new Date(), cycleStartDay)[0],
    [cycleStartDay]
  );

  const prevCycle = useMemo(
    () => getRecentFinancialMonths(2, new Date(), cycleStartDay)[1],
    [cycleStartDay]
  );

  const cycleTxns = useMemo(
    () =>
      transactions.filter(
        (t) =>
          t.date >= currentCycle.startDate &&
          t.date <= currentCycle.endDate &&
          t.amount < 0 &&
          !SKIP_CATS.has(t.category) &&
          t.payment_type !== "Self Transfer"
      ),
    [transactions, currentCycle]
  );

  const prevCycleTxns = useMemo(
    () =>
      transactions.filter(
        (t) =>
          t.date >= prevCycle.startDate &&
          t.date <= prevCycle.endDate &&
          t.amount < 0 &&
          !SKIP_CATS.has(t.category) &&
          t.payment_type !== "Self Transfer"
      ),
    [transactions, prevCycle]
  );

  // Cycle-over-cycle comparison by category
  const cycleComparison = useMemo(() => {
    const currentCats: Record<string, number> = {};
    const prevCats: Record<string, number> = {};
    cycleTxns.forEach((t) => { currentCats[t.category] = (currentCats[t.category] || 0) + Math.abs(t.amount); });
    prevCycleTxns.forEach((t) => { prevCats[t.category] = (prevCats[t.category] || 0) + Math.abs(t.amount); });
    const allCats = [...new Set([...Object.keys(currentCats), ...Object.keys(prevCats)])];
    return allCats
      .map((cat) => ({
        category: cat,
        current: Math.round(currentCats[cat] || 0),
        previous: Math.round(prevCats[cat] || 0),
        change: currentCats[cat] && prevCats[cat]
          ? Math.round(((currentCats[cat] - prevCats[cat]) / prevCats[cat]) * 100)
          : null,
        isInvestment: investmentCategories.has(cat),
      }))
      .sort((a, b) => b.current - a.current)
      .slice(0, 8);
  }, [cycleTxns, prevCycleTxns, investmentCategories]);

  // Spending velocity (daily cumulative)
  const velocityData = useMemo(() => {
    const dayMap: Record<string, number> = {};
    cycleTxns.forEach((t) => {
      dayMap[t.date] = (dayMap[t.date] || 0) + Math.abs(t.amount);
    });
    const sorted = Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b));
    let cumulative = 0;
    return sorted.map(([date, amt]) => {
      cumulative += amt;
      return {
        date: new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        daily: Math.round(amt),
        cumulative: Math.round(cumulative),
      };
    });
  }, [cycleTxns]);

  // Payment method breakdown
  const paymentBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    cycleTxns.forEach((t) => {
      const method = t.payment_type || "Other";
      map[method] = (map[method] || 0) + Math.abs(t.amount);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [cycleTxns]);

  // Day-of-week pattern
  const dayOfWeekData = useMemo(() => {
    const totals = [0, 0, 0, 0, 0, 0, 0];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    cycleTxns.forEach((t) => {
      const day = new Date(t.date + "T00:00:00").getDay();
      totals[day] += Math.abs(t.amount);
      counts[day]++;
    });
    return DAY_NAMES.map((name, idx) => ({
      day: name,
      total: Math.round(totals[idx]),
      avg: counts[idx] > 0 ? Math.round(totals[idx] / counts[idx]) : 0,
      count: counts[idx],
    }));
  }, [cycleTxns]);

  // Top merchants/notes
  const topMerchants = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    cycleTxns.forEach((t) => {
      const key = (t.notes || t.category || "Unknown").trim();
      if (!map[key]) map[key] = { total: 0, count: 0 };
      map[key].total += Math.abs(t.amount);
      map[key].count++;
    });
    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [cycleTxns]);

  // Recurring transactions
  const recurring = useMemo(
    () => detectRecurringTransactions(transactions as Parameters<typeof detectRecurringTransactions>[0]),
    [transactions]
  );

  // Summary stats
  const stats = useMemo(() => {
    const totalSpend = cycleTxns.reduce((s, t) => s + Math.abs(t.amount), 0);
    const txnCount = cycleTxns.length;
    const daysActive = new Set(cycleTxns.map((t) => t.date)).size;
    const dailyAvg = daysActive > 0 ? totalSpend / daysActive : 0;
    const avgTxnSize = txnCount > 0 ? totalSpend / txnCount : 0;
    return { totalSpend, txnCount, dailyAvg, avgTxnSize, daysActive };
  }, [cycleTxns]);

  // Insights
  const insights = useMemo(() => {
    const catBreakdown: Record<string, number> = {};
    cycleTxns.forEach((t) => {
      catBreakdown[t.category] = (catBreakdown[t.category] || 0) + Math.abs(t.amount);
    });
    const aggregate = { totalSpent: stats.totalSpend, totalIncome: 0, categoryBreakdown: catBreakdown };
    return generateInsightsFromAggregates(aggregate, [], accounts);
  }, [cycleTxns, stats, accounts]);

  if (!dataReady) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={2} />)}
        </div>
        {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} lines={6} />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Total Spend" value={stats.totalSpend} icon={TrendingDown} color="danger" delay={0} />
        <StatCard title="Transactions" value={stats.txnCount} prefix="" icon={BarChart3} delay={0.1} />
        <StatCard title="Daily Average" value={stats.dailyAvg} icon={Zap} color="warning" delay={0.15} />
        <StatCard title="Avg Txn Size" value={stats.avgTxnSize} icon={CreditCard} color="accent" delay={0.2} />
      </div>

      {/* Spending Velocity */}
      {velocityData.length > 0 && (
        <ChartCard title="Spending Velocity" subtitle="Daily cumulative spend this cycle">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={velocityData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1f2937" : "#e5e7eb"} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: isDark ? "#9ca3af" : "#6b7280" }} />
              <YAxis tick={{ fontSize: 11, fill: isDark ? "#9ca3af" : "#6b7280" }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: isDark ? "#1f2937" : "#fff", border: "none", borderRadius: 12 }} formatter={(v) => [fmt(Number(v)), ""]} />
              <Area type="monotone" dataKey="cumulative" stroke="#1abf94" fill="#1abf94" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Payment Method Breakdown */}
        {paymentBreakdown.length > 0 && (
          <ChartCard title="Payment Methods" subtitle="How you pay">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={paymentBreakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label={({ name }) => name}>
                  {paymentBreakdown.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Day of Week Pattern */}
        <ChartCard title="Day-of-Week Pattern" subtitle="Which days you spend most">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dayOfWeekData}>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: isDark ? "#9ca3af" : "#6b7280" }} />
              <YAxis tick={{ fontSize: 11, fill: isDark ? "#9ca3af" : "#6b7280" }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: isDark ? "#1f2937" : "#fff", border: "none", borderRadius: 12 }} formatter={(v) => [fmt(Number(v)), ""]} />
              <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Top Merchants */}
      {topMerchants.length > 0 && (
        <div className="rounded-2xl border border-border p-5 space-y-3" style={{ background: isDark ? "#111827" : "#ffffff" }}>
          <h3 className="text-sm font-bold text-foreground">Top Spending Destinations</h3>
          <div className="space-y-2">
            {topMerchants.map((m, idx) => (
              <div key={m.name} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground w-5">{idx + 1}</span>
                  <span className="text-sm text-foreground truncate max-w-[200px]">{m.name}</span>
                  <span className="text-[11px] text-muted-foreground">({m.count}x)</span>
                </div>
                <span className="text-sm font-semibold text-foreground">{fmt(m.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recurring Patterns */}
      {recurring.length > 0 && (
        <div className="rounded-2xl border border-border p-5 space-y-3" style={{ background: isDark ? "#111827" : "#ffffff" }}>
          <h3 className="text-sm font-bold text-foreground">Detected Recurring Expenses</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recurring.slice(0, 6).map((r) => (
              <div key={r.key} className="rounded-xl bg-muted p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground truncate max-w-[150px]">{r.description}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-brand/10 text-brand font-medium">{r.frequency}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ~{fmt(r.avgAmount)} · {r.occurrences} times · Next: {new Date(r.nextExpectedDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cycle-over-Cycle Comparison */}
      {cycleComparison.length > 0 && (
        <ChartCard title="Cycle-over-Cycle" subtitle={`Current vs Previous (${prevCycle.label})`}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={cycleComparison} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1f2937" : "#e5e7eb"} />
              <XAxis type="number" tick={{ fontSize: 11, fill: isDark ? "#9ca3af" : "#6b7280" }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: isDark ? "#9ca3af" : "#6b7280" }} width={60} />
              <Tooltip contentStyle={{ background: isDark ? "#1f2937" : "#fff", border: "none", borderRadius: 12 }} formatter={(v) => fmt(Number(v))} />
              <Bar dataKey="current" fill="#0080ff" radius={[0, 4, 4, 0]} name="Current" />
              <Bar dataKey="previous" fill="#6b7280" radius={[0, 4, 4, 0]} name="Previous" opacity={0.5} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div className="rounded-2xl border border-border p-5 space-y-3" style={{ background: isDark ? "#111827" : "#ffffff" }}>
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-brand" />
            <h3 className="text-sm font-bold text-foreground">Insights</h3>
          </div>
          <div className="space-y-2">
            {insights.map((insight, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
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
  );
}
