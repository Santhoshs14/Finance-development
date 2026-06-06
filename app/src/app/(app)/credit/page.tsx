"use client";

import { useMemo } from "react";
import { useData } from "@/providers/DataProvider";
import { getFinancialCycle, getRecentFinancialMonths } from "@/utils/financialMonth";
import { calculateCreditCardHealth } from "@/utils/calculations";
import { fmt } from "@/utils/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Badge, Progress } from "@/components/ui";
import { CreditCard, AlertTriangle, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { SkeletonCard } from "@/components/SkeletonLoader";

export default function CreditCardsOverview() {
  const { creditCards, transactions, cycleStartDay, dataReady } = useData();
  const currentCycle = useMemo(() => getFinancialCycle(new Date(), cycleStartDay), [cycleStartDay]);

  const totalLimit = creditCards.reduce((s, c) => s + parseFloat(String(c.credit_limit || 0)), 0);
  const totalOutstanding = creditCards.reduce((s, c) => s + parseFloat(String(c.liability || c.balance || 0)), 0);
  const totalAvailable = totalLimit - totalOutstanding;
  const overallUtilization = totalLimit > 0 ? (totalOutstanding / totalLimit) * 100 : 0;

  // Per-card stats
  const cardStats = useMemo(() => {
    return creditCards.map((cc) => {
      const health = calculateCreditCardHealth(cc, creditCards);
      const limit = parseFloat(String(cc.credit_limit || 0));
      const outstanding = parseFloat(String(cc.liability || cc.balance || 0));
      const available = limit - outstanding;

      // Cycle spending for this card
      const cycleSpend = transactions
        .filter((t) => t.account_id === cc.id && t.date >= currentCycle.startDate && t.date <= currentCycle.endDate && t.amount < 0)
        .reduce((s, t) => s + Math.abs(t.amount), 0);

      return {
        ...cc,
        limit,
        outstanding,
        available,
        utilization: health.utilization,
        cycleSpend,
        dueDate: (cc as unknown as Record<string, unknown>).due_days_after ? `${(cc as unknown as Record<string, unknown>).due_days_after} days after billing` : "N/A",
      };
    });
  }, [creditCards, transactions, currentCycle]);

  // Monthly CC spend trend
  const spendTrend = useMemo(() => {
    const cycles = getRecentFinancialMonths(6, new Date(), cycleStartDay);
    return cycles.map((cycle) => {
      const spend = transactions
        .filter((t) => creditCards.some((c) => c.id === t.account_id) && t.amount < 0 && t.date >= cycle.startDate && t.date <= cycle.endDate && t.category !== "Credit Card Payment")
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      return { label: cycle.label.split(" ")[0], spend };
    }).reverse();
  }, [transactions, creditCards, cycleStartDay]);

  if (!dataReady) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={2} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} lines={4} />)}
        </div>
      </div>
    );
  }

  if (creditCards.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <CreditCard className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <p className="text-lg font-semibold text-foreground">No Credit Cards</p>
          <p className="text-sm text-muted-foreground mt-1">Add a credit card from Settings to get started.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">Total Limit</span>
            <p className="text-xl font-bold text-foreground mt-1">{fmt(totalLimit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">Outstanding</span>
            <p className="text-xl font-bold text-danger mt-1">{fmt(totalOutstanding)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">Available</span>
            <p className="text-xl font-bold text-success mt-1">{fmt(totalAvailable)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">Utilization</span>
            <p className={cn("text-xl font-bold mt-1", overallUtilization > 50 ? "text-danger" : overallUtilization > 30 ? "text-warning" : "text-success")}>
              {overallUtilization.toFixed(1)}%
            </p>
            <Progress
              value={overallUtilization}
              className="mt-2 h-1.5"
              indicatorClassName={overallUtilization > 50 ? "bg-danger" : overallUtilization > 30 ? "bg-warning" : "bg-success"}
            />
          </CardContent>
        </Card>
      </div>

      {/* Per-Card Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {cardStats.map((card) => (
          <Card key={card.id} className="group hover:border-brand/30 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-accent flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{card.account_name}</p>
                    <p className="text-[11px] text-muted-foreground">Limit: {fmt(card.limit)}</p>
                  </div>
                </div>
                <Badge variant={card.utilization > 50 ? "danger" : card.utilization > 30 ? "warning" : "success"}>
                  {card.utilization.toFixed(0)}%
                </Badge>
              </div>

              {/* Usage bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Used: {fmt(card.outstanding)}</span>
                  <span>Available: {fmt(card.available)}</span>
                </div>
                <Progress
                  value={card.utilization}
                  className="h-2.5 rounded-full"
                  indicatorClassName={cn("rounded-full", card.utilization > 50 ? "bg-danger" : card.utilization > 30 ? "bg-warning" : "bg-success")}
                />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">This Cycle</p>
                  <p className="text-sm font-semibold text-foreground">{fmt(card.cycleSpend)}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Outstanding</p>
                  <p className="text-sm font-semibold text-danger">{fmt(card.outstanding)}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Due</p>
                  <p className="text-sm font-semibold text-foreground">{card.dueDate}</p>
                </div>
              </div>

              {/* Alerts */}
              {card.utilization > 50 && (
                <div className="mt-3 flex items-center gap-2 text-[11px] text-warning bg-warning/5 p-2 rounded-lg border border-warning/20">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>High utilization — consider paying down to reduce credit score impact</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly CC Spend Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" /> CC Spend Trend (6 Cycles)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spendTrend}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Bar dataKey="spend" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
