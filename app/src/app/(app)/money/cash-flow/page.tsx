"use client";

import { useMemo } from "react";
import { useData } from "@/providers/DataProvider";
import { getRecentFinancialMonths } from "@/utils/financialMonth";
import { fmt } from "@/utils/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { ArrowUpRight, ArrowDownRight, TrendingUp, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, AreaChart, Area } from "recharts";
import { SkeletonCard } from "@/components/SkeletonLoader";

const SKIP_CATS = new Set(["Transfer", "Credit Card Payment"]);

export default function CashFlowPage() {
  const { transactions, cycleStartDay, accounts, dataReady } = useData();

  const recentCycles = useMemo(() => getRecentFinancialMonths(6, new Date(), cycleStartDay), [cycleStartDay]);

  // Per-cycle income vs expense
  const cycleData = useMemo(() => {
    return recentCycles.map((cycle) => {
      const txns = transactions.filter(
        (t) => t.date >= cycle.startDate && t.date <= cycle.endDate && !SKIP_CATS.has(t.category) && t.payment_type !== "Self Transfer"
      );
      let income = 0, expense = 0;
      txns.forEach((t) => {
        if (t.category === "Income" || t.amount > 0) income += Math.abs(t.amount);
        else expense += Math.abs(t.amount);
      });
      return { label: cycle.label.split(" ")[0], income, expense, net: income - expense };
    }).reverse();
  }, [recentCycles, transactions]);

  // Current cycle daily cumulative spend
  const currentCycle = recentCycles[0];
  const dailySpend = useMemo(() => {
    if (!currentCycle) return [];
    const txns = transactions.filter(
      (t) => t.date >= currentCycle.startDate && t.date <= currentCycle.endDate && t.amount < 0 && !SKIP_CATS.has(t.category) && t.payment_type !== "Self Transfer"
    );
    const dayMap: Record<string, number> = {};
    txns.forEach((t) => { dayMap[t.date] = (dayMap[t.date] || 0) + Math.abs(t.amount); });
    const sorted = Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b));
    let cumulative = 0;
    return sorted.map(([date, amt]) => {
      cumulative += amt;
      return { date: new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), daily: amt, cumulative };
    });
  }, [currentCycle, transactions]);

  // Summary metrics
  const summary = useMemo(() => {
    const current = cycleData[cycleData.length - 1] || { income: 0, expense: 0, net: 0 };
    const totalExpense = current.expense;
    const daysInCycle = dailySpend.length || 1;
    const dailyAvg = totalExpense / daysInCycle;
    const liquidCash = accounts.filter((a) => a.type !== "credit").reduce((s, a) => s + (a.balance || 0), 0);
    const daysOfCash = dailyAvg > 0 ? Math.round(liquidCash / dailyAvg) : 999;
    const projectedBalance = liquidCash - (dailyAvg * 30 - totalExpense);
    return { dailyAvg, daysOfCash, projectedBalance, ...current };
  }, [cycleData, dailySpend, accounts]);

  if (!dataReady) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><SkeletonCard lines={2} /><SkeletonCard lines={2} /><SkeletonCard lines={2} /></div>
        <SkeletonCard lines={8} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-success/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-success" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase">Income</span>
            </div>
            <p className="text-lg font-bold text-success">{fmt(summary.income)}</p>
          </CardContent>
        </Card>
        <Card className="border-danger/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownRight className="w-3.5 h-3.5 text-danger" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase">Expenses</span>
            </div>
            <p className="text-lg font-bold text-danger">{fmt(summary.expense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-3.5 h-3.5 text-info" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase">Daily Avg</span>
            </div>
            <p className="text-lg font-bold text-foreground">{fmt(summary.dailyAvg)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-warning" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase">Days of Cash</span>
            </div>
            <p className={cn("text-lg font-bold", summary.daysOfCash > 60 ? "text-success" : summary.daysOfCash > 30 ? "text-warning" : "text-danger")}>
              {summary.daysOfCash > 365 ? "365+" : summary.daysOfCash} days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Net Flow Hero */}
      <Card>
        <CardContent className="p-6 text-center">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">Net Flow This Cycle</span>
          <p className={cn("text-3xl font-bold mt-1", summary.net >= 0 ? "text-success" : "text-danger")}>
            {summary.net >= 0 ? "+" : ""}{fmt(summary.net)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Savings rate: {summary.income > 0 ? Math.round((summary.net / summary.income) * 100) : 0}%
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Income vs Expenses Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Income vs Expenses (Last 6 Cycles)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cycleData} barGap={4}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Bar dataKey="income" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" fill="var(--color-danger)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-2.5 h-2.5 rounded-sm bg-success" />Income</span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-2.5 h-2.5 rounded-sm bg-danger" />Expenses</span>
            </div>
          </CardContent>
        </Card>

        {/* Daily Cumulative Spend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cumulative Spend — {currentCycle?.label}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-[220px]">
              {dailySpend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailySpend}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                    <Area type="monotone" dataKey="cumulative" stroke="var(--color-danger)" fill="var(--color-danger)" fillOpacity={0.1} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No spend data yet</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
