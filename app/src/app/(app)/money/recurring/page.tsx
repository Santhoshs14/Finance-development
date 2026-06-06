"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useData } from "@/providers/DataProvider";
import { recurringAPI } from "@/services/api";
import { fmt } from "@/utils/format";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Badge,
} from "@/components/ui";
import EmptyState from "@/components/EmptyState";
import {
  Plus,
  Pause,
  Play,
  Square,
  Trash2,
  Repeat,
  Edit2,
  X,
  Check,
} from "lucide-react";
import toast from "react-hot-toast";
import { SkeletonCard } from "@/components/SkeletonLoader";

type RecurringStatus = "active" | "paused" | "stopped";
type Frequency = "weekly" | "monthly" | "yearly";

interface FormData {
  description: string;
  category: string;
  amount: string;
  frequency: Frequency;
  next_date: string;
  account_id: string;
  payment_type: string;
  type: string;
}

const INITIAL_FORM: FormData = {
  description: "",
  category: "",
  amount: "",
  frequency: "monthly",
  next_date: new Date().toISOString().split("T")[0],
  account_id: "",
  payment_type: "",
  type: "expense",
};

const FREQ_LABEL: Record<Frequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

const STATUS_STYLES: Record<RecurringStatus, string> = {
  active: "bg-success/10 text-success border-success/20",
  paused: "bg-warning/10 text-warning border-warning/20",
  stopped: "bg-danger/10 text-danger border-danger/20",
};

function _getNextDate(current: string, frequency: Frequency): string {
  const d = new Date(current);
  if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "monthly") d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split("T")[0];
}

function getDaysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function RecurringPage() {
  const { recurring, categories, accounts, transactions, dataReady } = useData();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [filterStatus, setFilterStatus] = useState<RecurringStatus | "all">("all");
  const [filterFreq, setFilterFreq] = useState<Frequency | "all">("all");
  const migrationDone = useRef(false);

  // Auto-migrate transactions marked is_recurring into the recurring collection
  useEffect(() => {
    if (migrationDone.current) return;
    if (recurring.length > 0) { migrationDone.current = true; return; }

    const recurringTxns = transactions.filter(
      (t) => (t as unknown as Record<string, unknown>).is_recurring === true
    );
    if (recurringTxns.length === 0) return;
    migrationDone.current = true;

    // Group by description/category to avoid duplicates
    const seen = new Set<string>();
    const toCreate: Record<string, unknown>[] = [];

    for (const t of recurringTxns) {
      const raw = t as unknown as Record<string, unknown>;
      const key = `${(t.description || t.category).toLowerCase()}|${t.category}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const freq = (raw.recurrence_interval || raw.recurring_frequency || "monthly") as string;
      const nextDate = (raw.next_date as string) || t.date;

      toCreate.push({
        description: t.description || t.notes || t.category,
        category: t.category,
        amount: Math.abs(t.amount),
        frequency: freq === "weekly" ? "weekly" : freq === "yearly" ? "yearly" : "monthly",
        next_date: nextDate,
        account_id: t.account_id || "",
        type: t.amount < 0 ? "expense" : "income",
        status: "active",
      });
    }

    if (toCreate.length === 0) return;
    Promise.all(toCreate.map((d) => recurringAPI.create(d))).then(() => {
      toast.success(`Migrated ${toCreate.length} recurring item(s)`);
    }).catch(() => {});
  }, [recurring, transactions]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => recurringAPI.create(data),
    onSuccess: () => {
      toast.success("Recurring item created");
      setShowForm(false);
      setForm(INITIAL_FORM);
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      recurringAPI.update(id, data),
    onSuccess: () => {
      toast.success("Updated");
      setEditingId(null);
      setForm(INITIAL_FORM);
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => recurringAPI.delete(id),
    onSuccess: () => {
      toast.success("Deleted");
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Filtered list
  const filtered = useMemo(() => {
    return recurring.filter((item) => {
      if (filterStatus !== "all" && item.status !== filterStatus) return false;
      if (filterFreq !== "all" && item.frequency !== filterFreq) return false;
      return true;
    });
  }, [recurring, filterStatus, filterFreq]);

  // Summary stats
  const stats = useMemo(() => {
    const active = recurring.filter((r) => r.status === "active");
    const monthlyTotal = active.reduce((sum, r) => {
      if (r.frequency === "monthly") return sum + r.amount;
      if (r.frequency === "weekly") return sum + r.amount * 4.33;
      if (r.frequency === "yearly") return sum + r.amount / 12;
      return sum;
    }, 0);
    const yearlyTotal = monthlyTotal * 12;
    const dueNext7 = active.filter((r) => {
      const days = getDaysUntil(r.next_date);
      return days >= 0 && days <= 7;
    }).length;
    return { total: recurring.length, active: active.length, monthlyTotal, yearlyTotal, dueNext7 };
  }, [recurring]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      description: form.description.trim(),
      category: form.category,
      amount: parseFloat(form.amount),
      frequency: form.frequency,
      next_date: form.next_date,
      account_id: form.account_id || null,
      payment_type: form.payment_type || null,
      type: form.type,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (item: typeof recurring[0]) => {
    setEditingId(item.id);
    setForm({
      description: item.description,
      category: item.category,
      amount: String(item.amount),
      frequency: item.frequency,
      next_date: item.next_date,
      account_id: item.account_id || "",
      payment_type: item.payment_type || "",
      type: item.type || "expense",
    });
    setShowForm(true);
  };

  const handleStatusChange = (id: string, status: RecurringStatus) => {
    updateMutation.mutate({ id, data: { status } });
  };

  if (!dataReady) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={3} />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recurring Transactions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your scheduled bills, subscriptions, and recurring payments
          </p>
        </div>
        <Button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(INITIAL_FORM); }}>
          <Plus className="w-4 h-4 mr-1.5" />
          Add Recurring
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-foreground mt-1">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Monthly Cost</p>
            <p className="text-2xl font-bold text-foreground mt-1">{fmt(stats.monthlyTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Yearly Cost</p>
            <p className="text-2xl font-bold text-foreground mt-1">{fmt(stats.yearlyTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Due (7 days)</p>
            <p className="text-2xl font-bold text-brand mt-1">{stats.dueNext7}</p>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card>
              <CardHeader>
                <CardTitle>{editingId ? "Edit Recurring" : "New Recurring Transaction"}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description *</label>
                    <Input
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Netflix, Rent, Gym..."
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Category *</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
                      required
                    >
                      <option value="">Select category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Amount *</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      placeholder="500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Frequency *</label>
                    <select
                      value={form.frequency}
                      onChange={(e) => setForm({ ...form, frequency: e.target.value as Frequency })}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Next Due Date *</label>
                    <Input
                      type="date"
                      value={form.next_date}
                      onChange={(e) => setForm({ ...form, next_date: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type</label>
                    <select
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
                    >
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Account</label>
                    <select
                      value={form.account_id}
                      onChange={(e) => setForm({ ...form, account_id: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
                    >
                      <option value="">No account</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.account_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Payment Method</label>
                    <select
                      value={form.payment_type}
                      onChange={(e) => setForm({ ...form, payment_type: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
                    >
                      <option value="">Any</option>
                      <option value="UPI">UPI</option>
                      <option value="Debit Card">Debit Card</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>
                  <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-1">
                      <Check className="w-4 h-4 mr-1.5" />
                      {editingId ? "Update" : "Create"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => { setShowForm(false); setEditingId(null); setForm(INITIAL_FORM); }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium">Status:</span>
          {(["all", "active", "paused", "stopped"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-colors capitalize",
                filterStatus === s
                  ? "bg-brand/10 text-brand"
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-4">
          <span className="font-medium">Freq:</span>
          {(["all", "weekly", "monthly", "yearly"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterFreq(f)}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-colors capitalize",
                filterFreq === f
                  ? "bg-brand/10 text-brand"
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Recurring List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No recurring transactions"
          description="Add your bills, subscriptions, and regular payments to track them automatically."
          actionLabel="Add Recurring"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const daysUntil = getDaysUntil(item.next_date);
            const isOverdue = daysUntil < 0 && item.status === "active";
            const isDueSoon = daysUntil >= 0 && daysUntil <= 3 && item.status === "active";

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-xl border transition-all",
                  isOverdue
                    ? "border-danger/30 bg-danger/5"
                    : isDueSoon
                    ? "border-warning/30 bg-warning/5"
                    : "border-border bg-card hover:border-border/80"
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    item.status === "active" ? "bg-brand/10" : "bg-muted"
                  )}
                >
                  {item.status === "paused" ? (
                    <Pause className="w-4 h-4 text-warning" />
                  ) : item.status === "stopped" ? (
                    <Square className="w-4 h-4 text-danger" />
                  ) : (
                    <Repeat className="w-4 h-4 text-brand" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground truncate">
                      {item.description}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] px-1.5 py-0", STATUS_STYLES[item.status])}
                    >
                      {item.status}
                    </Badge>
                    {isOverdue && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-danger/10 text-danger border-danger/20">
                        Overdue
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{item.category}</span>
                    <span>•</span>
                    <span>{FREQ_LABEL[item.frequency]}</span>
                    {item.status === "active" && (
                      <>
                        <span>•</span>
                        <span className={cn(isOverdue && "text-danger", isDueSoon && "text-warning")}>
                          {isOverdue
                            ? `${Math.abs(daysUntil)}d overdue`
                            : daysUntil === 0
                            ? "Due today"
                            : `in ${daysUntil}d`}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <div className="text-right shrink-0">
                  <p className={cn("font-bold text-sm", item.type === "income" ? "text-success" : "text-foreground")}>
                    {item.type === "income" ? "+" : "-"}{fmt(item.amount)}
                  </p>
                  {item.next_date && item.status === "active" && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Next: {new Date(item.next_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {item.status === "active" && (
                    <button
                      onClick={() => handleStatusChange(item.id, "paused")}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-warning hover:bg-warning/10 transition-colors"
                      title="Pause"
                    >
                      <Pause className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {item.status === "paused" && (
                    <button
                      onClick={() => handleStatusChange(item.id, "active")}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-success hover:bg-success/10 transition-colors"
                      title="Resume"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {item.status !== "stopped" && (
                    <button
                      onClick={() => handleStatusChange(item.id, "stopped")}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                      title="Stop"
                    >
                      <Square className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {item.status === "stopped" && (
                    <button
                      onClick={() => handleStatusChange(item.id, "active")}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-success hover:bg-success/10 transition-colors"
                      title="Reactivate"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this recurring item?")) {
                        deleteMutation.mutate(item.id);
                      }
                    }}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
