"use client";

import { useState, useMemo } from "react";
import { useInvestments, useInvestmentMutations } from "@/hooks/useInvestments";
import { useData } from "@/providers/DataProvider";
import { calculateInvestmentPL, calculatePortfolioAllocation, calculateXIRR } from "@/utils/calculations";
import StatCard from "@/components/StatCard";
import ChartCard from "@/components/ChartCard";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useTheme } from "@/providers/ThemeProvider";
import { TrendingUp, Plus, Pencil, Trash2, Filter, Link2, AlertTriangle, Gem } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { DEFAULT_INVESTMENT_CATEGORIES } from "@/schemas/category";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const INVESTMENT_TYPES = ["Mutual Fund", "Equity", "Gold", "Bond", "FD", "PPF", "NPS", "ELSS", "ETF", "Other"];
const PIE_COLORS = ["#1abf94", "#3b82f6", "#f59e0b", "#eab308", "#8b5cf6", "#6b7280"];

/** Context-sensitive field labels based on investment type */
const FIELD_LABELS: Record<string, { buyPrice: string; currentPrice: string; quantity: string; sipAmount: string; hideQuantity?: boolean }> = {
  "Mutual Fund": { buyPrice: "NAV (per unit)", currentPrice: "Current NAV", quantity: "Units", sipAmount: "Monthly SIP" },
  ELSS: { buyPrice: "NAV (per unit)", currentPrice: "Current NAV", quantity: "Units", sipAmount: "Monthly SIP" },
  ETF: { buyPrice: "NAV (per unit)", currentPrice: "Current NAV", quantity: "Units", sipAmount: "Monthly SIP" },
  Equity: { buyPrice: "Buy Price / share", currentPrice: "Current Price / share", quantity: "No. of Shares", sipAmount: "SIP Amount" },
  FD: { buyPrice: "Invested Amount", currentPrice: "Current Value", quantity: "Quantity", sipAmount: "SIP Amount", hideQuantity: true },
  PPF: { buyPrice: "Invested Amount", currentPrice: "Current Value", quantity: "Quantity", sipAmount: "SIP Amount", hideQuantity: true },
  NPS: { buyPrice: "Invested Amount", currentPrice: "Current Value", quantity: "Quantity", sipAmount: "SIP Amount", hideQuantity: true },
  Bond: { buyPrice: "Invested Amount", currentPrice: "Current Value", quantity: "Quantity", sipAmount: "SIP Amount", hideQuantity: true },
  Other: { buyPrice: "Buy Price", currentPrice: "Current Price", quantity: "Quantity", sipAmount: "SIP Amount" },
};
const DEFAULT_LABELS = FIELD_LABELS.Other;

