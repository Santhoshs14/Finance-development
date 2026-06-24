"use client";

import { useState, useMemo } from "react";
import { useInvestments, useInvestmentMutations } from "@/hooks/useInvestments";
import { useData } from "@/providers/DataProvider";
import {
  calculateInvestmentPL,
  daysToMaturity,
  projectMaturityValue,
} from "@/utils/calculations";
import { fmt } from "@/utils/format";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Landmark, Plus, Pencil, Trash2, X, CalendarClock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

const OTHER_TYPES = [
  "FD",
  "RD",
  "PPF",
  "EPF",
  "NPS",
  "Bond",
  "Equity",
  "Real Estate",
  "Crypto",
  "Other",
] as const;

// Types that exist on the dedicated Mutual Funds / Gold tabs — hidden here.
const OWNED_ELSEWHERE = new Set(["Mutual Fund", "Gold"]);
const FIXED_INCOME = new Set(["FD", "RD", "PPF", "EPF", "NPS", "Bond"]);

const inputClass =
  "w-full rounded-xl px-3 py-2 text-sm border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40";

const emptyForm = {
  name: "",
  investment_type: "FD",
  principal: "",
  current_value: "",
  quantity: "",
  interest_rate: "",
  start_date: "",
  maturity_date: "",
  institution: "",
  compounding: "quarterly",
  account_id: "",
};

