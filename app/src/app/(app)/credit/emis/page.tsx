"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useData } from "@/providers/DataProvider";
import { emisAPI } from "@/services/api";
import { fmt } from "@/utils/format";
import { Card, CardContent, Button, Input, Progress, Badge } from "@/components/ui";
import { Calculator, Plus, CreditCard, IndianRupee, TrendingDown, X, Calendar } from "lucide-react";
import toast from "react-hot-toast";

interface EMI {
  id: string;
  cardId: string;
  description: string;
  totalAmount: number;
  emiAmount: number;
  tenure: number;
  monthsPaid: number;
  interestRate: number;
  startDate: string;
}

export default function EMIsPage() {
  const { creditCards } = useData();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    cardId: "",
    description: "",
    totalAmount: "",
    emiAmount: "",
    tenure: "",
    monthsPaid: "",
    interestRate: "",
    startDate: new Date().toISOString().split("T")[0],
  });

  // Fetch EMIs from Firestore
  const { data: emisData, isLoading } = useQuery({
    queryKey: ["emis"],
    queryFn: async () => {
      const res = await emisAPI.list();
      return (res.emis || []) as EMI[];
    },
  });

  const emis = emisData || [];

  // One-time migration from localStorage → Firestore
  useEffect(() => {
    if (isLoading) return;
    try {
      const stored = localStorage.getItem("wf_emis");
      if (!stored) return;
      const localEMIs: EMI[] = JSON.parse(stored);
      if (localEMIs.length === 0) return;
      // Only migrate if Firestore is empty (avoid duplicates)
      if (emis.length > 0) {
        localStorage.removeItem("wf_emis");
        return;
      }
      // Migrate each
      Promise.all(
        localEMIs.map((emi) =>
          emisAPI.create({
            cardId: emi.cardId,
            description: emi.description,
            totalAmount: emi.totalAmount,
            emiAmount: emi.emiAmount,
            tenure: emi.tenure,
            monthsPaid: emi.monthsPaid,
            interestRate: emi.interestRate,
            startDate: emi.startDate,
          })
        )
      ).then(() => {
        localStorage.removeItem("wf_emis");
        queryClient.invalidateQueries({ queryKey: ["emis"] });
        toast.success("EMIs migrated to cloud sync");
      });
    } catch { /* ignore */ }
  }, [isLoading, emis.length, queryClient]);

  // Set default cardId when creditCards load
  useEffect(() => {
    if (creditCards.length > 0 && !form.cardId) {
      setForm((f) => ({ ...f, cardId: creditCards[0].id }));
    }
  }, [creditCards, form.cardId]);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => emisAPI.create(data),
    onSuccess: () => {
      toast.success("EMI added");
      setShowAdd(false);
      setForm({ cardId: creditCards[0]?.id || "", description: "", totalAmount: "", emiAmount: "", tenure: "", monthsPaid: "", interestRate: "", startDate: new Date().toISOString().split("T")[0] });
      queryClient.invalidateQueries({ queryKey: ["emis"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => emisAPI.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["emis"] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => emisAPI.delete(id),
    onSuccess: () => {
      toast.success("Deleted");
      queryClient.invalidateQueries({ queryKey: ["emis"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addEMI = () => {
    createMutation.mutate({
      cardId: form.cardId,
      description: form.description,
      totalAmount: parseFloat(form.totalAmount) || 0,
      emiAmount: parseFloat(form.emiAmount) || 0,
      tenure: parseInt(form.tenure) || 0,
      monthsPaid: parseInt(form.monthsPaid) || 0,
      interestRate: parseFloat(form.interestRate) || 0,
      startDate: form.startDate,
    });
  };

  const deleteEMI = (id: string) => deleteMutation.mutate(id);

  const incrementMonth = (id: string) => {
    const emi = emis.find((e) => e.id === id);
    if (!emi) return;
    updateMutation.mutate({ id, data: { monthsPaid: Math.min(emi.monthsPaid + 1, emi.tenure) } });
  };

  // Summary
  const summary = useMemo(() => {
    const active = emis.filter((e) => e.monthsPaid < e.tenure);
    const totalMonthlyOutflow = active.reduce((s, e) => s + e.emiAmount, 0);
    const totalOutstanding = active.reduce((s, e) => s + (e.emiAmount * (e.tenure - e.monthsPaid)), 0);
    const totalInterest = active.reduce((s, e) => {
      const principal = e.totalAmount;
      const totalPay = e.emiAmount * e.tenure;
      return s + (totalPay - principal);
    }, 0);
    const closestClosure = active.reduce((closest, e) => {
      const remaining = e.tenure - e.monthsPaid;
      return remaining < closest ? remaining : closest;
    }, 999);
    return { active: active.length, totalMonthlyOutflow, totalOutstanding, totalInterest, closestClosure };
  }, [emis]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{summary.active} active EMIs</p>
        <Button onClick={() => setShowAdd(!showAdd)} className="gap-1.5">
          <Plus className="w-4 h-4" /> Add EMI
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <IndianRupee className="w-3.5 h-3.5 text-danger" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase">Monthly Outflow</span>
            </div>
            <p className="text-lg font-bold text-danger">{fmt(summary.totalMonthlyOutflow)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-warning" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase">Outstanding</span>
            </div>
            <p className="text-lg font-bold text-warning">{fmt(summary.totalOutstanding)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calculator className="w-3.5 h-3.5 text-accent" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase">Total Interest</span>
            </div>
            <p className="text-lg font-bold text-accent">{fmt(summary.totalInterest)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-3.5 h-3.5 text-info" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase">Next Closure</span>
            </div>
            <p className="text-lg font-bold text-info">{summary.closestClosure < 999 ? `${summary.closestClosure} mo` : "—"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Add EMI Form */}
      {showAdd && (
        <Card className="border-brand/20">
          <CardContent className="p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">New EMI</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={form.cardId}
                onChange={(e) => setForm({ ...form, cardId: e.target.value })}
                className="h-9 px-3 rounded-lg border border-input bg-card text-sm text-foreground"
              >
                {creditCards.map((cc) => (
                  <option key={cc.id} value={cc.id}>{cc.account_name}</option>
                ))}
              </select>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description (e.g. iPhone 15)" />
              <Input type="number" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} placeholder="Total Amount (₹)" />
              <Input type="number" value={form.emiAmount} onChange={(e) => setForm({ ...form, emiAmount: e.target.value })} placeholder="EMI Amount/month (₹)" />
              <Input type="number" value={form.tenure} onChange={(e) => setForm({ ...form, tenure: e.target.value })} placeholder="Tenure (months)" />
              <Input type="number" value={form.monthsPaid} onChange={(e) => setForm({ ...form, monthsPaid: e.target.value })} placeholder="Months already paid" />
              <Input type="number" value={form.interestRate} onChange={(e) => setForm({ ...form, interestRate: e.target.value })} placeholder="Interest rate % (0 for no-cost)" />
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={addEMI}>Add EMI</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active EMIs */}
      {emis.filter((e) => e.monthsPaid < e.tenure).length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase text-muted-foreground">Active EMIs</h3>
          {emis.filter((e) => e.monthsPaid < e.tenure).map((emi) => {
            const card = creditCards.find((c) => c.id === emi.cardId);
            const remaining = emi.tenure - emi.monthsPaid;
            const progressPct = (emi.monthsPaid / emi.tenure) * 100;
            const outstandingAmt = emi.emiAmount * remaining;
            const totalInterest = (emi.emiAmount * emi.tenure) - emi.totalAmount;
            const closureDate = new Date(emi.startDate);
            closureDate.setMonth(closureDate.getMonth() + emi.tenure);

            return (
              <Card key={emi.id} className="group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                        <CreditCard className="w-4.5 h-4.5 text-accent" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{emi.description}</p>
                        <p className="text-[11px] text-muted-foreground">{card?.account_name || "Unknown Card"} · {emi.interestRate > 0 ? `${emi.interestRate}% p.a.` : "No-cost"}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => incrementMonth(emi.id)}>+1 month</Button>
                      <button onClick={() => deleteEMI(emi.id)} className="p-1.5 text-danger/50 hover:text-danger transition-colors opacity-0 group-hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>{emi.monthsPaid}/{emi.tenure} months</span>
                      <span>{remaining} remaining</span>
                    </div>
                    <Progress value={progressPct} className="h-2" indicatorClassName={progressPct > 75 ? "bg-success" : progressPct > 40 ? "bg-brand" : "bg-warning"} />
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">EMI</p>
                      <p className="text-xs font-bold text-foreground">{fmt(emi.emiAmount)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Outstanding</p>
                      <p className="text-xs font-bold text-danger">{fmt(outstandingAmt)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Interest</p>
                      <p className="text-xs font-bold text-warning">{fmt(totalInterest)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Closes</p>
                      <p className="text-xs font-bold text-info">{closureDate.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Completed EMIs */}
      {emis.filter((e) => e.monthsPaid >= e.tenure).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase text-muted-foreground">Completed</h3>
          {emis.filter((e) => e.monthsPaid >= e.tenure).map((emi) => (
            <Card key={emi.id} className="opacity-60">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="success" className="text-[9px]">Done</Badge>
                  <span className="text-sm font-medium text-foreground">{emi.description}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{fmt(emi.totalAmount)}</span>
                  <button onClick={() => deleteEMI(emi.id)} className="p-1 text-muted-foreground hover:text-danger"><X className="w-3.5 h-3.5" /></button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {emis.length === 0 && !showAdd && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Calculator className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-semibold text-foreground">No EMIs Tracked</p>
            <p className="text-sm text-muted-foreground mt-1">Add your credit card EMIs to track tenure, outflow, and closure timeline.</p>
            <Button onClick={() => setShowAdd(true)} variant="outline" className="mt-4 gap-1.5">
              <Plus className="w-4 h-4" /> Add EMI
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
