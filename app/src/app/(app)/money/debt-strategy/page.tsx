"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useData } from "@/providers/DataProvider";
import { fmt } from "@/utils/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Input, Badge, Progress } from "@/components/ui";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip,
} from "recharts";
import {
  TrendingDown,
  Zap,
  Snowflake,
  CreditCard,
  Calendar,
} from "lucide-react";

interface Debt {
  id: string;
  name: string;
  balance: number;
  rate: number; // annual interest rate %
  minPayment: number;
  type: "credit_card" | "loan" | "emi";
}

type Strategy = "avalanche" | "snowball";

function calculatePayoff(debts: Debt[], extraMonthly: number, strategy: Strategy) {
  if (debts.length === 0) return { months: 0, totalInterest: 0, timeline: [], order: [] };

  // Sort by strategy
  const sorted = [...debts].sort((a, b) =>
    strategy === "avalanche" ? b.rate - a.rate : a.balance - b.balance
  );

  // Simulate month by month
  const balances = new Map(sorted.map((d) => [d.id, d.balance]));
  const timeline: Array<{ month: number; remaining: number }> = [];
  const order: string[] = [];
  let totalInterest = 0;
  let month = 0;
  const MAX_MONTHS = 600; // 50 years safety

  while (month < MAX_MONTHS) {
    const totalRemaining = Array.from(balances.values()).reduce((s, b) => s + b, 0);
    if (totalRemaining <= 0) break;
    timeline.push({ month, remaining: Math.round(totalRemaining) });

    month++;
    let extraBudget = extraMonthly;

    // Apply interest + minimum payments
    for (const debt of sorted) {
      let bal = balances.get(debt.id) || 0;
      if (bal <= 0) continue;

      // Monthly interest
      const interest = bal * (debt.rate / 100 / 12);
      bal += interest;
      totalInterest += interest;

      // Minimum payment
      const minPay = Math.min(debt.minPayment, bal);
      bal -= minPay;
      balances.set(debt.id, Math.max(0, bal));
    }

    // Apply extra payment to highest-priority debt
    for (const debt of sorted) {
      let bal = balances.get(debt.id) || 0;
      if (bal <= 0) continue;

      const payment = Math.min(extraBudget, bal);
      bal -= payment;
      extraBudget -= payment;
      balances.set(debt.id, Math.max(0, bal));

      if (bal <= 0 && !order.includes(debt.id)) {
        order.push(debt.id);
      }
      if (extraBudget <= 0) break;
    }
  }

  timeline.push({ month, remaining: 0 });
  return { months: month, totalInterest: Math.round(totalInterest), timeline, order };
}

