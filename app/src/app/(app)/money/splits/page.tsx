"use client";

import { useState, useEffect, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { splitsAPI } from "@/services/api";
import { fmt } from "@/utils/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, Button, Badge, Input } from "@/components/ui";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { Plus, Receipt, CheckCircle2, X, Users, ArrowRight, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";

interface Participant {
  name: string;
  share: number;
}

interface Settlement {
  from: string;
  to: string;
  amount: number;
  date: string;
}

interface SplitRecord {
  id: string;
  description: string;
  total_amount: number;
  date: string;
  paid_by: string;
  participants: Participant[];
  settled: boolean;
  settlements: Settlement[];
}

export default function SplitsPage() {
  const { user } = useAuth();
  const [splits, setSplits] = useState<SplitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<"active" | "settled">("active");
  const [settleModal, setSettleModal] = useState<{ open: boolean; split?: SplitRecord }>({ open: false });
  const [settleForm, setSettleForm] = useState({ from: "", amount: "" });
  const [confirmState, setConfirmState] = useState<{ open: boolean; id?: string }>({ open: false });

  // Add form state
  const [form, setForm] = useState({
    description: "",
    total_amount: "",
    date: new Date().toISOString().split("T")[0],
    paid_by: "You",
    participants: [{ name: "You", share: 0 }] as Participant[],
  });
  const [newParticipant, setNewParticipant] = useState("");

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/splits`), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setSplits(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SplitRecord)));
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const filteredSplits = useMemo(() => {
    return splits.filter((s) => (tab === "active" ? !s.settled : s.settled));
  }, [splits, tab]);

  // Balances: who owes you / you owe
  const balances = useMemo(() => {
    const map = new Map<string, number>();
    for (const split of splits) {
      if (split.settled) continue;
      for (const p of split.participants) {
        if (p.name === split.paid_by) continue;
        const settledAmt = split.settlements
          .filter((s) => s.from === p.name && s.to === split.paid_by)
          .reduce((sum, s) => sum + s.amount, 0);
        const remaining = p.share - settledAmt;
        if (remaining <= 0) continue;

        if (split.paid_by === "You") {
          map.set(p.name, (map.get(p.name) || 0) + remaining);
        } else if (p.name === "You") {
          map.set(split.paid_by, (map.get(split.paid_by) || 0) - remaining);
        }
      }
    }
    return map;
  }, [splits]);

  const totalOwed = useMemo(() => {
    let owed = 0;
    let owe = 0;
    balances.forEach((v) => { if (v > 0) owed += v; else owe += Math.abs(v); });
    return { owed, owe };
  }, [balances]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => splitsAPI.create(data),
    onSuccess: () => {
      toast.success("Split created!");
      setShowAdd(false);
      setForm({ description: "", total_amount: "", date: new Date().toISOString().split("T")[0], paid_by: "You", participants: [{ name: "You", share: 0 }] });
    },
    onError: () => toast.error("Failed to create split"),
  });

  const settleMutation = useMutation({
    mutationFn: ({ id, settlement }: { id: string; settlement: { from: string; to: string; amount: number } }) =>
      splitsAPI.settle(id, settlement),
    onSuccess: () => { toast.success("Settlement recorded!"); setSettleModal({ open: false }); setSettleForm({ from: "", amount: "" }); },
    onError: () => toast.error("Settlement failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => splitsAPI.delete(id),
    onSuccess: () => toast.success("Split deleted"),
    onError: () => toast.error("Failed to delete"),
  });

  // Helpers
  function addParticipant() {
    const name = newParticipant.trim();
    if (!name || form.participants.some((p) => p.name === name)) return;
    setForm({ ...form, participants: [...form.participants, { name, share: 0 }] });
    setNewParticipant("");
  }

  function removeParticipant(name: string) {
    setForm({ ...form, participants: form.participants.filter((p) => p.name !== name) });
  }

  function splitEqually() {
    const total = parseFloat(form.total_amount) || 0;
    const count = form.participants.length;
    if (count === 0) return;
    const share = Math.round((total / count) * 100) / 100;
    setForm({ ...form, participants: form.participants.map((p) => ({ ...p, share })) });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const total = parseFloat(form.total_amount);
    if (!form.description || !total || form.participants.length < 2) {
      toast.error("Fill in description, amount, and at least 2 participants");
      return;
    }
    createMutation.mutate({
      description: form.description,
      total_amount: total,
      date: form.date,
      paid_by: form.paid_by,
      participants: form.participants,
    });
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Split Expenses</h1>
        <Button onClick={() => setShowAdd(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> New Split
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">You are owed</p>
            <p className="text-xl font-bold text-emerald-500">{fmt(totalOwed.owed)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">You owe</p>
            <p className="text-xl font-bold text-red-500">{fmt(totalOwed.owe)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Active Splits</p>
            <p className="text-xl font-bold text-foreground">{splits.filter((s) => !s.settled).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Balance Breakdown */}
      {balances.size > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Balances</h3>
            {Array.from(balances.entries()).map(([name, amount]) => (
              <div key={name} className="flex items-center justify-between py-1">
                <span className="text-sm text-foreground">{name}</span>
                <span className={cn("text-sm font-medium", amount > 0 ? "text-emerald-500" : "text-red-500")}>
                  {amount > 0 ? `owes you ${fmt(amount)}` : `you owe ${fmt(Math.abs(amount))}`}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {(["active", "settled"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              tab === t ? "bg-brand text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {t === "active" ? "Active" : "Settled"}
          </button>
        ))}
      </div>

      {/* Splits List */}
      {filteredSplits.length === 0 ? (
        <EmptyState
          icon={Users}
          title={tab === "active" ? "No active splits" : "No settled splits"}
          description="Create a split to track shared expenses"
        />
      ) : (
        <div className="space-y-3">
          {filteredSplits.map((split) => (
            <motion.div key={split.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-brand" />
                        <h4 className="text-sm font-semibold text-foreground">{split.description}</h4>
                        {split.settled && <Badge variant="secondary" className="text-xs">Settled</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {split.date} · Paid by <span className="font-medium">{split.paid_by}</span> · {fmt(split.total_amount)}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {split.participants.map((p) => (
                          <span key={p.name} className="inline-flex items-center px-2 py-0.5 text-xs bg-muted rounded-full text-muted-foreground">
                            {p.name}: {fmt(p.share)}
                          </span>
                        ))}
                      </div>
                      {split.settlements.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {split.settlements.map((s, i) => (
                            <div key={i} className="flex items-center gap-1 text-xs text-emerald-600">
                              <CheckCircle2 className="h-3 w-3" />
                              {s.from} paid {s.to} {fmt(s.amount)} on {s.date}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {!split.settled && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setSettleModal({ open: true, split }); setSettleForm({ from: "", amount: "" }); }}
                        >
                          Settle
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmState({ open: true, id: split.id })}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Split Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground">New Split</h3>
                <button onClick={() => setShowAdd(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
              </div>
              <form onSubmit={handleCreate} className="space-y-3">
                <Input
                  placeholder="Description (e.g., Dinner at XYZ)"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    placeholder="Total amount"
                    value={form.total_amount}
                    onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
                    required
                    min="0"
                    step="0.01"
                  />
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Paid by</label>
                  <select
                    value={form.paid_by}
                    onChange={(e) => setForm({ ...form, paid_by: e.target.value })}
                    className="w-full mt-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                  >
                    {form.participants.map((p) => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Participants</label>
                    <button type="button" onClick={splitEqually} className="text-xs text-brand hover:underline">
                      Split Equally
                    </button>
                  </div>
                  <div className="mt-2 space-y-2">
                    {form.participants.map((p, idx) => (
                      <div key={p.name} className="flex items-center gap-2">
                        <span className="text-sm text-foreground flex-1">{p.name}</span>
                        <Input
                          type="number"
                          className="w-24"
                          placeholder="Share"
                          value={p.share || ""}
                          onChange={(e) => {
                            const updated = [...form.participants];
                            updated[idx] = { ...p, share: parseFloat(e.target.value) || 0 };
                            setForm({ ...form, participants: updated });
                          }}
                          min="0"
                          step="0.01"
                        />
                        {p.name !== "You" && (
                          <button type="button" onClick={() => removeParticipant(p.name)}>
                            <X className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Add person"
                      value={newParticipant}
                      onChange={(e) => setNewParticipant(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addParticipant(); } }}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={addParticipant}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Split"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Settle Modal */}
      {settleModal.open && settleModal.split && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-sm">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground">Record Settlement</h3>
                <button onClick={() => setSettleModal({ open: false })}><X className="h-4 w-4 text-muted-foreground" /></button>
              </div>
              <p className="text-xs text-muted-foreground">{settleModal.split.description}</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Who paid?</label>
                  <select
                    value={settleForm.from}
                    onChange={(e) => setSettleForm({ ...settleForm, from: e.target.value })}
                    className="w-full mt-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">Select person</option>
                    {settleModal.split.participants
                      .filter((p) => p.name !== settleModal.split!.paid_by)
                      .map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ArrowRight className="h-3 w-3" /> pays {settleModal.split.paid_by}
                </div>
                <Input
                  type="number"
                  placeholder="Amount"
                  value={settleForm.amount}
                  onChange={(e) => setSettleForm({ ...settleForm, amount: e.target.value })}
                  min="0"
                  step="0.01"
                />
                <Button
                  className="w-full"
                  disabled={!settleForm.from || !settleForm.amount || settleMutation.isPending}
                  onClick={() => {
                    if (!settleModal.split) return;
                    settleMutation.mutate({
                      id: settleModal.split.id,
                      settlement: {
                        from: settleForm.from,
                        to: settleModal.split.paid_by,
                        amount: parseFloat(settleForm.amount),
                      },
                    });
                  }}
                >
                  {settleMutation.isPending ? "Recording..." : "Record Payment"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={confirmState.open}
        title="Delete Split"
        message="Are you sure? This cannot be undone."
        confirmLabel="Delete"
        confirmColor="danger"
        onConfirm={() => {
          if (confirmState.id) deleteMutation.mutate(confirmState.id);
          setConfirmState({ open: false });
        }}
        onCancel={() => setConfirmState({ open: false })}
      />
    </div>
  );
}
