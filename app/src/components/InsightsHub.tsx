"use client";

import { useMemo } from "react";
import { useData } from "@/providers/DataProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { MoneyFlowSankey, CashflowWaterfall } from "@/components/charts";
import { getFinancialCycle } from "@/utils/financialMonth";
import { detectSubscriptions } from "@/utils/subscriptions";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { Badge } from "@/components/ui";
import { Sparkles } from "lucide-react";

interface InsightsHubProps {
  /** Optional cycleKey override; defaults to current cycle. */
  cycleKey?: string;
}

/**
 * Drop-in insights panel — shows money flow Sankey, cashflow waterfall,
 * and detected subscriptions for the current (or provided) cycle.
 */
export function InsightsHub(_props: InsightsHubProps) {
  const { transactions, cycleStartDay, currentAggregate } = useData();

  const cycle = useMemo(() => getFinancialCycle(new Date(), cycleStartDay), [cycleStartDay]);
  const cycleTxns = useMemo(
    () => transactions.filter((t) => t.date >= cycle.startDate && t.date <= cycle.endDate),
    [transactions, cycle]
  );

  // Income source map (default income category split)
  const incomeBySource = useMemo<Record<string, number>>(() => {
    const sources: Record<string, number> = {};
    for (const t of cycleTxns) {
      if (t.type !== "income") continue;
      const key = t.notes?.trim() || t.description?.trim() || "Other income";
      sources[key] = (sources[key] ?? 0) + Math.abs(t.amount);
    }
    if (Object.keys(sources).length === 0) {
      // Fall back to the aggregate's income total as a single bucket.
      const income = currentAggregate.totalIncome ?? 0;
      if (income > 0) sources["Salary"] = income;
    }
    return sources;
  }, [cycleTxns, currentAggregate.totalIncome]);

  const expensesByCategory = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(currentAggregate.categoryBreakdown ?? {})) {
      if (k === "Income" || v <= 0) continue;
      out[k] = v;
    }
    return out;
  }, [currentAggregate.categoryBreakdown]);

  const waterfall = useMemo(() => {
    const income = currentAggregate.totalIncome ?? 0;
    const spent = currentAggregate.totalSpent ?? 0;
    return [
      { name: "Opening", value: 0, type: "total" as const },
      { name: "Income", value: income },
      { name: "Expenses", value: -spent },
      { name: "Net", value: income - spent, type: "total" as const },
    ];
  }, [currentAggregate]);

  const subscriptions = useMemo(() => {
    const last6mo = transactions.filter((t) => {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 6);
      return new Date(t.date) >= cutoff;
    });
    return detectSubscriptions(
      last6mo.map((t) => ({
        date: t.date,
        amount: t.type === "expense" ? -Math.abs(t.amount) : Math.abs(t.amount),
        category: t.category,
        notes: t.notes,
        description: t.description,
      }))
    ).slice(0, 5);
  }, [transactions]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card variant="glass" className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Money flow this cycle</CardTitle>
        </CardHeader>
        <CardContent>
          <MoneyFlowSankey
            incomeBySource={incomeBySource}
            expensesByCategory={expensesByCategory}
            height={300}
          />
        </CardContent>
      </Card>

      <Card variant="default">
        <CardHeader>
          <CardTitle>Cashflow waterfall</CardTitle>
        </CardHeader>
        <CardContent>
          <CashflowWaterfall entries={waterfall} height={220} />
        </CardContent>
      </Card>

      <Card variant="default">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand" />
            Detected subscriptions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recurring patterns found yet — needs at least 3 occurrences.
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
              {subscriptions.map((s) => (
                <li key={s.merchant} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium text-sm">{s.merchant}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.frequency} · next ~{s.nextExpected} ·{" "}
                      <Badge variant="outline">{s.category}</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <AnimatedCounter
                      value={s.meanAmount}
                      signColor="never"
                      className="text-sm font-semibold"
                    />
                    <div className="text-[10px] text-muted-foreground">
                      conf {Math.round(s.confidence * 100)}%
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default InsightsHub;
