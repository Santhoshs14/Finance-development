"use client";

import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useData } from "@/providers/DataProvider";
import { transactionsAPI } from "@/services/api";
import { getFinancialCycle } from "@/utils/financialMonth";
import { fmt } from "@/utils/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, Button, Badge, Input } from "@/components/ui";
import { Plus, Search, ArrowDownRight, Pencil, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import QuickAddTransaction from "@/components/QuickAddTransaction";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function CCTransactionsPage() {
  const queryClient = useQueryClient();
  const { creditCards, transactions, categories, accounts, investments, cycleStartDay } = useData();
  const [selectedCard, setSelectedCard] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editTxn, setEditTxn] = useState<Record<string, unknown> | null>(null);
  const [searchText, setSearchText] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const currentCycle = useMemo(() => getFinancialCycle(new Date(), cycleStartDay), [cycleStartDay]);

  const ccTransactions = useMemo(() => {
    let txns = transactions.filter((t) =>
      t.payment_type === "Credit Card" || creditCards.some((cc) => cc.id === t.account_id)
    );
    if (selectedCard !== "all") txns = txns.filter((t) => t.account_id === selectedCard);
    txns = txns.filter((t) => t.date >= currentCycle.startDate && t.date <= currentCycle.endDate);
    if (searchText.trim()) {
      const s = searchText.toLowerCase();
      txns = txns.filter((t) => t.category?.toLowerCase().includes(s) || t.notes?.toLowerCase().includes(s));
    }
    if (filterCategory) txns = txns.filter((t) => t.category === filterCategory);
    return txns.sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, creditCards, selectedCard, currentCycle, searchText, filterCategory]);

  const totalSpend = ccTransactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  const addMutation = useMutation({
    mutationFn: (data: unknown) => transactionsAPI.create(data as Parameters<typeof transactionsAPI.create>[0]),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["transactions"] }); toast.success("CC transaction added!"); },
    onError: () => toast.error("Failed"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => transactionsAPI.update(id, data as Parameters<typeof transactionsAPI.update>[1]),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["transactions"] }); toast.success("Transaction updated!"); },
    onError: () => toast.error("Failed to update"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => transactionsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      toast.success("Transaction deleted!");
    },
    onError: () => toast.error("Failed to delete"),
  });

  const handleSubmit = (data: unknown) => {
    const d = data as Record<string, unknown>;
    if (editTxn?.id) {
      updateMutation.mutate({ id: editTxn.id as string, data: d });
    } else {
      addMutation.mutate(d);
    }
    setEditTxn(null);
  };

  return (
    <div className="space-y-4">
      {/* Card Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedCard("all")}
          className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors", selectedCard === "all" ? "bg-brand/10 text-brand border-brand/30" : "text-muted-foreground border-border hover:bg-muted")}
        >
          All Cards
        </button>
        {creditCards.map((cc) => (
          <button
            key={cc.id}
            onClick={() => setSelectedCard(cc.id)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors", selectedCard === cc.id ? "bg-brand/10 text-brand border-brand/30" : "text-muted-foreground border-border hover:bg-muted")}
          >
            {cc.account_name}
          </button>
        ))}
        <Button onClick={() => setShowAdd(true)} size="sm" className="ml-auto gap-1">
          <Plus className="w-3.5 h-3.5" /> Add CC Transaction
        </Button>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground">This cycle CC spending</span>
            <p className="text-lg font-bold text-foreground">{fmt(totalSpend)}</p>
          </div>
          <Badge variant="secondary">{ccTransactions.length} transactions</Badge>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search..." className="pl-9 h-8" />
        </div>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="h-8 px-2 rounded-lg text-xs border border-border bg-card text-foreground">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      {/* Transactions List */}
      <Card>
        <CardContent className="p-0">
          {ccTransactions.length > 0 ? (
            <div className="divide-y divide-border">
              {ccTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-danger/10 flex items-center justify-center">
                      <ArrowDownRight className="w-4 h-4 text-danger" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{t.category}</p>
                      <p className="text-[11px] text-muted-foreground">{t.date} {t.notes ? `· ${t.notes}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{fmt(Math.abs(t.amount))}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditTxn(t as unknown as Record<string, unknown>); setShowAdd(true); }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit transaction"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(t.id)}
                        className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors"
                        title="Delete transaction"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">No CC transactions this cycle</p>
            </div>
          )}
        </CardContent>
      </Card>

      {showAdd && (
        <QuickAddTransaction
          isOpen={showAdd}
          onClose={() => { setShowAdd(false); setEditTxn(null); }}
          onSubmit={handleSubmit}
          accounts={accounts}
          creditCards={creditCards}
          categories={categories}
          investments={investments}
          initialData={editTxn}
          allowCreditCard={true}
          creditCardOnly={true}
        />
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Delete Transaction?"
        message="This action cannot be undone."
        confirmLabel="Delete"
        confirmColor="danger"
        onConfirm={() => {
          if (confirmDeleteId) deleteMutation.mutate(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
