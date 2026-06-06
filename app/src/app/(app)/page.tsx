"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts";
import CountUp from "react-countup";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useData } from "@/providers/DataProvider";
import { useAuth } from "@/providers/AuthProvider";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { transactionsAPI } from "@/services/api";
import { getFinancialCycle, getCycleDayInfo, getRecentFinancialMonths } from "@/utils/financialMonth";
import { calculateCreditCardHealth } from "@/utils/calculations";
import { generateSmartInsights } from "@/utils/insights";
import { fmt } from "@/utils/format";
import QuickAddTransaction from "@/components/QuickAddTransaction";
import { SortableWidget } from "@/components/SortableWidget";
import { SkeletonCard } from "@/components/SkeletonLoader";
import { useDashboardLayout, WIDGET_IDS, WIDGET_LABELS, type WidgetId } from "@/hooks/useDashboardLayout";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Progress } from "@/components/ui";
import {
  TrendingUp, TrendingDown, Wallet, Landmark, PiggyBank,
  CreditCard, BarChart3, Plus, ArrowUpRight, ArrowDownRight,
  AlertTriangle, CheckCircle2, Zap, Target,
  ArrowLeftRight, CircleDot, Settings2,
} from "lucide-react";

/* ─── KPI Widget ─── */
function KpiStrip({ items }: { items: Array<{ label: string; value: number; icon: React.ReactNode; trend?: number; isPercent?: boolean; color: string }> }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((item) => (
        <Card key={item.label} className="group hover:border-brand/30 transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {item.label}
              </span>
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors", `bg-[${item.color}]/10`)} style={{ backgroundColor: `${item.color}15` }}>
                {item.icon}
              </div>
            </div>
            <p className="text-xl font-bold tracking-tight text-foreground">
              {item.isPercent ? (
                <CountUp end={item.value} decimals={1} suffix="%" duration={1} />
              ) : (
                <CountUp end={item.value} decimals={0} duration={1} formattingFn={(n) => "₹" + new Intl.NumberFormat("en-IN").format(n)} />
              )}
            </p>
            {item.trend !== undefined && item.trend !== 0 && (
              <div className="flex items-center gap-1 mt-1.5">
                {item.trend > 0 ? (
                  <ArrowUpRight className="w-3 h-3 text-success" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 text-danger" />
                )}
                <span className="text-[11px] font-medium text-muted-foreground">
                  {Math.abs(item.trend).toFixed(1)}% vs last
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ─── Health Gauge ─── */
function HealthGauge({ score }: { score: number }) {
  const getLabel = (s: number) => s >= 80 ? "Excellent" : s >= 60 ? "Good" : s >= 40 ? "Average" : "Poor";
  const getColor = (s: number) => s >= 80 ? "var(--color-success)" : s >= 60 ? "hsl(var(--brand))" : s >= 40 ? "var(--color-warning)" : "var(--color-danger)";
  const color = getColor(score);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-[130px] h-[75px] overflow-hidden">
        <svg width="130" height="75" viewBox="0 0 130 75" className="absolute top-0 left-0">
          <path d="M 10 65 A 55 55 0 0 1 120 65" className="stroke-muted" strokeWidth="10" fill="none" strokeLinecap="round" />
          <path d="M 10 65 A 55 55 0 0 1 120 65" stroke={color} strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={`${(score / 100) * 173} 173`} className="transition-all duration-1000" />
        </svg>
        <div className="absolute bottom-2 left-0 right-0 text-center text-2xl font-bold text-foreground">{score}</div>
      </div>
      <Badge variant={score >= 60 ? "success" : score >= 40 ? "warning" : "danger"}>
        {getLabel(score)}
      </Badge>
    </div>
  );
}

/* ─── Cycle Progress Ring ─── */
function CycleProgressRing({ daysElapsed, totalDays, dailyBudgetLeft }: { daysElapsed: number; totalDays: number; dailyBudgetLeft: number }) {
  const progress = (daysElapsed / totalDays) * 100;
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (progress / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" className="stroke-muted" strokeWidth="8" fill="none" />
          <circle cx="50" cy="50" r="40" className="stroke-brand transition-all duration-1000" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-foreground">{daysElapsed}</span>
          <span className="text-[10px] text-muted-foreground">/ {totalDays}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs text-muted-foreground">{totalDays - daysElapsed} days left</p>
        <p className="text-sm font-semibold text-foreground mt-0.5">
          {fmt(dailyBudgetLeft)}<span className="text-muted-foreground font-normal">/day</span>
        </p>
      </div>
    </div>
  );
}

/* ─── Spending Heatmap ─── */
function SpendingHeatmap({ transactions }: { transactions: Array<{ amount: number; date: string; category: string; payment_type?: string }> }) {
  const today = new Date();
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  const daysSet = new Set(days);
  const spendByDay: Record<string, number> = {};
  transactions.forEach((t) => {
    if (t.amount < 0 && daysSet.has(t.date) && t.category !== "Transfer" && !t.payment_type?.includes("Transfer") && t.category !== "Credit Card Payment") {
      spendByDay[t.date] = (spendByDay[t.date] || 0) + Math.abs(t.amount);
    }
  });
  const maxSpend = Math.max(...Object.values(spendByDay), 1);
  return (
    <div>
      <div className="grid grid-cols-10 gap-1">
        {days.map((day) => {
          const amt = spendByDay[day] || 0;
          const intensity = amt / maxSpend;
          const bg = amt === 0
            ? "bg-muted"
            : intensity > 0.7 ? "bg-danger" : intensity > 0.4 ? "bg-warning" : "bg-success";
          return (
            <div
              key={day}
              title={`${day}: ${fmt(amt)}`}
              className={cn("aspect-square rounded-[3px] transition-transform hover:scale-125", bg)}
              style={amt > 0 ? { opacity: 0.4 + intensity * 0.6 } : undefined}
            />
          );
        })}
      </div>
      <div className="flex gap-2 mt-2 items-center">
        <span className="text-[10px] text-muted-foreground">Less</span>
        <div className="w-2.5 h-2.5 rounded-sm bg-success opacity-50" />
        <div className="w-2.5 h-2.5 rounded-sm bg-warning opacity-70" />
        <div className="w-2.5 h-2.5 rounded-sm bg-danger" />
        <span className="text-[10px] text-muted-foreground">More</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { transactions, accounts, creditCards, categories, investments, cycleStartDay, currentAggregate, recurring, dataReady } = useData();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [goals, setGoals] = useState<Array<{ id: string; target_amount?: number; current_amount?: number }>>([]);
  const [mutualFunds, setMutualFunds] = useState<Array<{ id: string; current_nav?: string; units: string; invested_amount?: string }>>([]);
  const [lending, setLending] = useState<Array<{ id: string; type: string; amount: number; paid_amount?: number }>>([]);
  const [prevAggregate, setPrevAggregate] = useState<Record<string, number> | null>(null);
  const [pastAggregates, setPastAggregates] = useState<Array<{ cycleKey: string; label: string; totalSpent: number; totalIncome: number }>>([]);

  // Listen for keyboard shortcut "N" via custom event from CommandPalette
  useEffect(() => {
    const handler = () => setShowQuickAdd(true);
    document.addEventListener("quick-add-open", handler);
    return () => document.removeEventListener("quick-add-open", handler);
  }, []);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const unsubs = [
      onSnapshot(collection(db, `users/${uid}/goals`), (snap) => setGoals(snap.docs.map((d) => ({ id: d.id, ...d.data() } as typeof goals[0])))),
      onSnapshot(collection(db, `users/${uid}/mutualFunds`), (snap) => setMutualFunds(snap.docs.map((d) => ({ id: d.id, ...d.data() } as typeof mutualFunds[0])))),
      onSnapshot(collection(db, `users/${uid}/lending`), (snap) => setLending(snap.docs.map((d) => ({ id: d.id, ...d.data() } as typeof lending[0])))),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [user]);

  // Load past 6 cycle aggregates for trend chart
  useEffect(() => {
    if (!user) return;
    const cycles = getRecentFinancialMonths(6, new Date(), cycleStartDay);
    const unsubs = cycles.map((c) =>
      onSnapshot(doc(db, `users/${user.uid}/aggregates/${c.cycleKey}`), (snap) => {
        setPastAggregates((prev) => {
          const filtered = prev.filter((p) => p.cycleKey !== c.cycleKey);
          if (snap.exists()) {
            const data = snap.data();
            filtered.push({ cycleKey: c.cycleKey, label: c.label.split(" ")[0].slice(0, 3), totalSpent: data.totalSpent || 0, totalIncome: data.totalIncome || 0 });
          }
          return filtered.sort((a, b) => a.cycleKey.localeCompare(b.cycleKey));
        });
      })
    );
    return () => unsubs.forEach((fn) => fn());
  }, [user, cycleStartDay]);

  const currentCycle = useMemo(() => getFinancialCycle(new Date(), cycleStartDay), [cycleStartDay]);
  const cycleInfo = useMemo(() => getCycleDayInfo(new Date(), cycleStartDay), [cycleStartDay]);

  const prevCycleKey = useMemo(() => {
    const cycles = getRecentFinancialMonths(2, new Date(), cycleStartDay);
    return cycles.length > 1 ? cycles[1].cycleKey : null;
  }, [cycleStartDay]);

  useEffect(() => {
    if (!user || !prevCycleKey) return;
    const unsub = onSnapshot(doc(db, `users/${user.uid}/aggregates/${prevCycleKey}`), (snap) => {
      if (snap.exists()) setPrevAggregate(snap.data() as Record<string, number>);
      else setPrevAggregate(null);
    });
    return () => unsub();
  }, [user, prevCycleKey]);

  const bankAccounts = useMemo(() => accounts.filter((a) => a.type !== "credit"), [accounts]);
  const accountsBalance = bankAccounts.reduce((s, a) => s + (a.balance || 0), 0);
  const totalSavings = mutualFunds.reduce((s, mf) => {
    const val = mf.current_nav ? parseFloat(mf.current_nav) * parseFloat(mf.units) : parseFloat(mf.invested_amount || "0");
    return s + val;
  }, 0);
  const totalLiabilities = creditCards.reduce((s, cc) => s + parseFloat(String(cc.liability || cc.balance || 0)), 0)
    + lending.filter((l) => l.type === "borrowed").reduce((s, l) => s + ((l.amount || 0) - (l.paid_amount || 0)), 0);
  const netWorth = accountsBalance + totalSavings - totalLiabilities;

  const cycleTxns = useMemo(() => transactions.filter((t) => t.date >= currentCycle.startDate && t.date <= currentCycle.endDate), [transactions, currentCycle]);

  const cashFlow = useMemo(() => {
    let tIncome = 0, tExpense = 0;
    const skipCats = new Set(["Transfer", "Credit Card Payment"]);
    cycleTxns.forEach((t) => {
      if (t.payment_type === "Credit Card" || t.payment_type === "Self Transfer" || t.payment_type === "Transfer" || skipCats.has(t.category)) return;
      if (t.type === "income" || t.category === "Income") tIncome += Math.abs(t.amount);
      else if (t.amount < 0) tExpense += Math.abs(t.amount);
    });
    return { totalIncome: tIncome, totalExpenses: tExpense, netSavings: tIncome - tExpense, dailyAvgSpend: cycleInfo.daysElapsed > 0 ? tExpense / cycleInfo.daysElapsed : 0 };
  }, [cycleTxns, cycleInfo]);

  const savingsRate = cashFlow.totalIncome > 0 ? ((cashFlow.totalIncome - cashFlow.totalExpenses) / cashFlow.totalIncome) * 100 : 0;

  const categoryData = useMemo(() => {
    const map: Record<string, { name: string; value: number; color: string }> = {};
    cycleTxns.forEach((t) => {
      if (t.category === "Income" || t.amount >= 0 || t.category === "Transfer" || t.payment_type === "Credit Card" || t.payment_type?.includes("Transfer") || t.category === "Credit Card Payment") return;
      const col = categories.find((c) => c.name === t.category)?.color || "#94a3b8";
      if (!map[t.category]) map[t.category] = { name: t.category, value: 0, color: col };
      map[t.category].value += Math.abs(t.amount);
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [cycleTxns, categories]);

  const healthScore = useMemo(() => {
    let score = 0;
    score += Math.min(30, (savingsRate / 20) * 30);
    const totalCCLimit = creditCards.reduce((s, c) => s + parseFloat(String(c.credit_limit || 0)), 0);
    const totalCCOutstanding = creditCards.reduce((s, c) => s + parseFloat(String(c.liability || c.balance || 0)), 0);
    const ccUtil = totalCCLimit > 0 ? totalCCOutstanding / totalCCLimit : 0;
    score += Math.max(0, 25 - ccUtil * 83);
    score += 25;
    score += 10;
    return Math.max(0, Math.min(100, Math.round(score)));
  }, [savingsRate, creditCards]);

  const _riskAlerts = useMemo(() => {
    const alerts: Array<{ type: "danger" | "warning"; message: string }> = [];
    bankAccounts.forEach((a) => { if ((a.balance || 0) < 1000) alerts.push({ type: "danger", message: `Low balance: ${a.account_name} — ${fmt(a.balance || 0)}` }); });
    creditCards.forEach((cc) => {
      const health = calculateCreditCardHealth(cc, creditCards);
      if (health.utilization > 80) alerts.push({ type: "danger", message: `${cc.account_name} at ${health.utilization}% utilization` });
      else if (health.utilization > 50) alerts.push({ type: "warning", message: `${cc.account_name} at ${health.utilization}% utilization` });
    });
    return alerts.slice(0, 4);
  }, [bankAccounts, creditCards]);

  // Budget usage for top categories
  const budgetStatus = useMemo(() => {
    if (!currentAggregate?.categoryBreakdown) return [];
    const breakdown = currentAggregate.categoryBreakdown as Record<string, number>;
    return Object.entries(breakdown)
      .filter(([cat]) => cat !== "Income" && cat !== "Transfer" && cat !== "Credit Card Payment")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, spent]) => ({ category: cat, spent, color: categories.find((c) => c.name === cat)?.color || "#94a3b8" }));
  }, [currentAggregate, categories]);

  // CC overview
  const ccOverview = useMemo(() => {
    const totalLimit = creditCards.reduce((s, c) => s + parseFloat(String(c.credit_limit || 0)), 0);
    const totalOutstanding = creditCards.reduce((s, c) => s + parseFloat(String(c.liability || c.balance || 0)), 0);
    const utilization = totalLimit > 0 ? (totalOutstanding / totalLimit) * 100 : 0;
    return { totalLimit, totalOutstanding, available: totalLimit - totalOutstanding, utilization };
  }, [creditCards]);

  // Daily budget remaining
  const dailyBudgetLeft = useMemo(() => {
    const remaining = cashFlow.totalIncome - cashFlow.totalExpenses;
    const daysLeft = cycleInfo.totalDays - cycleInfo.daysElapsed;
    return daysLeft > 0 ? remaining / daysLeft : 0;
  }, [cashFlow, cycleInfo]);

  // Smart insights (enhanced)
  const insights = useMemo(() => {
    const _pastBreakdowns = pastAggregates
      .filter((p) => p.cycleKey !== currentCycle.cycleKey)
      .map((_p) => {
        // We only have totalSpent/totalIncome in pastAggregates, not full breakdowns
        // Use current aggregate breakdown as proxy for anomaly detection seed
        return {};
      });

    const smartInsights = generateSmartInsights({
      aggregate: currentAggregate,
      budgets: [],
      accounts,
      transactions: cycleTxns,
      recurring,
      income: cashFlow.totalIncome,
      daysElapsed: cycleInfo.daysElapsed,
      totalDays: cycleInfo.totalDays,
      savingsRate,
    });

    return smartInsights.slice(0, 5);
  }, [currentAggregate, accounts, cycleTxns, recurring, cashFlow, cycleInfo, savingsRate, pastAggregates, currentCycle]);

  // Recent transactions
  const recentTxns = useMemo(() => cycleTxns.slice(0, 8), [cycleTxns]);

  const addTxnMutation = useMutation({
    mutationFn: (data: unknown) => transactionsAPI.create(data as Parameters<typeof transactionsAPI.create>[0]),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["transactions"] }),
  });

  // Trends for KPI
  const getTrend = (current: number, prevKey: string) => {
    if (!prevAggregate || !(prevKey in prevAggregate) || prevAggregate[prevKey] === 0) return undefined;
    return ((current - prevAggregate[prevKey]) / prevAggregate[prevKey]) * 100;
  };

  // Dashboard DnD
  const { layout, reorder, isVisible, toggleVisibility } = useDashboardLayout();
  const [showWidgetPicker, setShowWidgetPicker] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorder(active.id as WidgetId, over.id as WidgetId);
    }
  }

  if (!dataReady) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} lines={2} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={5} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-muted-foreground">{currentCycle.label} · Day {cycleInfo.daysElapsed} of {cycleInfo.totalDays}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowWidgetPicker(true)} className="gap-1.5">
            <Settings2 className="w-3.5 h-3.5" /> Customize
          </Button>
          <Button onClick={() => setShowQuickAdd(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Add Transaction
          </Button>
        </div>
      </div>

      {/* Widget Picker Modal */}
      {showWidgetPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowWidgetPicker(false)}>
          <Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-5 space-y-3">
              <h3 className="text-base font-bold text-foreground">Dashboard Widgets</h3>
              <p className="text-xs text-muted-foreground">Toggle widgets on/off. Drag to reorder on the dashboard.</p>
              {WIDGET_IDS.map((id) => (
                <label key={id} className="flex items-center justify-between py-2 cursor-pointer">
                  <span className="text-sm text-foreground">{WIDGET_LABELS[id]}</span>
                  <input
                    type="checkbox"
                    checked={isVisible(id)}
                    onChange={() => toggleVisibility(id)}
                    className="h-4 w-4 rounded border-border accent-brand"
                  />
                </label>
              ))}
              <Button variant="outline" className="w-full mt-2" onClick={() => setShowWidgetPicker(false)}>Done</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sortable Widgets */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={layout.order} strategy={verticalListSortingStrategy}>
          {layout.order.map((widgetId) => {
            if (!isVisible(widgetId)) return null;
            return (
              <SortableWidget key={widgetId} id={widgetId}>
                {widgetId === "kpi-strip" && (
      <KpiStrip items={[
        { label: "Net Worth", value: netWorth, icon: <Wallet className="w-4 h-4" style={{ color: "#0080ff" }} />, color: "#0080ff" },
        { label: "Balance", value: accountsBalance, icon: <Landmark className="w-4 h-4" style={{ color: "#10b981" }} />, color: "#10b981" },
        { label: "Income", value: cashFlow.totalIncome, icon: <TrendingUp className="w-4 h-4" style={{ color: "#22c55e" }} />, color: "#22c55e", trend: getTrend(cashFlow.totalIncome, "totalIncome") },
        { label: "Expenses", value: cashFlow.totalExpenses, icon: <TrendingDown className="w-4 h-4" style={{ color: "#ef4444" }} />, color: "#ef4444", trend: getTrend(cashFlow.totalExpenses, "totalSpent") },
        { label: "Savings Rate", value: savingsRate, icon: <PiggyBank className="w-4 h-4" style={{ color: "#f59e0b" }} />, color: "#f59e0b", isPercent: true },
      ]} />
                )}
                {widgetId === "cash-flow-row" && (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Cash Flow Chart (2 cols) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cash Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { label: "Income", value: cashFlow.totalIncome, color: "text-success" },
                { label: "Expenses", value: cashFlow.totalExpenses, color: "text-danger" },
                { label: "Net", value: cashFlow.netSavings, color: cashFlow.netSavings >= 0 ? "text-success" : "text-danger" },
                { label: "Daily Avg", value: cashFlow.dailyAvgSpend, color: "text-warning" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">{label}</p>
                  <p className={cn("text-sm font-bold mt-0.5", color)}>{fmt(Math.abs(value))}</p>
                </div>
              ))}
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                <span>Cycle progress</span>
                <span>{cycleInfo.daysRemaining} days left</span>
              </div>
              <Progress value={(cycleInfo.daysElapsed / cycleInfo.totalDays) * 100} />
            </div>
          </CardContent>
        </Card>

        {/* Financial Health (1 col) */}
        <Card>
          <CardHeader>
            <CardTitle>Health Score</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <HealthGauge score={healthScore} />
          </CardContent>
        </Card>

        {/* Cycle Progress Ring (1 col) */}
        <Card>
          <CardHeader>
            <CardTitle>Cycle Progress</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <CycleProgressRing
              daysElapsed={cycleInfo.daysElapsed}
              totalDays={cycleInfo.totalDays}
              dailyBudgetLeft={dailyBudgetLeft}
            />
          </CardContent>
        </Card>
      </div>
                )}
                {widgetId === "category-row" && (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Spending by Category (1 col) */}
        <Card>
          <CardHeader>
            <CardTitle>By Category</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <>
                <div className="w-full" style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={categoryData.slice(0, 6)} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={3} dataKey="value" stroke="none">
                        {categoryData.slice(0, 6).map((item, i) => <Cell key={i} fill={item.color} />)}
                      </Pie>
                      <RTooltip formatter={(value) => fmt(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {categoryData.slice(0, 4).map((item) => (
                    <Badge key={item.name} variant="secondary" className="text-[10px] gap-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />
                      {item.name}
                    </Badge>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CircleDot className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-xs">No data yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Budget Status (1 col) */}
        <Card>
          <CardHeader>
            <CardTitle>Top Spending</CardTitle>
          </CardHeader>
          <CardContent>
            {budgetStatus.length > 0 ? (
              <div className="space-y-3">
                {budgetStatus.map((b) => (
                  <div key={b.category}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-foreground">{b.category}</span>
                      <span className="text-xs text-muted-foreground">{fmt(b.spent)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (b.spent / (cashFlow.totalExpenses || 1)) * 100)}%`, backgroundColor: b.color }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Target className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-xs">No spending yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Spending Trend (2 cols) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Spending Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {pastAggregates.length > 1 ? (
              <div className="w-full" style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={pastAggregates}>
                    <defs>
                      <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--brand))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--brand))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <RTooltip formatter={(value) => fmt(Number(value))} />
                    <Area type="monotone" dataKey="totalSpent" stroke="hsl(var(--brand))" fill="url(#spendGradient)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <BarChart3 className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-xs">Need more cycles for trends</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
                )}
                {widgetId === "activity-row" && (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Recent Transactions (2 cols) */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent Transactions</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => router.push("/money/transactions")} className="text-xs text-brand">
              View all
            </Button>
          </CardHeader>
          <CardContent>
            {recentTxns.length > 0 ? (
              <div className="space-y-1">
                {recentTxns.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", t.amount > 0 ? "bg-success/10" : "bg-danger/10")}>
                        {t.amount > 0 ? <ArrowUpRight className="w-4 h-4 text-success" /> : <ArrowDownRight className="w-4 h-4 text-danger" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{t.category}</p>
                        <p className="text-[11px] text-muted-foreground">{t.date}</p>
                      </div>
                    </div>
                    <span className={cn("text-sm font-semibold", t.amount > 0 ? "text-success" : "text-foreground")}>
                      {t.amount > 0 ? "+" : ""}{fmt(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <ArrowLeftRight className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-xs">No transactions yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Smart Insights (1 col) */}
        <Card>
          <CardHeader>
            <CardTitle>Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {insights.map((insight) => (
                <div
                  key={insight.id}
                  className={cn(
                    "flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors",
                    insight.type === "success" ? "bg-success/5 border-success/20 hover:bg-success/10" :
                    insight.type === "warning" ? "bg-warning/5 border-warning/20 hover:bg-warning/10" :
                    insight.type === "danger" ? "bg-danger/5 border-danger/20 hover:bg-danger/10" :
                    "bg-info/5 border-info/20 hover:bg-info/10"
                  )}
                  onClick={() => insight.actionPath && router.push(insight.actionPath)}
                >
                  {insight.type === "success" ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-success flex-shrink-0" /> :
                   insight.type === "warning" ? <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-warning flex-shrink-0" /> :
                   insight.type === "danger" ? <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-danger flex-shrink-0" /> :
                   <Zap className="w-3.5 h-3.5 mt-0.5 text-info flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-foreground">{insight.title}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{insight.message}</p>
                  </div>
                </div>
              ))}
              {insights.length === 0 && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg border bg-info/5 border-info/20">
                  <Zap className="w-3.5 h-3.5 mt-0.5 text-info flex-shrink-0" />
                  <p className="text-xs leading-relaxed text-foreground">Your finances are on track this cycle.</p>
                </div>
              )}
            </div>

            {/* Spending Heatmap (compact) */}
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">30-Day Heatmap</p>
              <SpendingHeatmap transactions={transactions} />
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions + CC Overview (1 col) */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { label: "Transaction", icon: Plus, action: () => setShowQuickAdd(true) },
                { label: "Pay CC", icon: CreditCard, action: () => router.push("/credit/statements") },
                { label: "Budgets", icon: Target, action: () => router.push("/spending/budgets") },
                { label: "Export", icon: BarChart3, action: () => router.push("/settings") },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-foreground"
                >
                  <item.icon className="w-4 h-4 text-brand" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              ))}
            </div>

            {/* CC Overview mini */}
            {creditCards.length > 0 && (
              <div className="pt-3 border-t border-border">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Credit Cards</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Utilization</span>
                    <span className="font-semibold text-foreground">{ccOverview.utilization.toFixed(0)}%</span>
                  </div>
                  <Progress
                    value={ccOverview.utilization}
                    indicatorClassName={ccOverview.utilization > 50 ? "bg-danger" : ccOverview.utilization > 30 ? "bg-warning" : "bg-success"}
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                    <span>Used: {fmt(ccOverview.totalOutstanding)}</span>
                    <span>Limit: {fmt(ccOverview.totalLimit)}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
                )}
              </SortableWidget>
            );
          })}
        </SortableContext>
      </DndContext>

      {showQuickAdd && (
        <QuickAddTransaction isOpen={showQuickAdd} onClose={() => setShowQuickAdd(false)} onSubmit={(data) => addTxnMutation.mutate(data)} accounts={accounts} creditCards={creditCards} categories={categories} investments={investments} />
      )}
    </div>
  );
}
