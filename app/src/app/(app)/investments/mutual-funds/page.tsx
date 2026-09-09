"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useInvestments, useInvestmentMutations } from "@/hooks/useInvestments";
import { useSips, useSipMutations } from "@/hooks/useSips";
import { useData } from "@/providers/DataProvider";
import { fundsAPI } from "@/services/api";
import { calculateInvestmentPL } from "@/utils/calculations";
import { fmt } from "@/utils/format";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
  Search,
  Repeat,
  Play,
  Pause,
  Zap,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

interface FundResult {
  scheme_code: string;
  scheme_name: string;
  fund_house: string;
  nav: number;
  date: string;
}

const inputClass =
  "w-full rounded-xl px-3 py-2 text-sm border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40";

const today = () => new Date().toISOString().slice(0, 10);

export default function MutualFundsPage() {
  const { investments, isLoading } = useInvestments();
  const { addInvestment, updateInvestment, deleteInvestment } = useInvestmentMutations();
  const { sips } = useSips();
  const { addSip, updateSip, deleteSip, investNow } = useSipMutations();
  const { accounts } = useData();

  const bankAccounts = useMemo(
    () => accounts.filter((a) => a.type !== "credit"),
    [accounts]
  );

  const funds = useMemo(
    () => investments.filter((i) => (i.investment_type || "") === "Mutual Fund"),
    [investments]
  );
  const plByName = useMemo(() => {
    const pl = calculateInvestmentPL(funds);
    return new Map(funds.map((f, i) => [f.id, pl[i]]));
  }, [funds]);

  const totals = useMemo(() => {
    const invested = funds.reduce((s, f) => s + (f.buy_price * f.quantity || 0), 0);
    const current = funds.reduce(
      (s, f) => s + (f.current_price * f.quantity || f.current_value || 0),
      0
    );
    return { invested, current, pl: current - invested };
  }, [funds]);

  const sipByInvestment = useMemo(() => {
    const map = new Map<string, (typeof sips)[number]>();
    sips.forEach((s) => {
      if (s.investment_id) map.set(s.investment_id, s);
    });
    return map;
  }, [sips]);

  // ── Add / edit holding ──────────────────────────────────────────
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    scheme_code: "",
    name: "",
    fund_house: "",
    current_price: "",
    buy_price: "",
    quantity: "",
    amount: "",
    purchase_date: "",
    account_id: "",
  });

  // ── Fund search ─────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<FundResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (search.trim().length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const res = await fundsAPI.search(search.trim());
        setResults((res.funds as FundResult[]) || []);
      } catch (err) {
        setResults([]);
        setSearchError(
          err instanceof Error ? err.message : "Fund search is unavailable right now"
        );
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  const resetForm = useCallback(() => {
    setForm({
      scheme_code: "",
      name: "",
      fund_house: "",
      current_price: "",
      buy_price: "",
      quantity: "",
      amount: "",
      purchase_date: "",
      account_id: "",
    });
    setEditingId(null);
    setShowAdd(false);
    setSearch("");
    setResults([]);
  }, []);

  const pickFund = (f: FundResult) => {
    setForm((prev) => ({
      ...prev,
      scheme_code: f.scheme_code,
      name: f.scheme_name,
      fund_house: f.fund_house,
      current_price: String(f.nav),
      buy_price: prev.buy_price || String(f.nav),
    }));
    setSearch("");
    setResults([]);
  };

  const handleSubmit = () => {
    const name = form.name.trim();
    if (!name) {
      toast.error("Pick or name a fund first");
      return;
    }
    const nav = parseFloat(form.buy_price) || parseFloat(form.current_price) || 0;
    let quantity = parseFloat(form.quantity) || 0;
    if (!quantity && form.amount && nav > 0) {
      quantity = parseFloat(form.amount) / nav;
    }
    if (!(quantity > 0)) {
      toast.error("Enter units or an amount (with NAV)");
      return;
    }

    const payload: Record<string, unknown> = {
      name,
      investment_type: "Mutual Fund",
      buy_price: nav || 1,
      current_price: parseFloat(form.current_price) || nav || 1,
      quantity,
      scheme_code: form.scheme_code.trim() || null,
      fund_house: form.fund_house.trim() || null,
      account_id: form.account_id || null,
      purchase_date: form.purchase_date || null,
    };

    if (editingId) updateInvestment.mutate({ id: editingId, data: payload });
    else addInvestment.mutate(payload);
    resetForm();
  };

  const handleEdit = (id: string) => {
    const inv = funds.find((f) => f.id === id);
    if (!inv) return;
    setForm({
      scheme_code: inv.scheme_code || "",
      name: inv.name,
      fund_house: inv.fund_house || "",
      current_price: String(inv.current_price),
      buy_price: String(inv.buy_price),
      quantity: String(inv.quantity),
      amount: "",
      purchase_date: inv.purchase_date || "",
      account_id: inv.account_id || "",
    });
    setEditingId(id);
    setShowAdd(true);
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Add units (quick top-up) ────────────────────────────────────
  const [topUpId, setTopUpId] = useState<string | null>(null);
  const [topUp, setTopUp] = useState({ units: "", price: "" });
  const applyTopUp = () => {
    const inv = funds.find((f) => f.id === topUpId);
    if (!inv) return;
    const addUnits = parseFloat(topUp.units) || 0;
    const price = parseFloat(topUp.price) || inv.current_price || inv.buy_price;
    if (!(addUnits > 0)) {
      toast.error("Enter units to add");
      return;
    }
    const newQty = inv.quantity + addUnits;
    const newBuy = newQty > 0 ? (inv.quantity * inv.buy_price + addUnits * price) / newQty : price;
    updateInvestment.mutate({ id: inv.id, data: { quantity: newQty, buy_price: newBuy } });
    setTopUpId(null);
    setTopUp({ units: "", price: "" });
  };

  // ── SIP create ──────────────────────────────────────────────────
  const [sipFor, setSipFor] = useState<string | null>(null);
  const [sipForm, setSipForm] = useState({
    amount: "",
    frequency: "monthly",
    next_date: today(),
    account_id: "",
  });
  const openSip = (id: string) => {
    const inv = funds.find((f) => f.id === id);
    if (!inv) return;
    setSipForm({ amount: "", frequency: "monthly", next_date: today(), account_id: inv.account_id || "" });
    setSipFor(id);
  };
  const submitSip = () => {
    const inv = funds.find((f) => f.id === sipFor);
    if (!inv) return;
    if (!inv.scheme_code) {
      toast.error("This fund has no AMFI scheme code — edit it and add one to enable SIP auto-pricing.");
      return;
    }
    const amount = parseFloat(sipForm.amount) || 0;
    if (!(amount > 0)) {
      toast.error("Enter a SIP amount");
      return;
    }
    if (!sipForm.account_id) {
      toast.error("Choose a funding account");
      return;
    }
    addSip.mutate({
      investment_id: inv.id,
      scheme_code: inv.scheme_code,
      fund_name: inv.name,
      fund_house: inv.fund_house || null,
      amount,
      frequency: sipForm.frequency,
      next_date: sipForm.next_date,
      account_id: sipForm.account_id,
    });
    setSipFor(null);
  };

  const [deleteSipId, setDeleteSipId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard title="Invested" value={totals.invested} icon={TrendingUp} delay={0} />
        <StatCard title="Current Value" value={totals.current} color="accent" delay={0.1} />
        <StatCard
          title="P/L"
          value={totals.pl}
          color={totals.pl >= 0 ? "primary" : "danger"}
          delay={0.2}
        />
      </div>

      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            resetForm();
            setShowAdd(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Mutual Fund
        </button>
      </div>

      {/* Add / edit panel */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-2xl border border-border bg-card p-5 space-y-4 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">
                {editingId ? "Edit Fund" : "Add Mutual Fund"}
              </h3>
              <button onClick={resetForm} className="p-1 rounded-lg hover:bg-muted">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {!editingId && (
              <div className="relative">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3">
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    className="w-full bg-transparent py-2 text-sm text-foreground focus:outline-none"
                    placeholder="Search funds by name (e.g. Parag Parikh Flexi Cap)…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {searching && <span className="text-[11px] text-muted-foreground">…</span>}
                </div>
                {results.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-xl border border-border bg-card shadow-lg">
                    {results.map((f) => (
                      <button
                        key={f.scheme_code}
                        onClick={() => pickFund(f)}
                        className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b border-border/50 last:border-0"
                      >
                        <p className="text-sm text-foreground line-clamp-1">{f.scheme_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {f.fund_house} · NAV ₹{f.nav} ({f.date})
                        </p>
                      </button>
                    ))}
                  </div>
                )}
                {search.trim().length >= 2 && !searching && searchError && (
                  <p className="mt-1 text-[11px] text-danger px-1">
                    {searchError}. You can still enter fund details manually below.
                  </p>
                )}
                {search.trim().length >= 2 && !searching && !searchError && results.length === 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground px-1">
                    No matches. The fund index refreshes daily — you can still enter details manually below.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <input
                className={inputClass}
                placeholder="Fund name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                className={inputClass}
                placeholder="AMFI scheme code (auto NAV)"
                value={form.scheme_code}
                onChange={(e) => setForm({ ...form, scheme_code: e.target.value })}
              />
              <input
                className={inputClass}
                placeholder="Fund house"
                value={form.fund_house}
                onChange={(e) => setForm({ ...form, fund_house: e.target.value })}
              />
              <input
                className={inputClass}
                type="number"
                placeholder="Buy NAV (per unit)"
                value={form.buy_price}
                onChange={(e) => setForm({ ...form, buy_price: e.target.value })}
              />
              <input
                className={inputClass}
                type="number"
                placeholder="Current NAV"
                value={form.current_price}
                onChange={(e) => setForm({ ...form, current_price: e.target.value })}
              />
              {!editingId && (
                <input
                  className={inputClass}
                  type="number"
                  placeholder="Amount invested (₹) — optional"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              )}
              <input
                className={inputClass}
                type="number"
                placeholder="Units"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground px-1">Purchase date (for XIRR)</label>
                <input
                  className={inputClass}
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                />
              </div>
              <select
                className={inputClass}
                value={form.account_id}
                onChange={(e) => setForm({ ...form, account_id: e.target.value })}
              >
                <option value="">Link account (optional)</option>
                {bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
              >
                {editingId ? "Update" : "Add"}
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2 rounded-xl bg-muted text-muted-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Holdings */}
      {funds.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No mutual funds yet"
          description="Search and add a fund to start tracking its NAV, or set up a SIP."
          actionLabel="Add Mutual Fund"
          onAction={() => setShowAdd(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {funds.map((inv) => {
            const pl = plByName.get(inv.id);
            const linkedSip = sipByInvestment.get(inv.id);
            return (
              <div key={inv.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-foreground line-clamp-1">{inv.name}</h4>
                    <p className="text-[11px] text-muted-foreground">
                      {inv.fund_house || "Mutual Fund"}
                      {inv.scheme_code ? ` · ${inv.scheme_code}` : ""}
                    </p>
                  </div>
                  {linkedSip && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand/10 text-brand border border-brand/30 whitespace-nowrap">
                      <Repeat className="w-3 h-3" /> SIP {fmt(linkedSip.amount)}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Units</p>
                    <p className="font-semibold text-foreground">{inv.quantity.toFixed(3)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">NAV</p>
                    <p className="font-semibold text-foreground">₹{inv.current_price}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">P/L</p>
                    <p className={`font-semibold ${(pl?.profit_loss ?? 0) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {(pl?.profit_loss ?? 0) >= 0 ? "+" : ""}
                      {fmt(pl?.profit_loss ?? 0)}
                      <span className="ml-1 text-[10px]">({pl?.pl_percentage ?? 0}%)</span>
                    </p>
                  </div>
                </div>
                {inv.last_nav_update && (
                  <p className="text-[10px] text-muted-foreground">NAV as of {inv.last_nav_update}</p>
                )}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    onClick={() => {
                      setTopUp({ units: "", price: String(inv.current_price) });
                      setTopUpId(inv.id);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-muted text-xs font-medium text-foreground hover:bg-muted/70"
                  >
                    + Units
                  </button>
                  {!linkedSip && (
                    <button
                      onClick={() => openSip(inv.id)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand/10 text-brand text-xs font-medium hover:bg-brand/20"
                    >
                      <Repeat className="w-3 h-3" /> Start SIP
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(inv.id)}
                    className="px-2 py-1 rounded-lg hover:bg-muted"
                  >
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => setDeleteId(inv.id)}
                    className="px-2 py-1 rounded-lg hover:bg-danger/10"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-danger" />
                  </button>
                </div>

                {/* Top-up inline */}
                {topUpId === inv.id && (
                  <div className="rounded-xl border border-border p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className={inputClass}
                        type="number"
                        placeholder="Units to add"
                        value={topUp.units}
                        onChange={(e) => setTopUp({ ...topUp, units: e.target.value })}
                      />
                      <input
                        className={inputClass}
                        type="number"
                        placeholder="Price / NAV"
                        value={topUp.price}
                        onChange={(e) => setTopUp({ ...topUp, price: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={applyTopUp} className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-medium">
                        Add Units
                      </button>
                      <button onClick={() => setTopUpId(null)} className="px-3 py-1.5 rounded-lg bg-muted text-xs font-medium">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* SIP create inline */}
                {sipFor === inv.id && (
                  <div className="rounded-xl border border-brand/30 bg-brand/5 p-3 space-y-2">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Repeat className="w-3.5 h-3.5 text-brand" /> New SIP — buys units at each due date&apos;s NAV
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className={inputClass}
                        type="number"
                        placeholder="Amount / installment"
                        value={sipForm.amount}
                        onChange={(e) => setSipForm({ ...sipForm, amount: e.target.value })}
                      />
                      <select
                        className={inputClass}
                        value={sipForm.frequency}
                        onChange={(e) => setSipForm({ ...sipForm, frequency: e.target.value })}
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                      <div className="space-y-1">
                        <label className="text-[11px] text-muted-foreground px-1">First / next date</label>
                        <input
                          className={inputClass}
                          type="date"
                          value={sipForm.next_date}
                          onChange={(e) => setSipForm({ ...sipForm, next_date: e.target.value })}
                        />
                      </div>
                      <select
                        className={inputClass}
                        value={sipForm.account_id}
                        onChange={(e) => setSipForm({ ...sipForm, account_id: e.target.value })}
                      >
                        <option value="">Funding account</option>
                        {bankAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.account_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={submitSip} className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-medium">
                        Create SIP
                      </button>
                      <button onClick={() => setSipFor(null)} className="px-3 py-1.5 rounded-lg bg-muted text-xs font-medium">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* SIPs management */}
      {sips.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Repeat className="w-4 h-4 text-brand" /> Your SIPs
            <span className="text-[11px] font-normal text-muted-foreground">
              · also shown on the Recurring page
            </span>
          </h3>
          <div className="rounded-2xl border border-border bg-card divide-y divide-border">
            {sips.map((sip) => (
              <div key={sip.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground line-clamp-1">{sip.fund_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {fmt(sip.amount)} · {sip.frequency} · next {sip.next_date}
                    {sip.status !== "active" ? ` · ${sip.status}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    title="Invest now"
                    onClick={() => investNow.mutate(sip.id)}
                    className="p-1.5 rounded-lg hover:bg-brand/10 text-brand"
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                  {sip.status === "active" ? (
                    <button
                      title="Pause"
                      onClick={() => updateSip.mutate({ id: sip.id, data: { status: "paused" } })}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                    >
                      <Pause className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      title="Resume"
                      onClick={() => updateSip.mutate({ id: sip.id, data: { status: "active" } })}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    title="Delete SIP"
                    onClick={() => setDeleteSipId(sip.id)}
                    className="p-1.5 rounded-lg hover:bg-danger/10 text-danger"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Fund"
        message="This removes the holding. Any linked SIP is kept — delete it separately."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteId) deleteInvestment.mutate(deleteId);
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />
      <ConfirmDialog
        open={!!deleteSipId}
        title="Delete SIP"
        message="The SIP schedule stops. Your existing units are untouched."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteSipId) deleteSip.mutate(deleteSipId);
          setDeleteSipId(null);
        }}
        onCancel={() => setDeleteSipId(null)}
      />
    </div>
  );
}
