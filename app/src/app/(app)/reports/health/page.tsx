"use client";

import { useMemo } from "react";
import { useData } from "@/providers/DataProvider";
import { useInvestments } from "@/hooks/useInvestments";
import {
  calculateNetWorth,
  calculatePortfolioAllocation,
  calculateSavingsRateFromAggregates,
  calculateCCUtilization,
} from "@/utils/calculations";
import { useTheme } from "@/providers/ThemeProvider";
import { Heart, ShieldCheck, PiggyBank, CreditCard, Landmark, PieChart as PieIcon, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import ExportBar from "@/components/ExportBar";

interface Pillar {
  name: string;
  icon: LucideIcon;
  score: number;
  maxScore: number;
  status: string;
  color: string;
  advice: string;
}

export default function FinancialHealthPage() {
  const { accounts, currentAggregate } = useData();
  const { investments } = useInvestments();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const savingsData = useMemo(
    () => calculateSavingsRateFromAggregates(currentAggregate || {}),
    [currentAggregate]
  );

  const netWorthData = useMemo(
    () => calculateNetWorth(accounts, investments, []),
    [accounts, investments]
  );

  const allocation = useMemo(
    () => calculatePortfolioAllocation(accounts, investments),
    [accounts, investments]
  );

  const ccMetrics = useMemo(
    () => calculateCCUtilization(accounts),
    [accounts]
  );

  // Calculate individual pillar scores
  const pillars: Pillar[] = useMemo(() => {
    // 1. Savings Rate (0-30 pts) — includes investment as productive savings
    const savingsRate = savingsData.savings_rate || 0;
    const investmentSpend = savingsData.investmentSpend || 0;
    const savingsScore = Math.min(30, Math.round((savingsRate / 20) * 30));
    const savingsStatus = savingsRate >= 20 ? "Excellent" : savingsRate >= 10 ? "Fair" : "Needs Work";
    const savingsColor = savingsRate >= 20 ? "#10b981" : savingsRate >= 10 ? "#f59e0b" : "#ef4444";
    const investNote = investmentSpend > 0 ? ` (includes ₹${investmentSpend.toLocaleString("en-IN")} in investments)` : "";
    const savingsAdvice = savingsRate >= 20
      ? `Saving ${savingsRate.toFixed(0)}% — well above the 20% target${investNote}.`
      : savingsRate >= 10
      ? `Saving ${savingsRate.toFixed(0)}%${investNote}. Aim for 20%+ by cutting discretionary spending.`
      : `Only saving ${savingsRate.toFixed(0)}%. Review subscriptions and dining out expenses.`;

    // 2. Debt Health (0-30 pts)
    const totalDebt = netWorthData.total_cc_outstanding || 0;
    const totalAssets = (netWorthData.total_accounts || 0) + (netWorthData.total_investments || 0);
    const debtRatio = totalAssets > 0 ? totalDebt / totalAssets : totalDebt > 0 ? 1 : 0;
    const debtScore = Math.max(0, Math.round(30 - debtRatio * 60));
    const _avgUtil = ccMetrics.length > 0 ? ccMetrics.reduce((s, c) => s + c.utilization_percentage, 0) / ccMetrics.length : 0;
    const debtStatus = debtScore >= 25 ? "Excellent" : debtScore >= 15 ? "Fair" : "Needs Work";
    const debtColor = debtScore >= 25 ? "#10b981" : debtScore >= 15 ? "#f59e0b" : "#ef4444";
    const highUtilCards = ccMetrics.filter((c) => c.utilization_percentage > 30);
    const debtAdvice = highUtilCards.length > 0
      ? `${highUtilCards.length} card(s) above 30% utilization. Pay down ₹${Math.round(highUtilCards.reduce((s, c) => s + Math.max(0, c.outstanding - c.credit_limit * 0.3), 0)).toLocaleString("en-IN")} to fix.`
      : totalDebt > 0
      ? `CC outstanding: ₹${totalDebt.toLocaleString("en-IN")}. Keep utilization below 30%.`
      : "No credit card debt. Excellent!";

    // 3. Emergency Fund (0-20 pts)
    const monthlyExpenses = savingsData.expenses || 0;
    const targetEmergency = monthlyExpenses > 0 ? monthlyExpenses * 3 : 50000;
    const currentCash = allocation.totals?.Cash || 0;
    const emergencyScore = Math.min(20, Math.round((currentCash / targetEmergency) * 20));
    const emergencyMonths = monthlyExpenses > 0 ? currentCash / monthlyExpenses : 0;
    const emergencyStatus = emergencyMonths >= 3 ? "Excellent" : emergencyMonths >= 1 ? "Fair" : "Needs Work";
    const emergencyColor = emergencyMonths >= 3 ? "#10b981" : emergencyMonths >= 1 ? "#f59e0b" : "#ef4444";
    const emergencyAdvice = emergencyMonths >= 6
      ? `${emergencyMonths.toFixed(1)} months of expenses covered. Well cushioned.`
      : emergencyMonths >= 3
      ? `${emergencyMonths.toFixed(1)} months covered. Consider building to 6 months.`
      : `Only ${emergencyMonths.toFixed(1)} months of runway. Target ₹${targetEmergency.toLocaleString("en-IN")} (3 months).`;

    // 4. Diversification (0-20 pts)
    const percentages = allocation.percentages || {};
    const maxAlloc = Math.max(percentages.Equity || 0, percentages.Debt || 0, percentages.Gold || 0, percentages.Crypto || 0);
    const diversScore = totalAssets > 0 ? (maxAlloc < 80 ? 20 : Math.max(0, Math.round(100 - maxAlloc))) : 0;
    const assetClasses = Object.values(percentages).filter((v) => v > 5).length;
    const diversStatus = diversScore >= 15 ? "Excellent" : diversScore >= 8 ? "Fair" : "Needs Work";
    const diversColor = diversScore >= 15 ? "#10b981" : diversScore >= 8 ? "#f59e0b" : "#ef4444";
    const diversAdvice = assetClasses >= 3
      ? `Spread across ${assetClasses} asset classes. Well diversified.`
      : totalAssets > 0
      ? `Concentrated in ${assetClasses} class(es). Consider adding Gold or Debt for balance.`
      : "No investments yet. Start with a diversified portfolio.";

    return [
      { name: "Savings Rate", icon: PiggyBank, score: savingsScore, maxScore: 30, status: savingsStatus, color: savingsColor, advice: savingsAdvice },
      { name: "Debt Health", icon: CreditCard, score: debtScore, maxScore: 30, status: debtStatus, color: debtColor, advice: debtAdvice },
      { name: "Emergency Fund", icon: Landmark, score: emergencyScore, maxScore: 20, status: emergencyStatus, color: emergencyColor, advice: emergencyAdvice },
      { name: "Diversification", icon: PieIcon, score: diversScore, maxScore: 20, status: diversStatus, color: diversColor, advice: diversAdvice },
    ];
  }, [savingsData, netWorthData, allocation, ccMetrics]);

  const totalScore = pillars.reduce((s, p) => s + p.score, 0);
  const overallColor = totalScore >= 70 ? "#10b981" : totalScore >= 40 ? "#f59e0b" : "#ef4444";
  const overallLabel = totalScore >= 70 ? "Excellent" : totalScore >= 40 ? "Good" : "Needs Attention";

  return (
    <div className="space-y-6">
      {/* Header with export */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Financial Health</h1>
        <ExportBar elementId="health-report" filename="financial-health" title="Financial Health Score" />
      </div>

      <div id="health-report" className="space-y-6">
      {/* Overall Score */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-border p-6 sm:p-8 flex flex-col items-center"
        style={{ background: isDark ? "#111827" : "#ffffff" }}
      >
        <Heart className="w-6 h-6 mb-3" style={{ color: overallColor }} />
        <p className="text-sm text-muted-foreground mb-4">Financial Health Score</p>

        {/* Score Ring */}
        <div className="relative w-36 h-36 mb-4">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" fill="none" stroke={isDark ? "#1f2937" : "#e5e7eb"} strokeWidth="10" />
            <circle
              cx="60" cy="60" r="50" fill="none"
              stroke={overallColor}
              strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${(totalScore / 100) * 314} 314`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-extrabold text-foreground">{totalScore}</span>
            <span className="text-xs text-muted-foreground">/100</span>
          </div>
        </div>

        <p className="text-lg font-bold" style={{ color: overallColor }}>{overallLabel}</p>
        <p className="text-xs text-muted-foreground mt-1 text-center max-w-sm">
          Based on savings discipline, debt management, emergency preparedness, and investment diversification.
        </p>
      </motion.div>

      {/* Pillar Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {pillars.map((pillar, idx) => {
          const Icon = pillar.icon;
          const pct = (pillar.score / pillar.maxScore) * 100;

          return (
            <motion.div
              key={pillar.name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="rounded-2xl border border-border p-5 space-y-3"
              style={{ background: isDark ? "#111827" : "#ffffff" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${pillar.color}20` }}>
                    <Icon className="w-4 h-4" style={{ color: pillar.color }} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{pillar.name}</h4>
                    <p className="text-[11px]" style={{ color: pillar.color }}>{pillar.status}</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-foreground">
                  {pillar.score}<span className="text-xs text-muted-foreground">/{pillar.maxScore}</span>
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, delay: idx * 0.1 }}
                  className="h-full rounded-full"
                  style={{ background: pillar.color }}
                />
              </div>

              {/* Advice */}
              <p className="text-xs text-muted-foreground">{pillar.advice}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Tips */}
      <div className="rounded-2xl border border-border p-5 space-y-3" style={{ background: isDark ? "#111827" : "#ffffff" }}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-brand" />
          <h3 className="text-sm font-bold text-foreground">How to Improve</h3>
        </div>
        <div className="space-y-2 text-sm">
          {pillars
            .filter((p) => p.score < p.maxScore * 0.7)
            .sort((a, b) => (a.score / a.maxScore) - (b.score / b.maxScore))
            .slice(0, 3)
            .map((p) => (
              <div key={p.name} className="flex items-start gap-2 py-1">
                <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: p.color }} />
                <div>
                  <span className="font-medium text-foreground">{p.name}: </span>
                  <span className="text-muted-foreground">{p.advice}</span>
                </div>
              </div>
            ))}
          {pillars.every((p) => p.score >= p.maxScore * 0.7) && (
            <p className="text-muted-foreground">All pillars are in good shape. Keep up the great work!</p>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
