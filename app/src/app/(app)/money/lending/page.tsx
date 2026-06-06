"use client";

import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { lendingAPI } from "@/services/api";
import { fmt } from "@/utils/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input } from "@/components/ui";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Plus, ArrowUpRight, ArrowDownRight, Search, Trash2, X, Users } from "lucide-react";
import toast from "react-hot-toast";

interface LendingRecord {
  id: string;
  person_name: string;
  amount: number;
  paid_amount?: number;
  type: string;
  status: string;
  date: string;
}

export default function LendingPage() {
  const { user } = useAuth();
  const _queryClient = useQueryClient();
  const [records, setRecords] = useState<LendingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ person_name: "", amount: "", type: "lent", date: new Date().toISOString().split("T")[0] });
  const [repayId, setRepayId] = useState<string | null>(null);
  const [repayAmount, setRepayAmount] = useState("");
  const [confirmState, setConfirmState] = useState<{ open: boolean; id?: string; name?: string }>({ open: false });
  const [tab, setTab] = useState<"active" | "settled">("active");
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "amount" | "name">("date");

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/lending`), orderBy("date", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() } as LendingRecord)));
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const addMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => lendingAPI.create(data as Parameters<typeof lendingAPI.create>[0]),
    onSuccess: () => { toast.success("Record added!"); setShowAdd(false); setForm({ person_name: "", amount: "", type: "lent", date: new Date().toISOString().split("T")[0] }); },
    onError: () => toast.error("Failed"),
  });

  const repayMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => lendingAPI.repay(id, amount),
    onSuccess: () => { toast.success("Repayment recorded!"); setRepayId(null); setRepayAmount(""); },
    onError: () => toast.error("Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => lendingAPI.delete(id),
    onSuccess: () => toast.success("Deleted!"),
    onError: () => toast.error("Failed"),
  });

  const totalLent = records.filter((r) => r.type === "lent" && r.status !== "settled").reduce((s, r) => s + ((r.amount || 0) - (r.paid_amount || 0)), 0);
  const totalBorrowed = records.filter((r) => r.type === "borrowed" && r.status !== "settled").reduce((s, r) => s + ((r.amount || 0) - (r.paid_amount || 0)), 0);

  const filteredRecords = useMemo(() => {
    let result = records.filter((r) => {
      const outstanding = (r.amount || 0) - (r.paid_amount || 0);
      const isSettled = r.status === "settled" || outstanding <= 0;
      return tab === "active" ? !isSettled : isSettled;
    });

    if (searchText.trim()) {
      const s = searchText.toLowerCase();
      result = result.filter((r) => r.person_name.toLowerCase().includes(s));
    }

    result = [...result].sort((a, b) => {
      if (sortBy === "date") return b.date.localeCompare(a.date);
      if (sortBy === "amount") return (b.amount || 0) - (a.amount || 0);
      return a.person_name.localeCompare(b.person_name);
    });

    return result;
  }, [records, tab, searchText, sortBy]);

  // Per-person summary
  const personSummary = useMemo(() => {
    const map: Record<string, { name: string; lent: number; borrowed: number; net: number }> = {};
    records.filter((r) => r.status !== "settled").forEach((r) => {
      const outstanding = (r.amount || 0) - (r.paid_amount || 0);
      if (outstanding <= 0) return;
      if (!map[r.person_name]) map[r.person_name] = { name: r.person_name, lent: 0, borrowed: 0, net: 0 };
      if (r.type === "lent") map[r.person_name].lent += outstanding;
      else map[r.person_name].borrowed += outstanding;
      map[r.person_name].net = map[r.person_name].lent - map[r.person_name].borrowed;
    });
    return Object.values(map).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [records]);

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="w-10 h-10 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-muted-foreground mt-0.5">{records.length} records · {personSummary.length} people</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)} className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Record
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpRight className="w-4 h-4 text-success" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase">People Owe You</span>
            </div>
            <p className="text-xl font-bold text-success">{fmt(totalLent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownRight className="w-4 h-4 text-danger" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase">You Owe</span>
            </div>
            <p className="text-xl font-bold text-danger">{fmt(totalBorrowed)}</p>
          </CardContent>
        </Card>
        <Card className="hidden sm:block">
          <CardContent className="p-4">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">Net Position</span>
            <p className={cn("text-xl font-bold mt-1", totalLent - totalBorrowed >= 0 ? "text-success" : "text-danger")}>
              {fmt(totalLent - totalBorrowed)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-Person Summary */}
      {personSummary.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4" /> Per-Person Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex flex-wrap gap-2">
              {personSummary.slice(0, 8).map((p) => (
                <button
                  key={p.name}
                  onClick={() => setSearchText(p.name)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all hover:bg-muted/50",
                    p.net > 0 ? "border-success/30" : "border-danger/30"
                  )}
                >
                  <span className="text-foreground">{p.name}</span>
                  <span className={p.net > 0 ? "text-success" : "text-danger"}>{p.net > 0 ? "+" : ""}{fmt(p.net)}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs + Search + Sort */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button onClick={() => setTab("active")} className={cn("px-3 py-1.5 text-xs font-medium transition-colors", tab === "active" ? "bg-brand text-white" : "text-muted-foreground hover:bg-muted")}>Active</button>
          <button onClick={() => setTab("settled")} className={cn("px-3 py-1.5 text-xs font-medium transition-colors", tab === "settled" ? "bg-brand text-white" : "text-muted-foreground hover:bg-muted")}>Settled</button>
        </div>
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search by name..." className="pl-9 h-8 text-sm" />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">Sort:</span>
          {(["date", "amount", "name"] as const).map((col) => (
            <button key={col} onClick={() => setSortBy(col)} className={cn("px-2 py-1 rounded text-[11px] font-medium capitalize transition-colors", sortBy === col ? "bg-brand/10 text-brand" : "text-muted-foreground hover:text-foreground")}>
              {col}
            </button>
          ))}
        </div>
      </div>

      {/* Add Form */}
      {showAdd && (
        <Card className="border-brand/20">
          <CardContent className="p-5">
            <form onSubmit={(e) => { e.preventDefault(); addMutation.mutate({ person_name: form.person_name, amount: parseFloat(form.amount), type: form.type, status: "pending", date: form.date }); }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input value={form.person_name} onChange={(e) => setForm({ ...form, person_name: e.target.value })} placeholder="Person Name" required />
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Amount (₹)" required />
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="h-9 px-3 rounded-lg border border-input bg-card text-sm text-foreground">
                  <option value="lent">Lent (they owe me)</option>
                  <option value="borrowed">Borrowed (I owe them)</option>
                </select>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm">Add</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Records */}
      {filteredRecords.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-lg font-semibold text-foreground">{tab === "active" ? "No active records" : "No settled records"}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {searchText ? "Try a different search" : tab === "active" ? "Add your first lending record" : "Settle records to see them here"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredRecords.map((r) => {
            const outstanding = (r.amount || 0) - (r.paid_amount || 0);
            const isSettled = r.status === "settled" || outstanding <= 0;
            return (
              <Card key={r.id} className={cn(isSettled && "opacity-60")}>
                <CardContent className="p-4 flex flex-wrap items-center gap-4">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", r.type === "lent" ? "bg-success/10" : "bg-danger/10")}>
                    {r.type === "lent" ? <ArrowUpRight className="w-4 h-4 text-success" /> : <ArrowDownRight className="w-4 h-4 text-danger" />}
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <p className="text-sm font-semibold text-foreground">{r.person_name}</p>
                    <p className="text-[11px] text-muted-foreground">{r.type === "lent" ? "You lent" : "You borrowed"} · {new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-base font-bold", r.type === "lent" ? "text-success" : "text-danger")}>{fmt(r.amount)}</p>
                    {!isSettled && <p className="text-[11px] text-muted-foreground">Remaining: {fmt(outstanding)}</p>}
                    {isSettled && <Badge variant="success" className="text-[10px]">Settled</Badge>}
                  </div>
                  {!isSettled && (
                    <div className="flex gap-2 items-center">
                      {repayId === r.id ? (
                        <form onSubmit={(e) => { e.preventDefault(); repayMutation.mutate({ id: r.id, amount: parseFloat(repayAmount) }); }} className="flex gap-1.5 items-center">
                          <Input type="number" value={repayAmount} onChange={(e) => setRepayAmount(e.target.value)} placeholder="₹" className="w-20 h-7 text-xs" required />
                          <Button type="submit" size="sm" className="h-7 px-2 text-[11px]">Record</Button>
                          <button type="button" onClick={() => setRepayId(null)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                        </form>
                      ) : (
                        <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setRepayId(r.id)}>Repay</Button>
                      )}
                      <button onClick={() => setConfirmState({ open: true, id: r.id, name: r.person_name })} className="p-1.5 text-danger/70 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog open={confirmState.open} title={`Delete record for "${confirmState.name}"?`} message="This will permanently remove this record." confirmColor="danger" onConfirm={() => { if (confirmState.id) deleteMutation.mutate(confirmState.id); setConfirmState({ open: false }); }} onCancel={() => setConfirmState({ open: false })} />
    </div>
  );
}
