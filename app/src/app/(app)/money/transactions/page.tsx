"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useData, useDataset } from "@/providers/DataProvider";
import { transactionsAPI } from "@/services/api";
import { useUndoDelete } from "@/hooks/useUndoDelete";
import { getRecentFinancialMonths } from "@/utils/financialMonth";
import TransactionTable from "@/components/TransactionTable";
import QuickAddTransaction from "@/components/QuickAddTransaction";
import ConfirmDialog from "@/components/ConfirmDialog";
import { fmt } from "@/utils/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, Button, Badge, Input, SegmentedControl } from "@/components/ui";
import type { SegmentedOption } from "@/components/ui";
import {
  Plus, Search, X, ArrowUpRight, ArrowDownRight,
  Download, Trash2, CheckSquare,
} from "lucide-react";
import toast from "react-hot-toast";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { SkeletonTable } from "@/components/SkeletonLoader";

const SKIP_CATS = new Set(["Transfer", "Credit Card Payment"]);
const PAYMENT_METHODS = ["Cash", "Debit Card", "UPI", "Self Transfer"];
const TYPE_OPTIONS: SegmentedOption<"all" | "income" | "expense" | "transfer">[] = [
  { value: "all", label: "All" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
  { value: "transfer", label: "Transfer" },
];
const FILTER_SELECT =
  "h-9 shrink-0 rounded-full border-0 bg-muted/70 pl-3.5 text-[13px] font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 md:h-8 md:text-xs";

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const { accounts, creditCards, categories, investments, cycleStartDay, transactions, dataReady } = useData();
  useDataset("investments");

  const [selectedCycle, setSelectedCycle] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [editTxn, setEditTxn] = useState<Record<string, unknown> | null>(null);
  const [searchText, setSearchText] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense" | "transfer">("all");
  const [filterAccount, setFilterAccount] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"date" | "amount" | "category">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  // Listen for keyboard shortcut "N" via custom event from CommandPalette
  useEffect(() => {
    const handler = () => setShowAdd(true);
    document.addEventListener("quick-add-open", handler);
    return () => document.removeEventListener("quick-add-open", handler);
  }, []);

  const recentCycles = useMemo(() => getRecentFinancialMonths(8, new Date(), cycleStartDay), [cycleStartDay]);
  const currentCycle = recentCycles[selectedCycle];

  const cycleTxns = useMemo(() => {
    if (!currentCycle) return transactions.filter((t) => t.payment_type !== "Credit Card" && !creditCards.some((c) => c.id === t.account_id));
    return transactions.filter((t) => t.date >= currentCycle.startDate && t.date <= currentCycle.endDate && t.payment_type !== "Credit Card" && !creditCards.some((c) => c.id === t.account_id));
  }, [transactions, currentCycle, creditCards]);

  const filteredTxns = useMemo(() => {
    let result = cycleTxns;

    if (searchText.trim()) {
      const s = searchText.toLowerCase();
      result = result.filter((t) =>
        t.notes?.toLowerCase().includes(s) ||
        t.category?.toLowerCase().includes(s) ||
        t.description?.toLowerCase().includes(s) ||
        String(Math.abs(t.amount)).includes(s)
      );
    }

    if (filterCategory) result = result.filter((t) => t.category === filterCategory);
    if (filterPayment) result = result.filter((t) => t.payment_type === filterPayment);
    if (filterAccount) result = result.filter((t) => t.account_id === filterAccount);

    if (filterType === "income") result = result.filter((t) => t.amount > 0 || t.category === "Income");
    else if (filterType === "expense") result = result.filter((t) => t.amount < 0 && t.category !== "Transfer" && t.category !== "Credit Card Payment");
    else if (filterType === "transfer") result = result.filter((t) => t.category === "Transfer" || t.payment_type === "Self Transfer");

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "date") cmp = a.date.localeCompare(b.date);
      else if (sortBy === "amount") cmp = Math.abs(a.amount) - Math.abs(b.amount);
      else if (sortBy === "category") cmp = (a.category || "").localeCompare(b.category || "");
      return sortOrder === "desc" ? -cmp : cmp;
    });

    return result;
  }, [cycleTxns, searchText, filterCategory, filterPayment, filterAccount, filterType, sortBy, sortOrder]);

  const stats = useMemo(() => {
    let income = 0, expense = 0;
    cycleTxns.forEach((t) => {
      if (t.payment_type === "Credit Card" || t.payment_type === "Self Transfer" || SKIP_CATS.has(t.category)) return;
      if (t.type === "income" || t.category === "Income") income += Math.abs(t.amount);
      else if (t.amount < 0) expense += Math.abs(t.amount);
    });
    const topCategory = Object.entries(
      cycleTxns.filter((t) => t.amount < 0 && !SKIP_CATS.has(t.category) && t.category !== "Income" && t.type !== "income")
        .reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount); return acc; }, {} as Record<string, number>)
    ).sort((a, b) => b[1] - a[1])[0];
    return { income, expense, net: income - expense, topCategory: topCategory?.[0] || "-", count: cycleTxns.length };
  }, [cycleTxns]);

  const activeFilters = [filterCategory, filterPayment, filterAccount, filterType !== "all" ? filterType : ""].filter(Boolean);

  const clearAllFilters = () => {
    setFilterCategory("");
    setFilterPayment("");
    setFilterAccount("");
    setFilterType("all");
    setSearchText("");
  };

  const addTxnMutation = useMutation({
    mutationFn: (data: unknown) => transactionsAPI.create(data as Parameters<typeof transactionsAPI.create>[0]),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["transactions"] }); toast.success("Transaction added!"); },
    onError: () => toast.error("Failed to add transaction"),
  });

  const updateTxnMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => transactionsAPI.update(id, data as Parameters<typeof transactionsAPI.update>[1]),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["transactions"] }); toast.success("Updated!"); },
    onError: () => toast.error("Failed to update"),
  });

  const deleteTxnMutation = useMutation({
    mutationFn: (id: string) => transactionsAPI.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["transactions"] }); queryClient.invalidateQueries({ queryKey: ["investments"] }); },
    onError: () => toast.error("Failed to delete"),
  });

  const { softDelete: undoDelete } = useUndoDelete({
    deleteFn: (id) => deleteTxnMutation.mutateAsync(id),
    entityName: "Transaction",
  });

  const handleSubmit = (data: unknown) => {
    const d = data as Record<string, unknown>;
    if (editTxn?.id) {
      updateTxnMutation.mutate({ id: editTxn.id as string, data: d });
    } else {
      addTxnMutation.mutate(d);
    }
    setEditTxn(null);
  };

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortOrder("desc"); }
  };

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback((txns: { id: string }[]) => {
    setSelectedIds((prev) => {
      const allSelected = txns.every((t) => prev.has(t.id));
      if (allSelected) return new Set();
      return new Set(txns.map((t) => t.id));
    });
  }, []);

  const handleBulkDelete = () => {
    const count = selectedIds.size;
    if (count === 0) return;
    setConfirmDelete("__bulk__");
  };

  const executeBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    let success = 0;
    for (const id of ids) {
      try { await transactionsAPI.delete(id); success++; } catch { /* skip */ }
    }
    toast.success(`Deleted ${success} transactions`);
    setSelectedIds(new Set());
    setSelectionMode(false);
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
  };

  const handleExport = () => {
    const data = filteredTxns.map((t) => ({
      Date: t.date,
      Category: t.category,
      Amount: t.amount,
      "Payment Method": t.payment_type || "",
      Account: [...accounts, ...creditCards].find((a) => a.id === t.account_id)?.account_name || "",
      Notes: t.notes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), `transactions-${currentCycle?.cycleKey || "all"}.xlsx`);
    toast.success(`Exported ${data.length} transactions`);
  };

  if (!dataReady) {
    return <SkeletonTable rows={8} cols={5} />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {currentCycle?.label} · {stats.count} transactions
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 md:text-xs">
            <Download className="w-3.5 h-3.5" /> <span className="max-sm:sr-only">Export</span>
          </Button>
          <Button
            variant={selectionMode ? "default" : "outline"}
            size="sm"
            onClick={() => { setSelectionMode(!selectionMode); setSelectedIds(new Set()); }}
            className="gap-1.5 md:text-xs"
          >
            <CheckSquare className="w-3.5 h-3.5" /> {selectionMode ? "Cancel" : "Select"}
          </Button>
          <Button onClick={() => { setEditTxn(null); setShowAdd(true); }} className="ml-auto gap-2 sm:ml-0">
            <Plus className="w-4 h-4" /> Add Transaction
          </Button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-brand/20 bg-brand/5 px-4 py-2.5">
          <span className="text-sm font-medium text-brand">{selectedIds.size} selected</span>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> Export Selected
          </Button>
          <Button variant="outline" size="sm" onClick={handleBulkDelete} className="gap-1.5 text-xs text-danger border-danger/30 hover:bg-danger/10">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="hover:border-success/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-success" />
              <span className="text-footnote font-medium text-muted-foreground md:text-xs">Income</span>
            </div>
            <p className="font-rounded text-lg font-bold tabular-nums text-success">{fmt(stats.income)}</p>
          </CardContent>
        </Card>
        <Card className="hover:border-danger/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownRight className="w-3.5 h-3.5 text-danger" />
              <span className="text-footnote font-medium text-muted-foreground md:text-xs">Expenses</span>
            </div>
            <p className="font-rounded text-lg font-bold tabular-nums text-danger">{fmt(stats.expense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-footnote font-medium text-muted-foreground md:text-xs">Net</span>
            </div>
            <p className={cn("font-rounded text-lg font-bold tabular-nums", stats.net >= 0 ? "text-success" : "text-danger")}>{fmt(Math.abs(stats.net))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-footnote font-medium text-muted-foreground md:text-xs">Top Category</span>
            </div>
            <p className="text-sm font-bold text-foreground truncate">{stats.topCategory}</p>
          </CardContent>
        </Card>
      </div>

      {/* Cycle Selector */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 scrollbar-none sm:-mx-6 sm:px-6 md:mx-0 md:px-0">
        {recentCycles.map((c, i) => (
          <button
            key={c.cycleKey}
            type="button"
            aria-pressed={selectedCycle === i}
            onClick={() => setSelectedCycle(i)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors md:text-xs",
              selectedCycle === i
                ? "bg-brand text-white"
                : "bg-card text-muted-foreground shadow-elev-1 hover:text-foreground"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <Card className="border-border/50">
        <CardContent className="space-y-2.5 p-3">
          <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
            {/* Search */}
            <div className="relative md:min-w-[200px] md:flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                enterKeyHint="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search transactions"
                aria-label="Search transactions"
                className="pl-9 md:h-8"
              />
            </div>

            {/* Type Filter */}
            <SegmentedControl
              aria-label="Transaction type"
              size="sm"
              value={filterType}
              onChange={setFilterType}
              options={TYPE_OPTIONS}
              className="md:w-auto"
            />
          </div>

          <div className="-mx-3 flex items-center gap-2 overflow-x-auto px-3 scrollbar-none md:mx-0 md:flex-wrap md:px-0">
            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              aria-label="Filter by category"
              className={FILTER_SELECT}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id || c.name} value={c.name}>{c.name}</option>
              ))}
            </select>

            {/* Payment Method */}
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              aria-label="Filter by payment method"
              className={FILTER_SELECT}
            >
              <option value="">All Methods</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            {/* Account Filter */}
            <select
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
              aria-label="Filter by account"
              className={FILTER_SELECT}
            >
              <option value="">All Accounts</option>
              {accounts.filter((a) => a.type !== "credit").map((a) => (
                <option key={a.id} value={a.id}>{a.account_name}</option>
              ))}
            </select>

            {/* Sort */}
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <span className="text-[11px] text-muted-foreground">Sort:</span>
              {(["date", "amount", "category"] as const).map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => toggleSort(col)}
                  className={cn(
                    "whitespace-nowrap rounded-full px-2.5 py-1.5 text-[13px] font-medium capitalize transition-colors md:py-1 md:text-[11px]",
                    sortBy === col ? "bg-brand/10 text-brand" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {col} {sortBy === col && (sortOrder === "desc" ? "↓" : "↑")}
                </button>
              ))}
            </div>
          </div>

          {/* Active filter chips */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-border">
              {filterCategory && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  {filterCategory} <button onClick={() => setFilterCategory("")}><X className="w-3 h-3" /></button>
                </Badge>
              )}
              {filterPayment && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  {filterPayment} <button onClick={() => setFilterPayment("")}><X className="w-3 h-3" /></button>
                </Badge>
              )}
              {filterAccount && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  {accounts.find((a) => a.id === filterAccount)?.account_name}
                  <button onClick={() => setFilterAccount("")}><X className="w-3 h-3" /></button>
                </Badge>
              )}
              {filterType !== "all" && (
                <Badge variant="secondary" className="gap-1 text-[10px] capitalize">
                  {filterType} <button onClick={() => setFilterType("all")}><X className="w-3 h-3" /></button>
                </Badge>
              )}
              <button onClick={clearAllFilters} className="text-[11px] text-danger hover:underline ml-1">
                Clear all
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          <TransactionTable
            transactions={filteredTxns}
            onEdit={(txn) => { setEditTxn(txn as unknown as Record<string, unknown>); setShowAdd(true); }}
            onDelete={(id) => setConfirmDelete(id)}
            categories={categories}
            accounts={accounts}
            creditCards={creditCards}
            selectable={selectionMode}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            groupByDate={sortBy === "date"}
          />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Showing {filteredTxns.length} of {cycleTxns.length} transactions
      </p>

      {/* Modals */}
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
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete === "__bulk__" ? `Delete ${selectedIds.size} Transactions?` : "Delete Transaction?"}
        message="This action cannot be undone."
        confirmLabel="Delete"
        confirmColor="danger"
        onConfirm={() => {
          if (confirmDelete === "__bulk__") { executeBulkDelete(); }
          else if (confirmDelete) { undoDelete(confirmDelete); }
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
