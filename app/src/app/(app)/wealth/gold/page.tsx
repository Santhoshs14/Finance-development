"use client";

import { useState, useMemo } from "react";
import { useInvestments, useInvestmentMutations } from "@/hooks/useInvestments";
import { calculateGoldReturns, calculateGoldValue, GOLD_FORMS, GOLD_PURITY_MAP } from "@/utils/calculations";
import { fmt } from "@/utils/format";
import StatCard from "@/components/StatCard";
import ChartCard from "@/components/ChartCard";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useTheme } from "@/providers/ThemeProvider";
import { Gem, Plus, Pencil, Trash2, Calculator, ChevronDown, ChevronUp } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { motion, AnimatePresence } from "framer-motion";

const FORM_COLORS: Record<string, string> = {
  digital: "#3b82f6",
  physical: "#f59e0b",
  sgb: "#8b5cf6",
  etf: "#10b981",
};

export default function GoldPage() {
  const { investments, isLoading } = useInvestments();
  const { addInvestment, updateInvestment, deleteInvestment } = useInvestmentMutations();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "",
    form: "digital" as "digital" | "physical" | "sgb" | "etf",
    purity: 24,
    weight_grams: "",
    buy_price: "",
    current_price: "",
    purchase_date: "",
    making_charges: "",
  });

  // Calculator state
  const [calc, setCalc] = useState({
    weight: "",
    purity: 24,
    rate24k: "",
    makingCharges: "",
  });

  // Filter gold investments
  const goldHoldings = useMemo(
    () => investments.filter((i) => (i.investment_type || "").toLowerCase() === "gold"),
    [investments]
  );

  // Summary stats
  const summary = useMemo(() => {
    let totalWeight = 0;
    let totalInvested = 0;
    let totalCurrent = 0;

    goldHoldings.forEach((g) => {
      const weight = g.weight_grams || g.quantity || 0;
      const buyPerGram = g.buy_price || 0;
      const currentPerGram = g.current_price || 0;
      const making = g.making_charges || 0;

      totalWeight += weight;
      totalInvested += buyPerGram * weight + making;
      totalCurrent += currentPerGram * weight;
    });

    const totalPL = totalCurrent - totalInvested;
    const plPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

    return { totalWeight, totalInvested, totalCurrent, totalPL, plPct };
  }, [goldHoldings]);

  // Form breakdown pie data
  const formBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    goldHoldings.forEach((g) => {
      const f = g.form || "physical";
      const val = (g.current_price || 0) * (g.weight_grams || g.quantity || 0);
      breakdown[f] = (breakdown[f] || 0) + val;
    });
    return Object.entries(breakdown)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name: GOLD_FORMS[name as keyof typeof GOLD_FORMS]?.label || name, value, key: name }));
  }, [goldHoldings]);

  // Calculator results
  const calcResult = useMemo(() => {
    const w = parseFloat(calc.weight) || 0;
    const rate = parseFloat(calc.rate24k) || 0;
    const making = parseFloat(calc.makingCharges) || 0;
    if (w === 0 || rate === 0) return null;

    const value = calculateGoldValue(w, calc.purity, rate);
    const equivalent24k = w * (GOLD_PURITY_MAP[calc.purity]?.multiplier || 1);
    const totalCost = value + making;

    return { value, equivalent24k, totalCost, making };
  }, [calc]);

  const resetForm = () => {
    setForm({ name: "", form: "digital", purity: 24, weight_grams: "", buy_price: "", current_price: "", purchase_date: "", making_charges: "" });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = () => {
    const weight = parseFloat(form.weight_grams) || 0;
    const buyPrice = parseFloat(form.buy_price) || 0;
    const currentPrice = parseFloat(form.current_price) || buyPrice;

    const payload = {
      name: form.name.trim() || `Gold ${GOLD_FORMS[form.form]?.label}`,
      investment_type: "Gold",
      form: form.form,
      purity: form.purity,
      weight_grams: weight,
      buy_price: buyPrice,
      current_price: currentPrice,
      quantity: weight,
      purchase_date: form.purchase_date || null,
      making_charges: parseFloat(form.making_charges) || 0,
    };
    if (weight <= 0 || buyPrice <= 0) return;

    if (editingId) {
      updateInvestment.mutate({ id: editingId, data: payload });
    } else {
      addInvestment.mutate(payload);
    }
    resetForm();
  };

  const handleEdit = (inv: (typeof investments)[0]) => {
    setForm({
      name: inv.name,
      form: inv.form || "physical",
      purity: inv.purity || 24,
      weight_grams: String(inv.weight_grams || inv.quantity || ""),
      buy_price: String(inv.buy_price || ""),
      current_price: String(inv.current_price || ""),
      purchase_date: inv.purchase_date || "",
      making_charges: String(inv.making_charges || ""),
    });
    setEditingId(inv.id);
    setShowForm(true);
  };

  if (isLoading) {
    return <div className="animate-pulse space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted" />)}</div>;
  }

  if (goldHoldings.length === 0 && !showForm) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={Gem}
          title="No gold holdings yet"
          description="Track your physical gold, digital gold, Sovereign Gold Bonds, and Gold ETFs in one place."
          actionLabel="Add Gold"
          onAction={() => setShowForm(true)}
        />
        {/* Show calculator even when empty */}
        <GoldCalculatorSection
          showCalculator={showCalculator}
          setShowCalculator={setShowCalculator}
          calc={calc}
          setCalc={setCalc}
          calcResult={calcResult}
          isDark={isDark}
        />
      </div>
    );
  }

  const inputClass = `w-full rounded-xl px-3 py-2 text-sm border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40`;
  const selectClass = `w-full rounded-xl px-3 py-2 text-sm border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40`;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Total Weight" value={summary.totalWeight} prefix="" suffix="g" icon={Gem} delay={0} />
        <StatCard title="Total Invested" value={summary.totalInvested} delay={0.1} />
        <StatCard title="Current Value" value={summary.totalCurrent} color="accent" delay={0.15} />
        <StatCard
          title="Profit / Loss"
          value={summary.totalPL}
          color={summary.totalPL >= 0 ? "primary" : "danger"}
          trend={summary.plPct}
          trendLabel="returns"
          delay={0.2}
        />
      </div>

      {/* Form breakdown chart */}
      {formBreakdown.length > 1 && (
        <ChartCard title="Gold Allocation" subtitle="By form of holding">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={formBreakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label={({ name }) => name}>
                {formBreakdown.map((entry) => (
                  <Cell key={entry.key} fill={FORM_COLORS[entry.key] || "#6b7280"} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Gold
        </button>
      </div>

      {/* Add/Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-2xl border border-border bg-card p-5 space-y-4 overflow-hidden"
          >
            <h3 className="text-sm font-bold text-foreground">{editingId ? "Edit Gold Holding" : "Add Gold Holding"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <input className={inputClass} placeholder="Name (e.g. Gold Coin 10g)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <select className={selectClass} value={form.form} onChange={(e) => setForm({ ...form, form: e.target.value as typeof form.form })}>
                {Object.entries(GOLD_FORMS).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Purity:</span>
                {[24, 22, 18].map((p) => (
                  <label key={p} className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="purity"
                      checked={form.purity === p}
                      onChange={() => setForm({ ...form, purity: p })}
                      className="accent-brand"
                    />
                    <span className="text-xs font-medium text-foreground">{p}K</span>
                  </label>
                ))}
              </div>
              <input className={inputClass} type="number" placeholder="Weight (grams)" value={form.weight_grams} onChange={(e) => setForm({ ...form, weight_grams: e.target.value })} />
              <input className={inputClass} type="number" placeholder="Buy Price / gram" value={form.buy_price} onChange={(e) => setForm({ ...form, buy_price: e.target.value })} />
              <input className={inputClass} type="number" placeholder="Current Price / gram" value={form.current_price} onChange={(e) => setForm({ ...form, current_price: e.target.value })} />
              <input className={inputClass} type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
              {form.form === "physical" && (
                <input className={inputClass} type="number" placeholder="Making Charges (₹)" value={form.making_charges} onChange={(e) => setForm({ ...form, making_charges: e.target.value })} />
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={handleSubmit} className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors">
                {editingId ? "Update" : "Add"}
              </button>
              <button onClick={resetForm} className="px-4 py-2 rounded-xl bg-muted text-muted-foreground text-sm font-medium hover:bg-muted/80 transition-colors">
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Holdings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goldHoldings.map((g, idx) => {
          const weight = g.weight_grams || g.quantity || 0;
          const returns = calculateGoldReturns(g.buy_price, g.current_price, weight, g.making_charges || 0);
          const formInfo = GOLD_FORMS[g.form as keyof typeof GOLD_FORMS] || GOLD_FORMS.physical;
          const purityLabel = GOLD_PURITY_MAP[g.purity || 24]?.label || `${g.purity}K`;

          return (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="rounded-2xl border border-border p-4 space-y-3"
              style={{ background: isDark ? "#111827" : "#ffffff" }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-foreground">{g.name}</h4>
                  <div className="flex gap-2 mt-1">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium text-white"
                      style={{ background: FORM_COLORS[g.form || "physical"] || "#6b7280" }}
                    >
                      {formInfo.label}
                    </span>
                    <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                      {purityLabel}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(g)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => setDeleteId(g.id)} className="p-1.5 rounded-lg hover:bg-danger/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5 text-danger" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Weight</p>
                  <p className="font-semibold text-foreground">{weight}g</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Buy/g</p>
                  <p className="font-semibold text-foreground">{fmt(g.buy_price)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Current/g</p>
                  <p className="font-semibold text-foreground">{fmt(g.current_price)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Invested</p>
                  <p className="font-semibold text-foreground">{fmt(returns.invested)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Value</p>
                  <p className="font-semibold text-foreground">{fmt(returns.currentValue)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">P/L</p>
                  <p className={`font-semibold ${returns.profitLoss >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {returns.profitLoss >= 0 ? "+" : ""}{fmt(returns.profitLoss)}
                    <span className="ml-1 text-[10px]">({returns.plPercentage}%)</span>
                  </p>
                </div>
              </div>

              {g.purchase_date && (
                <p className="text-[11px] text-muted-foreground">
                  Purchased: {new Date(g.purchase_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              )}
              {(g.making_charges || 0) > 0 && (
                <p className="text-[11px] text-muted-foreground">Making charges: {fmt(g.making_charges!)}</p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Gold Calculator */}
      <GoldCalculatorSection
        showCalculator={showCalculator}
        setShowCalculator={setShowCalculator}
        calc={calc}
        setCalc={setCalc}
        calcResult={calcResult}
        isDark={isDark}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Gold Holding"
        message="This will permanently remove this gold holding from your portfolio."
        confirmLabel="Delete"
        onConfirm={() => { 
          if (deleteId) {
            deleteInvestment.mutate(deleteId);
            if (deleteId === editingId) resetForm();
          }
          setDeleteId(null); 
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

// ─── Gold Calculator Sub-component ─────────────────────────────────

function GoldCalculatorSection({
  showCalculator,
  setShowCalculator,
  calc,
  setCalc,
  calcResult,
  isDark,
}: {
  showCalculator: boolean;
  setShowCalculator: (v: boolean) => void;
  calc: { weight: string; purity: number; rate24k: string; makingCharges: string };
  setCalc: (v: typeof calc) => void;
  calcResult: { value: number; equivalent24k: number; totalCost: number; making: number } | null;
  isDark: boolean;
}) {
  const inputClass = `w-full rounded-xl px-3 py-2 text-sm border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40`;

  return (
    <div
      className="rounded-2xl border border-border overflow-hidden"
      style={{ background: isDark ? "#111827" : "#ffffff" }}
    >
      <button
        onClick={() => setShowCalculator(!showCalculator)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-foreground hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-brand" />
          Gold Calculator
        </span>
        {showCalculator ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      <AnimatePresence>
        {showCalculator && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4">
              <p className="text-xs text-muted-foreground">
                Calculate gold value based on weight, purity, and current market rate.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <input
                  className={inputClass}
                  type="number"
                  placeholder="Weight (grams)"
                  value={calc.weight}
                  onChange={(e) => setCalc({ ...calc, weight: e.target.value })}
                />
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Purity:</span>
                  {[24, 22, 18].map((p) => (
                    <label key={p} className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="calc-purity"
                        checked={calc.purity === p}
                        onChange={() => setCalc({ ...calc, purity: p })}
                        className="accent-brand"
                      />
                      <span className="text-xs font-medium text-foreground">{p}K</span>
                    </label>
                  ))}
                </div>
                <input
                  className={inputClass}
                  type="number"
                  placeholder="24K Rate (₹/gram)"
                  value={calc.rate24k}
                  onChange={(e) => setCalc({ ...calc, rate24k: e.target.value })}
                />
                <input
                  className={inputClass}
                  type="number"
                  placeholder="Making Charges (₹)"
                  value={calc.makingCharges}
                  onChange={(e) => setCalc({ ...calc, makingCharges: e.target.value })}
                />
              </div>

              {calcResult && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-[11px] text-muted-foreground">Equivalent 24K</p>
                    <p className="text-sm font-bold text-foreground">{calcResult.equivalent24k.toFixed(3)}g</p>
                  </div>
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-[11px] text-muted-foreground">Gold Value</p>
                    <p className="text-sm font-bold text-foreground">{fmt(calcResult.value)}</p>
                  </div>
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-[11px] text-muted-foreground">Making Charges</p>
                    <p className="text-sm font-bold text-foreground">{fmt(calcResult.making)}</p>
                  </div>
                  <div className="rounded-xl bg-brand/10 p-3">
                    <p className="text-[11px] text-brand">Total Cost</p>
                    <p className="text-sm font-bold text-brand">{fmt(calcResult.totalCost)}</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