export default function OtherInvestmentsPage() {
  const { investments, isLoading } = useInvestments();
  const { addInvestment, updateInvestment, deleteInvestment } = useInvestmentMutations();
  const { accounts } = useData();

  const bankAccounts = useMemo(
    () => accounts.filter((a) => a.type !== "credit"),
    [accounts]
  );

  const items = useMemo(
    () =>
      investments.filter(
        (i) => !OWNED_ELSEWHERE.has(i.investment_type || "") &&
          (OTHER_TYPES as readonly string[]).includes(i.investment_type || "Other")
      ),
    [investments]
  );

  const totals = useMemo(() => {
    const invested = items.reduce((s, i) => s + (i.buy_price * i.quantity || i.invested_amount || 0), 0);
    const current = items.reduce(
      (s, i) => s + (i.current_price * i.quantity || i.current_value || 0),
      0
    );
    return { invested, current, pl: current - invested };
  }, [items]);

  const plById = useMemo(() => {
    const pl = calculateInvestmentPL(items);
    return new Map(items.map((it, i) => [it.id, pl[i]]));
  }, [items]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof items>();
    items.forEach((it) => {
      const key = it.investment_type || "Other";
      const arr = map.get(key) || [];
      arr.push(it);
      map.set(key, arr);
    });
    return [...map.entries()];
  }, [items]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const isFixed = FIXED_INCOME.has(form.investment_type);

  const reset = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(false);
  };

  const projForForm = useMemo(() => {
    if (!isFixed) return null;
    const p = parseFloat(form.principal) || 0;
    const rate = parseFloat(form.interest_rate) || 0;
    if (!(p > 0) || !(rate > 0) || !form.start_date || !form.maturity_date) return null;
    const years =
      (new Date(form.maturity_date).getTime() - new Date(form.start_date).getTime()) /
      (365.25 * 86_400_000);
    if (!(years > 0)) return null;
    return projectMaturityValue(p, rate, years, form.compounding);
  }, [isFixed, form]);

  const submit = () => {
    const name = form.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    const principal = parseFloat(form.principal) || 0;
    const qty = isFixed ? 1 : parseFloat(form.quantity) || 1;
    const buyPrice = isFixed ? principal : parseFloat(form.principal) || 0;
    const currentValue = parseFloat(form.current_value);
    const currentPrice = isFixed
      ? Number.isFinite(currentValue)
        ? currentValue
        : principal
      : Number.isFinite(currentValue)
        ? currentValue
        : buyPrice;

    if (!(buyPrice > 0)) {
      toast.error(isFixed ? "Enter the invested principal" : "Enter the buy price");
      return;
    }

    const payload: Record<string, unknown> = {
      name,
      investment_type: form.investment_type,
      buy_price: buyPrice,
      current_price: currentPrice,
      quantity: qty,
      account_id: form.account_id || null,
    };
    if (form.interest_rate) payload.interest_rate = parseFloat(form.interest_rate);
    if (form.start_date) payload.start_date = form.start_date;
    if (form.maturity_date) payload.maturity_date = form.maturity_date;
    if (form.institution.trim()) payload.institution = form.institution.trim();
    if (isFixed) payload.compounding = form.compounding;

    if (editingId) updateInvestment.mutate({ id: editingId, data: payload });
    else addInvestment.mutate(payload);
    reset();
  };

  const edit = (id: string) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    setForm({
      name: it.name,
      investment_type: it.investment_type || "Other",
      principal: String(it.buy_price),
      current_value: String(it.current_price),
      quantity: String(it.quantity),
      interest_rate: it.interest_rate != null ? String(it.interest_rate) : "",
      start_date: it.start_date || "",
      maturity_date: it.maturity_date || "",
      institution: it.institution || "",
      compounding: it.compounding || "quarterly",
      account_id: it.account_id || "",
    });
    setEditingId(id);
    setShowForm(true);
  };

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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard title="Invested" value={totals.invested} icon={Landmark} delay={0} />
        <StatCard title="Current Value" value={totals.current} color="accent" delay={0.1} />
        <StatCard title="P/L" value={totals.pl} color={totals.pl >= 0 ? "primary" : "danger"} delay={0.2} />
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => {
            reset();
            setShowForm(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Investment
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-2xl border border-border bg-card p-5 space-y-4 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">
                {editingId ? "Edit Investment" : "Add Investment"}
              </h3>
              <button onClick={reset} className="p-1 rounded-lg hover:bg-muted">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <input
                className={inputClass}
                placeholder="Name (e.g. SBI 5-yr FD)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <select
                className={inputClass}
                value={form.investment_type}
                onChange={(e) => setForm({ ...form, investment_type: e.target.value })}
              >
                {OTHER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                className={inputClass}
                placeholder={isFixed ? "Bank / institution" : "Issuer / platform (optional)"}
                value={form.institution}
                onChange={(e) => setForm({ ...form, institution: e.target.value })}
              />
              <input
                className={inputClass}
                type="number"
                placeholder={isFixed ? "Principal invested (₹)" : "Buy price (total ₹)"}
                value={form.principal}
                onChange={(e) => setForm({ ...form, principal: e.target.value })}
              />
              <input
                className={inputClass}
                type="number"
                placeholder="Current value (₹)"
                value={form.current_value}
                onChange={(e) => setForm({ ...form, current_value: e.target.value })}
              />
              {!isFixed && (
                <input
                  className={inputClass}
                  type="number"
                  placeholder="Quantity / units"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              )}
              {isFixed && (
                <>
                  <input
                    className={inputClass}
                    type="number"
                    placeholder="Interest rate % p.a."
                    value={form.interest_rate}
                    onChange={(e) => setForm({ ...form, interest_rate: e.target.value })}
                  />
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground px-1">Start date</label>
                    <input
                      className={inputClass}
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground px-1">Maturity date</label>
                    <input
                      className={inputClass}
                      type="date"
                      value={form.maturity_date}
                      onChange={(e) => setForm({ ...form, maturity_date: e.target.value })}
                    />
                  </div>
                  <select
                    className={inputClass}
                    value={form.compounding}
                    onChange={(e) => setForm({ ...form, compounding: e.target.value })}
                  >
                    <option value="simple">Simple interest</option>
                    <option value="monthly">Compounded monthly</option>
                    <option value="quarterly">Compounded quarterly</option>
                    <option value="halfyearly">Compounded half-yearly</option>
                    <option value="annually">Compounded annually</option>
                  </select>
                </>
              )}
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
            {projForForm != null && (
              <p className="text-[12px] text-muted-foreground">
                Estimated maturity value: <span className="font-semibold text-foreground">{fmt(projForForm)}</span>
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={submit} className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors">
                {editingId ? "Update" : "Add"}
              </button>
              <button onClick={reset} className="px-4 py-2 rounded-xl bg-muted text-muted-foreground text-sm font-medium hover:bg-muted/80 transition-colors">
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {items.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No other investments yet"
          description="Track fixed deposits, PPF, NPS, bonds, stocks, real estate, crypto and more — fully manual."
          actionLabel="Add Investment"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([type, list]) => (
            <div key={type} className="space-y-2">
              <h3 className="text-sm font-bold text-foreground">{type}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {list.map((it) => {
                  const pl = plById.get(it.id);
                  const days = daysToMaturity(it.maturity_date);
                  return (
                    <div key={it.id} className="rounded-2xl border border-border bg-card p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-foreground line-clamp-1">{it.name}</h4>
                          {it.institution && (
                            <p className="text-[11px] text-muted-foreground">{it.institution}</p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => edit(it.id)} className="p-1.5 rounded-lg hover:bg-muted">
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button onClick={() => setDeleteId(it.id)} className="p-1.5 rounded-lg hover:bg-danger/10">
                            <Trash2 className="w-3.5 h-3.5 text-danger" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Invested</p>
                          <p className="font-semibold text-foreground">{fmt(pl?.invested ?? 0)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Current</p>
                          <p className="font-semibold text-foreground">{fmt(pl?.current_value ?? 0)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">P/L</p>
                          <p className={`font-semibold ${(pl?.profit_loss ?? 0) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                            {(pl?.profit_loss ?? 0) >= 0 ? "+" : ""}
                            {fmt(pl?.profit_loss ?? 0)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        {it.interest_rate != null && it.interest_rate > 0 ? (
                          <span>{it.interest_rate}% p.a.</span>
                        ) : (
                          <span />
                        )}
                        {days != null && days >= 0 && (
                          <span className="flex items-center gap-1">
                            <CalendarClock className="w-3 h-3" />
                            {days === 0 ? "matures today" : `matures in ${days}d`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Investment"
        message="This permanently removes the holding."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteId) deleteInvestment.mutate(deleteId);
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
