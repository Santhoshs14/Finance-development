"use client";

import { useState, useMemo } from "react";
import { useData } from "@/providers/DataProvider";
import { getRecentFinancialMonths } from "@/utils/financialMonth";
import { fmt } from "@/utils/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { Gift, CreditCard, TrendingUp, Sparkles, IndianRupee } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { SkeletonCard } from "@/components/SkeletonLoader";

// Default reward assumptions (typical Indian CC market). Used as fallbacks
// when a card has no per-card reward config set.
const DEFAULT_REWARD_RATE = 1; // base points per ₹100 spent
const CATEGORY_MULTIPLIERS: Record<string, number> = {
  Food: 2, Travel: 5, Shopping: 2, Entertainment: 3,
  Petrol: 2, Utilities: 1, Bills: 1, Subscription: 1,
};
const DEFAULT_POINT_VALUE = 0.25; // ₹ per reward point

export default function RewardsPage() {
  const { creditCards, transactions, cycleStartDay, dataReady } = useData();
  const [selectedCardId, setSelectedCardId] = useState<string>("all");

  const recentCycles = useMemo(() => getRecentFinancialMonths(6, new Date(), cycleStartDay), [cycleStartDay]);

  // Calculate rewards per card
  const rewardData = useMemo(() => {
    const cards = selectedCardId === "all" ? creditCards : creditCards.filter((c) => c.id === selectedCardId);

    // Per-card reward config (fall back to market-default assumptions).
    const cardRate = (cc: (typeof creditCards)[number]) =>
      cc.reward_rate && cc.reward_rate > 0 ? cc.reward_rate : DEFAULT_REWARD_RATE;
    const cardPointValue = (cc: (typeof creditCards)[number]) =>
      cc.point_value && cc.point_value > 0 ? cc.point_value : DEFAULT_POINT_VALUE;

    // Accumulated points balance the user has manually recorded per card.
    const pointsBalance = cards.reduce((s, cc) => s + (cc.reward_points_balance || 0), 0);

    // Per category spending and estimated rewards
    const categorySpend: Record<string, { spend: number; points: number; cashback: number }> = {};
    const cycleRewards: { label: string; points: number; cashback: number }[] = [];

    recentCycles.forEach((cycle) => {
      let cyclePoints = 0;
      let cycleCashback = 0;
      cards.forEach((cc) => {
        const baseRate = cardRate(cc);
        const pv = cardPointValue(cc);
        const txns = transactions.filter(
          (t) => t.account_id === cc.id && t.amount < 0 && t.date >= cycle.startDate && t.date <= cycle.endDate && t.category !== "Credit Card Payment"
        );
        txns.forEach((t) => {
          const amount = Math.abs(t.amount);
          const multiplier = CATEGORY_MULTIPLIERS[t.category] || 1;
          const points = Math.floor((amount / 100) * baseRate * multiplier);
          const cashback = points * pv;
          cyclePoints += points;
          cycleCashback += cashback;

          if (!categorySpend[t.category]) categorySpend[t.category] = { spend: 0, points: 0, cashback: 0 };
          categorySpend[t.category].spend += amount;
          categorySpend[t.category].points += points;
          categorySpend[t.category].cashback += cashback;
        });
      });
      cycleRewards.push({ label: cycle.label.split(" ")[0], points: cyclePoints, cashback: cycleCashback });
    });

    const totalPoints = Object.values(categorySpend).reduce((s, c) => s + c.points, 0);
    const totalSpend = Object.values(categorySpend).reduce((s, c) => s + c.spend, 0);
    const totalCashback = Object.values(categorySpend).reduce((s, c) => s + c.cashback, 0);
    const effectiveRate = totalSpend > 0 ? (totalCashback / totalSpend) * 100 : 0;

    // Best categories for rewards
    const categoryRanking = Object.entries(categorySpend)
      .map(([cat, data]) => ({
        category: cat,
        spend: data.spend,
        points: data.points,
        cashback: data.cashback,
        rate: data.spend > 0 ? (data.cashback / data.spend) * 100 : 0,
      }))
      .sort((a, b) => b.points - a.points);

    return { totalPoints, totalSpend, totalCashback, effectiveRate, categoryRanking, pointsBalance, cycleRewards: cycleRewards.reverse() };
  }, [creditCards, transactions, recentCycles, selectedCardId]);

  // Card optimization tips
  const tips = useMemo(() => {
    const suggestions: { category: string; tip: string }[] = [];
    rewardData.categoryRanking.slice(0, 5).forEach((cat) => {
      const multiplier = CATEGORY_MULTIPLIERS[cat.category] || 1;
      if (multiplier >= 3) {
        suggestions.push({ category: cat.category, tip: `Great! ${cat.category} earns ${multiplier}x points. Keep using CC here.` });
      } else if (cat.spend > 5000 && multiplier === 1) {
        suggestions.push({ category: cat.category, tip: `${cat.category} has standard rewards. Consider a card with better rates for this category.` });
      }
    });
    return suggestions;
  }, [rewardData]);

  if (!dataReady) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} lines={4} />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Card Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedCardId("all")}
          className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-all", selectedCardId === "all" ? "bg-brand/10 text-brand border-brand/30" : "border-border text-muted-foreground hover:bg-muted")}
        >
          All Cards
        </button>
        {creditCards.map((cc) => (
          <button key={cc.id} onClick={() => setSelectedCardId(cc.id)} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-all", selectedCardId === cc.id ? "bg-brand/10 text-brand border-brand/30" : "border-border text-muted-foreground hover:bg-muted")}>
            {cc.account_name}
          </button>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="border-brand/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-brand" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase">Points (6 cyc)</span>
            </div>
            <p className="text-lg font-bold text-brand">{rewardData.totalPoints.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Gift className="w-3.5 h-3.5 text-accent" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase">Points Balance</span>
            </div>
            <p className="text-lg font-bold text-accent">{rewardData.pointsBalance.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <IndianRupee className="w-3.5 h-3.5 text-success" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase">Cashback Value</span>
            </div>
            <p className="text-lg font-bold text-success">{fmt(rewardData.totalCashback)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-info" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase">Effective Rate</span>
            </div>
            <p className="text-lg font-bold text-info">{rewardData.effectiveRate.toFixed(2)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase">CC Spend</span>
            </div>
            <p className="text-lg font-bold text-foreground">{fmt(rewardData.totalSpend)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Points Earned Over Time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Points Earned (Last 6 Cycles)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rewardData.cycleRewards}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => Number(v).toLocaleString("en-IN")} />
                  <Bar dataKey="points" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category-wise Rewards */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rewards by Category</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2 max-h-[280px] overflow-y-auto">
            {rewardData.categoryRanking.slice(0, 10).map((cat) => (
              <div key={cat.category} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{cat.category}</p>
                    {(CATEGORY_MULTIPLIERS[cat.category] || 1) > 1 && (
                      <Badge variant="secondary" className="text-[9px] px-1.5">
                        {CATEGORY_MULTIPLIERS[cat.category]}x
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Spent: {fmt(cat.spend)} · Rate: {cat.rate.toFixed(2)}%</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-brand">{cat.points.toLocaleString("en-IN")} pts</p>
                  <p className="text-[10px] text-success">≈ {fmt(cat.cashback)}</p>
                </div>
              </div>
            ))}
            {rewardData.categoryRanking.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No CC spending data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Optimization Tips */}
      {tips.length > 0 && (
        <Card className="border-brand/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gift className="w-4 h-4 text-brand" /> Card Optimization Tips
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            {tips.map((t, i) => (
              <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/50">
                <Sparkles className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">{t.category}</p>
                  <p className="text-[11px] text-muted-foreground">{t.tip}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
