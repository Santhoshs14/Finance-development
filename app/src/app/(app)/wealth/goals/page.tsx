"use client";

import { useState, useMemo } from "react";
import { useGoals, useGoalMutations } from "@/hooks/useGoals";
import { useInvestments } from "@/hooks/useInvestments";
import { useCelebration } from "@/hooks/useCelebration";
import { calculateGoalCompletion } from "@/utils/calculations";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useTheme } from "@/providers/ThemeProvider";
import { Target, Plus, Pencil, Trash2, PiggyBank, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function GoalsPage() {
  const { goals, isLoading } = useGoals();
  const { addGoal, updateGoal, deleteGoal } = useGoalMutations();
  const { investments } = useInvestments();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { celebrate } = useCelebration();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [addFundsId, setAddFundsId] = useState<string | null>(null);
  const [addFundsAmount, setAddFundsAmount] = useState("");

  const [form, setForm] = useState({
    goal_name: "",
    target_amount: "",
    current_amount: "",
    deadline: "",
  });

  const goalData = useMemo(
    () => goals.map((g) => ({ ...g, completion: calculateGoalCompletion(g) })),
    [goals]
  );

  const summary = useMemo(() => {
    const totalTarget = goals.reduce((s, g) => s + g.target_amount, 0);
    const totalSaved = goals.reduce((s, g) => s + g.current_amount, 0);
    const onTrack = goalData.filter((g) => g.completion.on_track).length;
    return { totalTarget, totalSaved, onTrack, total: goals.length };
  }, [goals, goalData]);

  // Linked investments per goal
  const linkedInvestments = useMemo(() => {
    const map: Record<string, typeof investments> = {};
    investments.forEach((inv) => {
      if (inv.linked_goal_id) {
        if (!map[inv.linked_goal_id]) map[inv.linked_goal_id] = [];
        map[inv.linked_goal_id].push(inv);
      }
    });
    return map;
  }, [investments]);

  const resetForm = () => {
    setForm({ goal_name: "", target_amount: "", current_amount: "", deadline: "" });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = () => {
    const payload = {
      goal_name: form.goal_name.trim(),
      target_amount: parseFloat(form.target_amount) || 0,
      current_amount: parseFloat(form.current_amount) || 0,
      deadline: form.deadline,
    };
    if (!payload.goal_name || payload.target_amount <= 0) return;

    if (editingId) {
      updateGoal.mutate({ id: editingId, data: payload });
    } else {
      addGoal.mutate(payload);
    }
    resetForm();
  };

  const handleEdit = (goal: (typeof goals)[0]) => {
    setForm({
      goal_name: goal.goal_name,
      target_amount: String(goal.target_amount),
      current_amount: String(goal.current_amount),
      deadline: goal.deadline,
    });
    setEditingId(goal.id);
    setShowForm(true);
  };

  const handleAddFunds = () => {
    const amount = parseFloat(addFundsAmount) || 0;
    if (!addFundsId || amount <= 0) return;
    const goal = goals.find((g) => g.id === addFundsId);
    if (!goal) return;

    const prevPercent = Math.round((goal.current_amount / goal.target_amount) * 100);
    const newPercent = Math.round(((goal.current_amount + amount) / goal.target_amount) * 100);

    updateGoal.mutate({
      id: addFundsId,
      data: { current_amount: goal.current_amount + amount },
    });

    // Fire confetti if milestone crossed
    celebrate(addFundsId, prevPercent, newPercent);

    setAddFundsId(null);
    setAddFundsAmount("");
  };

  if (isLoading) {
    return <div className="animate-pulse space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted" />)}</div>;
  }

  if (goals.length === 0 && !showForm) {
    return (
      <EmptyState
        icon={Target}
        title="No goals yet"
        description="Set financial targets, track your progress, and stay motivated. Create your first savings goal."
        actionLabel="Create Goal"
        onAction={() => setShowForm(true)}
      />
    );
  }

  const inputClass = `w-full rounded-xl px-3 py-2 text-sm border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40`;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Target" value={summary.totalTarget} icon={Target} delay={0} />
        <StatCard title="Total Saved" value={summary.totalSaved} color="accent" delay={0.1} />
        <StatCard title="On Track" value={summary.onTrack} prefix="" suffix={`/${summary.total}`} color="primary" delay={0.2} />
      </div>

      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Goal
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
            <h3 className="text-sm font-bold text-foreground">{editingId ? "Edit Goal" : "Create Goal"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input className={inputClass} placeholder="Goal name (e.g. Emergency Fund)" value={form.goal_name} onChange={(e) => setForm({ ...form, goal_name: e.target.value })} />
              <input className={inputClass} type="number" placeholder="Target Amount (₹)" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} />
              <input className={inputClass} type="number" placeholder="Current Amount (₹)" value={form.current_amount} onChange={(e) => setForm({ ...form, current_amount: e.target.value })} />
              <input className={inputClass} type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSubmit} className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors">
                {editingId ? "Update" : "Create"}
              </button>
              <button onClick={resetForm} className="px-4 py-2 rounded-xl bg-muted text-muted-foreground text-sm font-medium hover:bg-muted/80 transition-colors">
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Goal Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goalData.map((g, idx) => {
          const c = g.completion;
          const linked = linkedInvestments[g.id] || [];
          const isComplete = c.progress_percentage >= 100;

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
                <div className="flex items-center gap-2">
                  {isComplete ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <PiggyBank className="w-5 h-5 text-brand" />
                  )}
                  <h4 className="text-sm font-bold text-foreground">{g.goal_name}</h4>
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

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">
                    ₹{g.current_amount.toLocaleString("en-IN")} / ₹{g.target_amount.toLocaleString("en-IN")}
                  </span>
                  <span className={`font-semibold ${isComplete ? "text-emerald-500" : "text-foreground"}`}>
                    {c.progress_percentage}%
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(100, c.progress_percentage)}%`,
                      background: isComplete ? "#10b981" : "#1abf94",
                    }}
                  />
                </div>
              </div>

              {/* Info row */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Remaining</p>
                  <p className="font-semibold text-foreground">₹{c.remaining.toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Monthly Req.</p>
                  <p className="font-semibold text-foreground">₹{c.monthly_savings_required.toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Months Left</p>
                  <p className="font-semibold text-foreground">{c.months_remaining}</p>
                </div>
              </div>

              {/* On track badge */}
              <div className="flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                  c.on_track ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                }`}>
                  {c.on_track ? "On Track" : "Needs Attention"}
                </span>
                {!isComplete && (
                  <button
                    onClick={() => { setAddFundsId(g.id); setAddFundsAmount(""); }}
                    className="text-xs font-medium text-brand hover:underline"
                  >
                    + Add Funds
                  </button>
                )}
              </div>

              {/* Add Funds inline */}
              {addFundsId === g.id && (
                <div className="flex gap-2 pt-1">
                  <input
                    className={inputClass}
                    type="number"
                    placeholder="Amount (₹)"
                    value={addFundsAmount}
                    onChange={(e) => setAddFundsAmount(e.target.value)}
                    autoFocus
                  />
                  <button onClick={handleAddFunds} className="px-3 py-2 rounded-xl bg-brand text-white text-xs font-medium shrink-0">
                    Add
                  </button>
                  <button onClick={() => setAddFundsId(null)} className="px-3 py-2 rounded-xl bg-muted text-muted-foreground text-xs font-medium shrink-0">
                    Cancel
                  </button>
                </div>
              )}

              {/* Linked investments */}
              {linked.length > 0 && (
                <div className="pt-1 border-t border-border">
                  <p className="text-[11px] text-muted-foreground mb-1">Linked Investments:</p>
                  <div className="flex flex-wrap gap-1">
                    {linked.map((inv) => (
                      <span key={inv.id} className="px-2 py-0.5 rounded-full bg-brand/10 text-brand text-[11px] font-medium">
                        {inv.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Goal"
        message="This will permanently remove this savings goal."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteId) deleteGoal.mutate(deleteId); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
