"use client";

import { useState, useMemo } from "react";
import { useData } from "@/providers/DataProvider";
import { getRecentFinancialMonths } from "@/utils/financialMonth";
import { fmt } from "@/utils/format";
import { useTheme } from "@/providers/ThemeProvider";
import { Tags, TrendingUp, TrendingDown, ChevronRight, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { motion, AnimatePresence } from "framer-motion";

const SKIP_CATS = new Set(["Transfer", "Credit Card Payment", "Income"]);

export default function CategoriesPage() {
  const { transactions, cycleStartDay } = useData();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const recentCycles = useMemo(
    () => getRecentFinancialMonths(6, new Date(), cycleStartDay),
    [cycleStartDay]
  );

  const currentCycle = recentCycles[0];
  const _previousCycle = recentCycles[1];

  // Per-cycle category breakdown
  const cycleBreakdowns = useMemo(() => {
    return recentCycles.map((cycle) => {
      const txns = transactions.filter(
        (t) =>
          t.date >= cycle.startDate &&
          t.date <= cycle.endDate &&
          t.amount < 0 &&
          !SKIP_CATS.has(t.category) &&
          t.payment_type !== "Self Transfer"
      );
      const breakdown: Record<string, number> = {};
      txns.forEach((t) => {
        breakdown[t.category] = (breakdown[t.category] || 0) + Math.abs(t.amount);
      });
      return { cycle, breakdown };
    });
  }, [recentCycles, transactions]);

  // Current cycle category data sorted by amount
  const currentBreakdown = cycleBreakdowns[0]?.breakdown || {};
  const previousBreakdown = cycleBreakdowns[1]?.breakdown || {};

  const categories = useMemo(() => {
    const allCats = new Set([...Object.keys(currentBreakdown), ...Object.keys(previousBreakdown)]);
    return Array.from(allCats)
      .map((cat) => {
        const current = currentBreakdown[cat] || 0;
        const previous = previousBreakdown[cat] || 0;
        const change = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
        return { category: cat, current, previous, change, delta: current - previous };
      })
      .sort((a, b) => b.current - a.current);
  }, [currentBreakdown, previousBreakdown]);

  const totalCurrent = categories.reduce((s, c) => s + c.current, 0);

  // Trend data for selected category
  const trendData = useMemo(() => {
    if (!selectedCategory) return [];
    return cycleBreakdowns
      .map((cb) => ({
        label: cb.cycle.label.split(" ")[0].slice(0, 3),
        amount: Math.round(cb.breakdown[selectedCategory] || 0),
      }))
      .reverse();
  }, [selectedCategory, cycleBreakdowns]);

  // Transactions for selected category in current cycle
  const categoryTxns = useMemo(() => {
    if (!selectedCategory) return [];
    return transactions
      .filter(
        (t) =>
          t.date >= currentCycle.startDate &&
          t.date <= currentCycle.endDate &&
          t.category === selectedCategory &&
          t.amount < 0 &&
          t.payment_type !== "Self Transfer"
      )
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 15);
  }, [selectedCategory, transactions, currentCycle]);

  // Top growing and improving categories
  const topGrowing = useMemo(
    () => categories.filter((c) => c.change > 10 && c.delta > 200).sort((a, b) => b.delta - a.delta).slice(0, 3),
    [categories]
  );
  const topImproved = useMemo(
    () => categories.filter((c) => c.change < -10 && Math.abs(c.delta) > 200).sort((a, b) => a.delta - b.delta).slice(0, 3),
    [categories]
  );

  return (
    <div className="space-y-6">
      {/* Growth / Improvement highlights */}
      {(topGrowing.length > 0 || topImproved.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {topGrowing.length > 0 && (
            <div className="rounded-2xl border border-border p-4" style={{ background: isDark ? "#111827" : "#ffffff" }}>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-red-500" />
                <h3 className="text-sm font-bold text-foreground">Spending Up</h3>
              </div>
              {topGrowing.map((c) => (
                <div key={c.category} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-foreground">{c.category}</span>
                  <span className="text-xs font-medium text-red-500">+{c.change.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}
          {topImproved.length > 0 && (
            <div className="rounded-2xl border border-border p-4" style={{ background: isDark ? "#111827" : "#ffffff" }}>
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-bold text-foreground">Spending Down</h3>
              </div>
              {topImproved.map((c) => (
                <div key={c.category} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-foreground">{c.category}</span>
                  <span className="text-xs font-medium text-emerald-500">{c.change.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Category List */}
      <div className="rounded-2xl border border-border overflow-hidden" style={{ background: isDark ? "#111827" : "#ffffff" }}>
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-bold text-foreground">Categories — {currentCycle.label}</h3>
        </div>
        <div className="divide-y divide-border">
          {categories.map((cat) => {
            const pct = totalCurrent > 0 ? (cat.current / totalCurrent) * 100 : 0;
            const isSelected = selectedCategory === cat.category;

            return (
              <div key={cat.category}>
                <button
                  onClick={() => setSelectedCategory(isSelected ? null : cat.category)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Tags className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{cat.category}</p>
                      <p className="text-[11px] text-muted-foreground">{pct.toFixed(1)}% of total</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">{fmt(cat.current)}</p>
                      {cat.previous > 0 && (
                        <div className="flex items-center gap-0.5 justify-end">
                          {cat.change > 0 ? (
                            <ArrowUpRight className="w-3 h-3 text-red-500" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3 text-emerald-500" />
                          )}
                          <span className={`text-[11px] font-medium ${cat.change > 0 ? "text-red-500" : "text-emerald-500"}`}>
                            {Math.abs(cat.change).toFixed(0)}%
                          </span>
                        </div>
                      )}
                    </div>
                    <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isSelected ? "rotate-90" : ""}`} />
                  </div>
                </button>

                {/* Expanded: Trend + Transactions */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-border bg-muted/30"
                    >
                      <div className="p-4 space-y-4">
                        {/* 6-cycle trend */}
                        {trendData.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">6-Cycle Trend</p>
                            <ResponsiveContainer width="100%" height={100}>
                              <BarChart data={trendData}>
                                <XAxis dataKey="label" tick={{ fontSize: 10, fill: isDark ? "#9ca3af" : "#6b7280" }} />
                                <Tooltip contentStyle={{ background: isDark ? "#1f2937" : "#fff", border: "none", borderRadius: 8 }} formatter={(v) => [fmt(Number(v)), ""]} />
                                <Bar dataKey="amount" fill="#1abf94" radius={[3, 3, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                        {/* Recent transactions */}
                        {categoryTxns.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">Recent Transactions</p>
                            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                              {categoryTxns.map((t, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs py-1">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-muted-foreground">
                                      {new Date(t.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                    </span>
                                    <span className="text-foreground truncate max-w-[150px]">{t.notes || t.category}</span>
                                  </div>
                                  <span className="font-medium text-foreground">{fmt(Math.abs(t.amount))}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