export default function PortfolioPage() {
  const { investments, isLoading } = useInvestments();
  const { addInvestment, updateInvestment, deleteInvestment } = useInvestmentMutations();
  const { accounts, transactions, categories } = useData();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const router = useRouter();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("All");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [txSearchQuery, setTxSearchQuery] = useState("");

  const [form, setForm] = useState({
    name: "",
    investment_type: "Equity",
    buy_price: "",
    current_price: "",
    quantity: "",
    sip_amount: "",
    account_id: "",
    linked_transaction_id: "",
  });

  const bankAccounts = accounts.filter((a) => a.type !== "credit");

  // Investment-category transactions that can be linked
  const investmentCategoryNames = useMemo(() => {
    const set = new Set<string>(DEFAULT_INVESTMENT_CATEGORIES);
    categories.forEach((c) => {
      if ((c as { classification?: string }).classification === "investment") set.add(c.name);
    });
    return set;
  }, [categories]);

  const linkableTransactions = useMemo(
    () => transactions
      .filter((t) => t.amount < 0 && investmentCategoryNames.has(t.category))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 50),
    [transactions, investmentCategoryNames]
  );

  const filtered = useMemo(() => {
    if (filterType === "All") return investments;
    return investments.filter((i) => i.investment_type === filterType);
  }, [investments, filterType]);

  const plData = useMemo(() => calculateInvestmentPL(filtered), [filtered]);
  const allocation = useMemo(
    () => calculatePortfolioAllocation(accounts, investments),
    [accounts, investments]
  );

  const totals = useMemo(() => {
    const totalInvested = plData.reduce((s, p) => s + p.invested, 0);
    const totalCurrent = plData.reduce((s, p) => s + p.current_value, 0);
    const totalPL = totalCurrent - totalInvested;
    const plPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;
    return { totalInvested, totalCurrent, totalPL, plPct };
  }, [plData]);

  // Portfolio XIRR from purchase dates + current value
  const portfolioXIRR = useMemo(() => {
    const cashflows: { date: string; amount: number }[] = [];
    investments.forEach((inv) => {
      if (inv.purchase_date && inv.buy_price && inv.quantity) {
        cashflows.push({ date: inv.purchase_date, amount: -(inv.buy_price * inv.quantity) });
      }
    });
    if (cashflows.length === 0) return null;
    const today = new Date().toISOString().slice(0, 10);
    const totalCurrent = investments.reduce(
      (s, inv) => s + (inv.current_price * inv.quantity || inv.current_value || 0),
      0
    );
    cashflows.push({ date: today, amount: totalCurrent });
    const result = calculateXIRR(cashflows);
    return isFinite(result) ? result : null;
  }, [investments]);

  const pieData = useMemo(() => {
    return Object.entries(allocation.percentages)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [allocation]);

  const resetForm = () => {
    setForm({ name: "", investment_type: "Equity", buy_price: "", current_price: "", quantity: "", sip_amount: "", account_id: "", linked_transaction_id: "" });
    setEditingId(null);
    setShowForm(false);
  };

  // Derive field labels for current investment type
  const labels = FIELD_LABELS[form.investment_type] || DEFAULT_LABELS;
  const isGoldType = form.investment_type === "Gold";
  const isFixedType = labels.hideQuantity;

  // Filtered linkable transactions for search
  const filteredLinkableTransactions = useMemo(() => {
    if (!txSearchQuery.trim()) return linkableTransactions;
    const q = txSearchQuery.toLowerCase();
    return linkableTransactions.filter((t) =>
      `${t.date} ${Math.abs(t.amount)} ${t.notes || ""} ${t.category}`.toLowerCase().includes(q)
    );
  }, [linkableTransactions, txSearchQuery]);

  const handleSubmit = () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      toast.error("Investment name is required");
      return;
    }

    const qty = isFixedType ? 1 : parseFloat(form.quantity) || 1;

    const payload: Record<string, unknown> = {
      name: trimmedName,
      investment_type: form.investment_type,
      buy_price: parseFloat(form.buy_price) || 0,
      current_price: parseFloat(form.current_price) || 0,
      quantity: qty,
      sip_amount: parseFloat(form.sip_amount) || 0,
      account_id: form.account_id || null,
      linked_transaction_id: form.linked_transaction_id || null,
    };

    // If editing a needs_allocation investment and user provided proper NAV/qty, clear the flag
    if (editingId && isNeedsAllocation) {
      payload.needs_allocation = false;
    }

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
      investment_type: inv.investment_type || "Equity",
      buy_price: String(inv.buy_price),
      current_price: String(inv.current_price),
      quantity: String(inv.quantity),
      sip_amount: String(inv.sip_amount || ""),
      account_id: inv.account_id || "",
      linked_transaction_id: (inv as { linked_transaction_id?: string }).linked_transaction_id || "",
    });
    setEditingId(inv.id);
    setShowForm(true);
  };

  // Check if current editing investment needs allocation
  const editingInvestment = editingId ? investments.find((i) => i.id === editingId) : null;
  const isNeedsAllocation = !!(editingInvestment as { needs_allocation?: boolean } | null)?.needs_allocation;

  // Auto-calculate quantity from total invested / buy_price (NAV)
  const totalInvestedAmount = isNeedsAllocation && editingInvestment ? editingInvestment.buy_price * editingInvestment.quantity : 0;
  const computedQuantity = (() => {
    if (!isNeedsAllocation || !totalInvestedAmount) return "";
    const nav = parseFloat(form.buy_price);
    if (!nav || nav <= 0) return "";
    return (totalInvestedAmount / nav).toFixed(4);
  })();

  if (isLoading) {
    return <div className="animate-pulse space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted" />)}</div>;
  }

  if (investments.length === 0 && !showForm) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No investments yet"
        description="Track your stocks, mutual funds, gold, and more. Add your first investment to get started."
        actionLabel="Add Investment"
        onAction={() => setShowForm(true)}
      />
    );
  }

  const inputClass = `w-full rounded-xl px-3 py-2 text-sm border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40`;
  const selectClass = `w-full rounded-xl px-3 py-2 text-sm border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40`;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Total Invested" value={totals.totalInvested} icon={TrendingUp} delay={0} />
        <StatCard title="Current Value" value={totals.totalCurrent} color="accent" delay={0.1} />
        <StatCard
          title="Total P/L"
          value={totals.totalPL}
          color={totals.totalPL >= 0 ? "primary" : "danger"}
          trend={totals.plPct}
          trendLabel="overall"
          delay={0.2}
        />
        {portfolioXIRR !== null && (
          <StatCard
            title="XIRR"
            value={portfolioXIRR}
            prefix=""
            suffix="%"
            color={portfolioXIRR >= 0 ? "primary" : "danger"}
            delay={0.25}
          />
        )}
      </div>

      {/* Allocation Chart */}
      {pieData.length > 0 && (
        <ChartCard title="Portfolio Allocation" subtitle="Asset class breakdown">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name} ${value}%`}>
                {pieData.map((_, idx) => (
                  <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Filter + Add */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {["All", ...INVESTMENT_TYPES].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterType === t
                  ? "bg-brand text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add
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
            <h3 className="text-sm font-bold text-foreground">{editingId ? "Edit Investment" : "Add Investment"}</h3>
            {isNeedsAllocation && (
              <div className="p-3 rounded-xl border border-amber-400/40 bg-amber-50 dark:bg-amber-950/20">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-[13px] font-medium text-amber-700 dark:text-amber-400">Units pending — enter NAV to calculate</span>
                </div>
                <p className="text-[11px] text-amber-600/80 dark:text-amber-400/60">
                  Total invested: ₹{totalInvestedAmount.toLocaleString("en-IN")}. Enter the buy NAV (per-unit price) below — quantity will auto-calculate.
                </p>
                {computedQuantity && (
                  <p className="mt-1.5 text-[12px] font-medium text-amber-700 dark:text-amber-300">
                    Calculated units: {computedQuantity}
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, quantity: computedQuantity })}
                      className="ml-2 px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-[11px] font-semibold hover:bg-amber-300 dark:hover:bg-amber-700 transition-colors"
                    >
                      Use this
                    </button>
                  </p>
                )}
              </div>
            )}
            {/* Gold type → redirect to gold page */}
            {isGoldType && (
              <div className="p-3 rounded-xl border border-amber-400/40 bg-amber-50 dark:bg-amber-950/20 flex items-center gap-3">
                <Gem className="w-5 h-5 text-amber-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-amber-700 dark:text-amber-400">Use the Gold Tracker for gold investments</p>
                  <p className="text-[11px] text-amber-600/80 dark:text-amber-400/60 mt-0.5">The Gold page has purity, weight, and form-specific fields.</p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/wealth/gold")}
                  className="px-3 py-1.5 rounded-lg bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-xs font-semibold hover:bg-amber-300 dark:hover:bg-amber-700 transition-colors whitespace-nowrap"
                >
                  Go to Gold
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <input className={inputClass} placeholder="Name (e.g. NIFTY 50 ETF)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <select className={selectClass} value={form.investment_type} onChange={(e) => setForm({ ...form, investment_type: e.target.value })}>
                {INVESTMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {!isGoldType && (
                <>
                  <input className={inputClass} type="number" placeholder={labels.buyPrice} value={form.buy_price} onChange={(e) => setForm({ ...form, buy_price: e.target.value })} />
                  <input className={inputClass} type="number" placeholder={labels.currentPrice} value={form.current_price} onChange={(e) => setForm({ ...form, current_price: e.target.value })} />
                  {!isFixedType && (
                    <input className={inputClass} type="number" placeholder={labels.quantity} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                  )}
                  <input className={inputClass} type="number" placeholder={`${labels.sipAmount} (optional)`} value={form.sip_amount} onChange={(e) => setForm({ ...form, sip_amount: e.target.value })} />
                </>
              )}
              <select className={selectClass} value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>
                <option value="">Link Account (optional)</option>
                {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}
              </select>
              {linkableTransactions.length > 0 && (
                <div className="space-y-1.5">
                  <input
                    className={inputClass}
                    type="text"
                    placeholder="Search transactions…"
                    value={txSearchQuery}
                    onChange={(e) => setTxSearchQuery(e.target.value)}
                  />
                  <select className={selectClass} value={form.linked_transaction_id} onChange={(e) => setForm({ ...form, linked_transaction_id: e.target.value })}>
                    <option value="">Link Transaction (optional)</option>
                    {filteredLinkableTransactions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.date} — ₹{Math.abs(t.amount).toLocaleString("en-IN")} {t.notes || t.category}
                      </option>
                    ))}
                  </select>
                </div>
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

      {/* Investment Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plData.map((inv, idx) => {
          const orig = filtered[idx];
          return (
            <motion.div
              key={orig.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="rounded-2xl border border-border p-4 space-y-3"
              style={{ background: isDark ? "#111827" : "#ffffff" }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-foreground">{inv.name}</h4>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
                      {inv.investment_type || "Equity"}
                    </span>
                    {(orig as { needs_allocation?: boolean }).needs_allocation && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700">
                        <AlertTriangle className="w-3 h-3" /> Enter details
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(orig)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => setDeleteId(orig.id)} className="p-1.5 rounded-lg hover:bg-danger/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5 text-danger" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Invested</p>
                  <p className="font-semibold text-foreground">₹{inv.invested.toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Current</p>
                  <p className="font-semibold text-foreground">₹{inv.current_value.toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">P/L</p>
                  <p className={`font-semibold ${inv.profit_loss >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {inv.profit_loss >= 0 ? "+" : ""}₹{inv.profit_loss.toLocaleString("en-IN")}
                    <span className="ml-1 text-[10px]">({inv.pl_percentage}%)</span>
                  </p>
                </div>
              </div>
              {orig.sip_amount ? (
                <p className="text-[11px] text-muted-foreground">SIP: ₹{orig.sip_amount.toLocaleString("en-IN")}/mo</p>
              ) : null}
            </motion.div>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Investment"
        message="This will permanently remove this investment from your portfolio."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteId) deleteInvestment.mutate(deleteId); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
