"use client";

import { useMemo, useEffect, useRef } from "react";
import { useData } from "@/providers/DataProvider";
import { useInvestments } from "@/hooks/useInvestments";
import { useNetWorthHistory } from "@/hooks/useNetWorthHistory";
import {
  calculateNetWorth,
  calculatePortfolioAllocation,
  calculateFinancialHealthScore,
  calculateSavingsRateFromAggregates,
} from "@/utils/calculations";
import StatCard from "@/components/StatCard";
import ChartCard from "@/components/ChartCard";
import { useTheme } from "@/providers/ThemeProvider";
import { Wallet, TrendingUp, CreditCard, HandCoins, ShieldCheck } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { motion } from "framer-motion";

const ALLOC_COLORS = ["#1abf94", "#3b82f6", "#f59e0b", "#8b5cf6", "#6b7280"];

export default function NetWorthPage() {
  const { accounts, currentAggregate } = useData();
  const { investments, isLoading } = useInvestments();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { snapshots, isLoading: historyLoading, saveSnapshot } = useNetWorthHistory();
  const savedRef = useRef(false);

  const netWorthData = useMemo(
    () => calculateNetWorth(accounts, investments, []),
    [accounts, investments]
  );

  const allocation = useMemo(
    () => calculatePortfolioAllocation(accounts, investments),
    [accounts, investments]
  );

  const savingsData = useMemo(
    () => calculateSavingsRateFromAggregates(currentAggregate || {}),
    [currentAggregate]
  );

  const healthScore = useMemo(
    () => calculateFinancialHealthScore(savingsData, netWorthData, null, allocation),
    [savingsData, netWorthData, allocation]
  );

  // Auto-save current month's snapshot when data is loaded
  useEffect(() => {
    if (savedRef.current || isLoading || !netWorthData) return;
    savedRef.current = true;
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    saveSnapshot({
      month,
      accounts: netWorthData.total_accounts,
      investments: netWorthData.total_investments,
      cc_outstanding: netWorthData.total_cc_outstanding,
      lent: netWorthData.total_lent,
      borrowed: netWorthData.total_borrowed,
      net_worth: netWorthData.net_worth,
    });
  }, [isLoading, netWorthData, saveSnapshot]);

  // Prepare chart data from snapshots
  const trendData = useMemo(() => {
    return snapshots.map((s) => ({
      month: s.month,
      label: new Date(s.month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      net_worth: s.net_worth,
      assets: s.accounts + s.investments + s.lent,
      liabilities: s.cc_outstanding + s.borrowed,
    }));
  }, [snapshots]);

  const pieData = useMemo(() => {
    return Object.entries(allocation.percentages)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [allocation]);

  if (isLoading) {
    return <div className="animate-pulse space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted" />)}</div>;
  }

  const scoreColor =
    healthScore >= 70 ? "#10b981" : healthScore >= 40 ? "#f59e0b" : "#ef4444";
  const scoreLabel =
    healthScore >= 70 ? "Excellent" : healthScore >= 40 ? "Good" : "Needs Work";

  return (
    <div className="space-y-6">
      {/* Hero Net Worth */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-border p-6 sm:p-8 text-center"
        style={{ background: isDark ? "#111827" : "#ffffff" }}
      >
        <p className="text-sm text-muted-foreground mb-2">Total Net Worth</p>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground">
          ₹{netWorthData.net_worth.toLocaleString("en-IN")}
        </h2>
        <p className="text-xs text-muted-foreground mt-2">Assets − Liabilities</p>
      </motion.div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Bank Accounts" value={netWorthData.total_accounts} icon={Wallet} delay={0} />
        <StatCard title="Investments" value={netWorthData.total_investments} icon={TrendingUp} color="accent" delay={0.1} />
        <StatCard title="CC Outstanding" value={netWorthData.total_cc_outstanding} icon={CreditCard} color="danger" delay={0.15} />
        <StatCard title="Lent Out" value={netWorthData.total_lent} icon={HandCoins} color="warning" delay={0.2} />
      </div>

      {/* Net Worth Trend Chart */}
      {trendData.length >= 2 && (
        <ChartCard title="Net Worth Trend" subtitle="Monthly progression">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0080ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0080ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1f2937" : "#e5e7eb"} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke={isDark ? "#6b7280" : "#9ca3af"} />
              <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke={isDark ? "#6b7280" : "#9ca3af"} width={60} />
              <Tooltip
                formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Net Worth"]}
                contentStyle={{ background: isDark ? "#1f2937" : "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }}
              />
              <Area type="monotone" dataKey="net_worth" stroke="#0080ff" fill="url(#nwGrad)" strokeWidth={2} dot={{ r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
      {trendData.length < 2 && !historyLoading && (
        <div className="rounded-2xl border border-border p-5 text-center text-muted-foreground text-sm">
          Net worth trend will appear after 2 monthly snapshots. Visit this page each month to record your progress.
        </div>
      )}

      {/* Allocation Donut + Health Score */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Allocation Donut */}
        {pieData.length > 0 && (
          <ChartCard title="Asset Allocation" subtitle="Across all asset classes">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name} ${value}%`}>
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={ALLOC_COLORS[idx % ALLOC_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Financial Health Score */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-border p-5 flex flex-col items-center justify-center"
          style={{ background: isDark ? "#111827" : "#ffffff" }}
        >
          <ShieldCheck className="w-6 h-6 mb-2" style={{ color: scoreColor }} />
          <p className="text-sm font-medium text-muted-foreground mb-3">Financial Health Score</p>

          {/* Score Ring */}
          <div className="relative w-32 h-32">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke={isDark ? "#1f2937" : "#e5e7eb"} strokeWidth="10" />
              <circle
                cx="60" cy="60" r="50" fill="none"
                stroke={scoreColor}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(healthScore / 100) * 314} 314`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold text-foreground">{healthScore}</span>
              <span className="text-[11px] text-muted-foreground">/100</span>
            </div>
          </div>

          <p className="mt-3 text-sm font-semibold" style={{ color: scoreColor }}>{scoreLabel}</p>
          <p className="text-[11px] text-muted-foreground mt-1 text-center max-w-[200px]">
            Based on savings rate, debt ratio, emergency fund, and diversification.
          </p>
        </motion.div>
      </div>

      {/* Detailed Breakdown */}
      <div
        className="rounded-2xl border border-border p-5 space-y-3"
        style={{ background: isDark ? "#111827" : "#ffffff" }}
      >
        <h3 className="text-sm font-bold text-foreground">Detailed Breakdown</h3>
        <div className="space-y-2">
          {[
            { label: "Bank Accounts", value: netWorthData.total_accounts, type: "asset" },
            { label: "Investments", value: netWorthData.total_investments, type: "asset" },
            { label: "Lent (Receivable)", value: netWorthData.total_lent, type: "asset" },
            { label: "Credit Card Debt", value: netWorthData.total_cc_outstanding, type: "liability" },
            { label: "Borrowed", value: netWorthData.total_borrowed, type: "liability" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className={`text-sm font-semibold ${item.type === "liability" ? "text-red-500" : "text-foreground"}`}>
                {item.type === "liability" ? "−" : "+"}₹{item.value.toLocaleString("en-IN")}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-sm font-bold text-foreground">Net Worth</span>
            <span className="text-sm font-bold text-brand">₹{netWorthData.net_worth.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