export default function DebtStrategyPage() {
  const { accounts: _accounts, creditCards } = useData();
  const [extraPayment, setExtraPayment] = useState("5000");
  const [debts, setDebts] = useState<Debt[]>(() => {
    // Auto-populate from credit cards with outstanding
    return creditCards
      .filter((cc) => (cc.liability || 0) > 0)
      .map((cc) => ({
        id: cc.id,
        name: cc.account_name,
        balance: cc.liability || 0,
        rate: 36, // Default CC rate in India
        minPayment: Math.max(500, Math.round((cc.liability || 0) * 0.05)),
        type: "credit_card" as const,
      }));
  });
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", balance: "", rate: "12", minPayment: "1000", type: "loan" });

  const addDebt = () => {
    if (!form.name || !form.balance) return;
    setDebts([...debts, {
      id: Date.now().toString(36),
      name: form.name,
      balance: parseFloat(form.balance) || 0,
      rate: parseFloat(form.rate) || 12,
      minPayment: parseFloat(form.minPayment) || 1000,
      type: form.type as Debt["type"],
    }]);
    setForm({ name: "", balance: "", rate: "12", minPayment: "1000", type: "loan" });
    setShowAdd(false);
  };

  const removeDebt = (id: string) => setDebts(debts.filter((d) => d.id !== id));

  const extra = parseFloat(extraPayment) || 0;
  const avalanche = useMemo(() => calculatePayoff(debts, extra, "avalanche"), [debts, extra]);
  const snowball = useMemo(() => calculatePayoff(debts, extra, "snowball"), [debts, extra]);

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const totalMinPayments = debts.reduce((s, d) => s + d.minPayment, 0);
  const interestSaved = snowball.totalInterest - avalanche.totalInterest;
  const monthsSaved = snowball.months - avalanche.months;

  // Chart data
  const chartData = useMemo(() => {
    const maxMonths = Math.max(avalanche.months, snowball.months, 1);
    const step = Math.max(1, Math.floor(maxMonths / 12));
    const data: Array<{ month: number; avalanche: number; snowball: number }> = [];
    for (let m = 0; m <= maxMonths; m += step) {
      const avEntry = avalanche.timeline.find((t) => t.month >= m) || { remaining: 0 };
      const snEntry = snowball.timeline.find((t) => t.month >= m) || { remaining: 0 };
      data.push({ month: m, avalanche: avEntry.remaining, snowball: snEntry.remaining });
    }
    return data;
  }, [avalanche, snowball]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Debt Payoff Strategy</h1>
          <p className="text-sm text-muted-foreground">Compare Avalanche vs Snowball methods</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
        >
          + Add Debt
        </button>
      </div>

      {/* Debt List */}
      {debts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Debts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {debts.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", d.type === "credit_card" ? "bg-danger/10" : "bg-warning/10")}>
                      {d.type === "credit_card" ? <CreditCard className="w-4 h-4 text-danger" /> : <Calendar className="w-4 h-4 text-warning" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{d.name}</p>
                      <p className="text-[11px] text-muted-foreground">{d.rate}% APR · Min: {fmt(d.minPayment)}/mo</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-foreground">{fmt(d.balance)}</span>
                    <button onClick={() => removeDebt(d.id)} className="text-muted-foreground hover:text-danger text-xs">×</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Extra monthly payment:</span>
              <Input
                type="number"
                value={extraPayment}
                onChange={(e) => setExtraPayment(e.target.value)}
                className="w-32"
                placeholder="5000"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {debts.length > 0 && (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-[11px] font-medium text-muted-foreground uppercase mb-1">Total Debt</p>
                <p className="text-xl font-bold text-danger">{fmt(totalDebt)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-[11px] font-medium text-muted-foreground uppercase mb-1">Monthly Minimum</p>
                <p className="text-xl font-bold text-foreground">{fmt(totalMinPayments)}</p>
              </CardContent>
            </Card>
            <Card className="border-success/20">
              <CardContent className="p-4">
                <p className="text-[11px] font-medium text-muted-foreground uppercase mb-1">Interest Saved (Avalanche)</p>
                <p className="text-xl font-bold text-success">{fmt(interestSaved)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-[11px] font-medium text-muted-foreground uppercase mb-1">Months Saved</p>
                <p className="text-xl font-bold text-brand">{monthsSaved > 0 ? monthsSaved : 0}</p>
              </CardContent>
            </Card>
          </div>

          {/* Strategy Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Avalanche */}
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              <Card className="border-brand/20 h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-brand" /> Avalanche
                    </CardTitle>
                    <Badge variant="success">Recommended</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Pay highest interest rate first (saves most money)</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Payoff time</span>
                      <span className="font-bold text-foreground">{avalanche.months} months ({(avalanche.months / 12).toFixed(1)} yrs)</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total interest</span>
                      <span className="font-bold text-danger">{fmt(avalanche.totalInterest)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total paid</span>
                      <span className="font-bold text-foreground">{fmt(totalDebt + avalanche.totalInterest)}</span>
                    </div>
                    {avalanche.order.length > 0 && (
                      <div className="pt-3 border-t border-border">
                        <p className="text-[11px] font-medium text-muted-foreground mb-2">Payoff Order:</p>
                        <div className="flex flex-wrap gap-1">
                          {avalanche.order.map((id, i) => {
                            const d = debts.find((x) => x.id === id);
                            return d ? (
                              <span key={id} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-muted">
                                <span className="text-muted-foreground">{i + 1}.</span>
                                <span className="font-medium text-foreground">{d.name}</span>
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Snowball */}
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Snowflake className="w-5 h-5 text-info" /> Snowball
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Pay smallest balance first (psychological wins)</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Payoff time</span>
                      <span className="font-bold text-foreground">{snowball.months} months ({(snowball.months / 12).toFixed(1)} yrs)</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total interest</span>
                      <span className="font-bold text-danger">{fmt(snowball.totalInterest)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total paid</span>
                      <span className="font-bold text-foreground">{fmt(totalDebt + snowball.totalInterest)}</span>
                    </div>
                    {snowball.order.length > 0 && (
                      <div className="pt-3 border-t border-border">
                        <p className="text-[11px] font-medium text-muted-foreground mb-2">Payoff Order:</p>
                        <div className="flex flex-wrap gap-1">
                          {snowball.order.map((id, i) => {
                            const d = debts.find((x) => x.id === id);
                            return d ? (
                              <span key={id} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-muted">
                                <span className="text-muted-foreground">{i + 1}.</span>
                                <span className="font-medium text-foreground">{d.name}</span>
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Payoff Timeline Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Debt Payoff Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full" style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" label={{ value: "Months", position: "bottom", fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <RTooltip formatter={(value) => fmt(value as number)} />
                    <Bar dataKey="avalanche" name="Avalanche" fill="#0080ff" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="snowball" name="Snowball" fill="#64748b" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-6 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-brand" /> Avalanche</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#64748b]" /> Snowball</span>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Allocation */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Payment Allocation (Avalanche)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...debts].sort((a, b) => b.rate - a.rate).map((d, i) => {
                  const isTarget = i === 0;
                  const payment = isTarget ? d.minPayment + extra : d.minPayment;
                  const totalMonthly = totalMinPayments + extra;
                  const pct = (payment / totalMonthly) * 100;
                  return (
                    <div key={d.id}>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground">{d.name}</span>
                          {isTarget && <Badge variant="success" className="text-[9px]">Priority</Badge>}
                        </div>
                        <span className="text-xs text-muted-foreground">{fmt(payment)}/mo ({d.rate}% APR)</span>
                      </div>
                      <Progress value={pct} />
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-3 border-t border-border flex justify-between text-sm">
                <span className="text-muted-foreground">Total monthly</span>
                <span className="font-bold text-foreground">{fmt(totalMinPayments + extra)}</span>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {debts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingDown className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground mb-1">No debts added yet</p>
            <p className="text-xs text-muted-foreground">Add your credit card balances, loans, or EMIs to compare payoff strategies.</p>
          </CardContent>
        </Card>
      )}

      {/* Add Debt Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md mx-4 rounded-2xl bg-card border border-border shadow-2xl p-6">
            <h3 className="text-lg font-bold text-foreground mb-4">Add Debt</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. HDFC Credit Card" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Outstanding Balance</label>
                  <Input type="number" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} placeholder="50000" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Interest Rate (%/yr)</label>
                  <Input type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="36" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Min Payment/month</label>
                  <Input type="number" value={form.minPayment} onChange={(e) => setForm({ ...form, minPayment: e.target.value })} placeholder="1000" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm text-foreground">
                    <option value="credit_card">Credit Card</option>
                    <option value="loan">Loan</option>
                    <option value="emi">EMI</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted">Cancel</button>
                <button onClick={addDebt} className="flex-1 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90">Add</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
