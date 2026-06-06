"use client";

import { useMemo } from "react";
import { useData } from "@/providers/DataProvider";
import { getRecentFinancialMonths } from "@/utils/financialMonth";
import { calculateCreditCardHealth } from "@/utils/calculations";
import { fmt } from "@/utils/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Progress } from "@/components/ui";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Lightbulb, TrendingUp, AlertTriangle, CreditCard } from "lucide-react";
import { SkeletonCard } from "@/components/SkeletonLoader";

export default function CCInsightsPage() {
  const { creditCards, transactions, cycleStartDay, dataReady } = useData();

  const cycles = useMemo(() => getRecentFinancialMonths(6, new Date(), cycleStartDay), [cycleStartDay]);

  // CC spending trend over last 6 cycles
  const spendingTrend = useMemo(() => {
    return cycles.map((c) => {
      const cycleSpend = transactions
        .filter((t) => t.date >= c.startDate && t.date <= c.endDate && (t.payment_type === "Credit Card" || creditCards.some((cc) => cc.id === t.account_id)) && t.amount < 0)
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      return { label: c.label.split(" ")[0].slice(0, 3), spend: cycleSpend };
    }).reverse();
  }, [transactions, creditCards, cycles]);

  // Per-card utilization insights
  const cardInsights = useMemo(() => {
    return creditCards.map((cc) => {
      const health = calculateCreditCardHealth(cc, creditCards);
      const limit = parseFloat(String(cc.credit_limit || 0));
      const outstanding = parseFloat(String(cc.liability || cc.balance || 0));
      return {
        name: cc.account_name,
        utilization: health.utilization,
        outstanding,
        limit,
        risk: health.utilization > 30,
      };
    });
  }, [creditCards]);

  // Generate insight messages
  const insights = useMemo(() => {
    const msgs: Array<{ type: "warning" | "success" | "info"; message: string }> = [];
    const totalUtil = creditCards.reduce((s, c) => s + parseFloat(String(c.liability || c.balance || 0)), 0) /
      Math.max(1, creditCards.reduce((s, c) => s + parseFloat(String(c.credit_limit || 0)), 0)) * 100;

    if (totalUtil > 30) msgs.push({ type: "warning", message: `Overall utilization is ${totalUtil.toFixed(0)}%. Aim to keep it below 30% for a healthy credit score.` });
    else msgs.push({ type: "success", message: `Good job! Your overall CC utilization is a healthy ${totalUtil.toFixed(0)}%.` });

    cardInsights.forEach((c) => {
      if (c.utilization > 70) msgs.push({ type: "warning", message: `${c.name} is at ${c.utilization.toFixed(0)}% utilization. Consider paying it down.` });
    });

    if (spendingTrend.length >= 2) {
      const last = spendingTrend[spendingTrend.length - 1].spend;
      const prev = spendingTrend[spendingTrend.length - 2].spend;
      if (prev > 0 && last > prev * 1.2) msgs.push({ type: "warning", message: "CC spending increased 20%+ vs last cycle." });
      else if (prev > 0 && last < prev * 0.8) msgs.push({ type: "success", message: "CC spending decreased significantly. Well done!" });
    }

    if (msgs.length === 0) msgs.push({ type: "info", message: "Your credit card usage looks healthy." });
    return msgs;
  }, [creditCards, cardInsights, spendingTrend]);

  if (!dataReady) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} lines={4} />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-brand" /> Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {insights.map((insight, i) => (
            <div key={i} className={cn("flex items-start gap-2 p-3 rounded-lg border", insight.type === "success" ? "bg-success/5 border-success/20" : insight.type === "warning" ? "bg-warning/5 border-warning/20" : "bg-info/5 border-info/20")}>
              {insight.type === "warning" ? <AlertTriangle className="w-4 h-4 text-warning mt-0.5" /> : <TrendingUp className="w-4 h-4 text-success mt-0.5" />}
              <p className="text-sm text-foreground">{insight.message}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Spending Trend */}
      <Card>
        <CardHeader>
          <CardTitle>CC Spending Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {spendingTrend.some((s) => s.spend > 0) ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spendingTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => fmt(Number(value))} />
                  <Bar dataKey="spend" fill="hsl(var(--brand))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No CC spending data yet</p>
          )}
        </CardContent>
      </Card>

      {/* Per-Card Utilization */}
      <Card>
        <CardHeader>
          <CardTitle>Card Utilization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cardInsights.map((card) => (
            <div key={card.name} className="flex items-center gap-3">
              <CreditCard className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-foreground truncate">{card.name}</span>
                  <span className={cn("text-xs font-semibold", card.utilization > 50 ? "text-danger" : card.utilization > 30 ? "text-warning" : "text-success")}>
                    {card.utilization.toFixed(0)}%
                  </span>
                </div>
                <Progress value={card.utilization} className="h-1.5" indicatorClassName={card.utilization > 50 ? "bg-danger" : card.utilization > 30 ? "bg-warning" : "bg-success"} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
