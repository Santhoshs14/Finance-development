"use client";

import { memo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";

const FALLBACK_COLORS: Record<string, string> = {
  Food: "#ef4444", Travel: "#3b82f6", Shopping: "#14b8a6",
  Bills: "#64748b", Entertainment: "#ec4899", Investment: "#0080ff",
  Income: "#10b981", Rent: "#f59e0b", Petrol: "#f97316",
  Utilities: "#eab308", Subscription: "#06b6d4", Lending: "#84cc16",
  Gifts: "#f43f5e", Home: "#8b5cf6", Other: "#94a3b8",
};

const paymentColors: Record<string, string> = {
  Cash: "bg-success/10 text-success",
  "Credit Card": "bg-accent/10 text-accent",
  "Debit Card": "bg-info/10 text-info",
  UPI: "bg-warning/10 text-warning",
  "Self Transfer": "bg-muted text-muted-foreground",
};

const paymentIcons: Record<string, string> = {
  Cash: "💵", "Credit Card": "💳", "Debit Card": "🏧", UPI: "📱", "Self Transfer": "🔄",
};

interface Category { id?: string; name: string; color?: string; }
interface Account { id: string; account_name: string; type?: string; balance?: number; }
interface Transaction {
  id: string; date: string; amount: number; category: string;
  payment_type?: string; account_id?: string; notes?: string;
  is_recurring?: boolean; recurrence_interval?: string;
}

interface TransactionTableProps {
  transactions: Transaction[];
  onEdit?: (txn: Transaction) => void;
  onDelete?: (id: string) => void;
  categories?: Category[];
  accounts?: Account[];
  creditCards?: Account[];
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (txns: Transaction[]) => void;
  maxHeight?: string;
}

function resolveCatColor(categoryName: string, categories: Category[] = []): string {
  const found = categories.find((c) => c.name === categoryName);
  return found?.color || FALLBACK_COLORS[categoryName] || "#94a3b8";
}

const ROW_HEIGHT = 52;

function TransactionTable({
  transactions, onEdit, onDelete, categories = [], accounts = [], creditCards = [],
  selectable = false, selectedIds = new Set(), onToggleSelect, onToggleSelectAll,
  maxHeight = "calc(100vh - 320px)",
}: TransactionTableProps) {
  const allAccounts = [...accounts, ...creditCards];
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  if (!transactions?.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-base mb-1">No transactions yet</p>
        <p className="text-sm">Add your first transaction to get started</p>
      </div>
    );
  }

  const allSelected = transactions.length > 0 && transactions.every((t) => selectedIds.has(t.id));

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* Sticky header */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/30 sticky top-0 z-10">
            <tr className="border-b border-border text-muted-foreground">
              {selectable && (
                <th className="py-3 px-2 w-10">
                  <input type="checkbox" checked={allSelected} onChange={() => onToggleSelectAll?.(transactions)} className="w-4 h-4 rounded cursor-pointer accent-brand" />
                </th>
              )}
              <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider w-[100px]">Date</th>
              <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider">Category</th>
              <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider">Payment</th>
              <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider">Account</th>
              <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider">Notes</th>
              <th className="text-right py-3 px-4 text-[11px] font-semibold uppercase tracking-wider w-[120px]">Amount</th>
              <th className="text-right py-3 px-4 text-[11px] font-semibold uppercase tracking-wider w-[100px]">Actions</th>
            </tr>
          </thead>
        </table>
      </div>

      {/* Virtualized body */}
      <div ref={parentRef} className="overflow-auto" style={{ maxHeight }}>
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const txn = transactions[virtualRow.index];
            const catColor = resolveCatColor(txn.category, categories);
            const isTransfer = txn.payment_type === "Self Transfer" || txn.category === "Transfer";
            const isChecked = selectedIds.has(txn.id);
            const linkedAccount = allAccounts.find((a) => a.id === txn.account_id);
            const isCreditCard = linkedAccount && creditCards.some((c) => c.id === linkedAccount.id);

            return (
              <div
                key={txn.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className={cn(
                  "absolute left-0 w-full flex items-center border-b border-border/50 transition-colors hover:bg-muted/30",
                  isChecked && "bg-brand/5"
                )}
                style={{ top: `${virtualRow.start}px`, height: `${ROW_HEIGHT}px` }}
              >
                {selectable && (
                  <div className="py-3 px-2 w-10 flex-shrink-0">
                    <input type="checkbox" checked={isChecked} onChange={() => onToggleSelect?.(txn.id)} className="w-4 h-4 rounded cursor-pointer accent-brand" />
                  </div>
                )}
                <div className="py-3 px-4 text-sm whitespace-nowrap text-foreground/80 w-[100px] flex-shrink-0">
                  {new Date(txn.date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                </div>
                <div className="py-3 px-4 flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-1.5">
                    <span style={{ background: `${catColor}18`, color: catColor, borderColor: `${catColor}40` }} className="text-xs px-2.5 py-0.5 rounded-full font-medium border flex items-center gap-1.5">
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: catColor, display: "inline-block", flexShrink: 0 }} />
                      {txn.category}
                    </span>
                    {txn.is_recurring && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-brand/50 text-brand uppercase font-bold tracking-wider">↻</span>
                    )}
                  </div>
                </div>
                <div className="py-3 px-4 w-[110px] flex-shrink-0">
                  {txn.payment_type ? (
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap", paymentColors[txn.payment_type] || "bg-muted text-muted-foreground")}>
                      {paymentIcons[txn.payment_type] || "💰"} {txn.payment_type}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <div className="py-3 px-4 w-[120px] flex-shrink-0">
                  {linkedAccount ? (
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap truncate max-w-[110px] inline-block", isCreditCard ? "bg-accent/10 text-accent" : "bg-info/10 text-info")}>
                      {isCreditCard ? "💳" : "🏦"} {linkedAccount.account_name}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <div className="py-3 px-4 flex-1 min-w-0">
                  <span className="text-sm truncate block text-muted-foreground">{txn.notes || "—"}</span>
                </div>
                <div className={cn("py-3 px-4 text-sm text-right font-semibold whitespace-nowrap w-[120px] flex-shrink-0", isTransfer ? "text-info" : txn.amount < 0 ? "text-danger" : "text-success")}>
                  {isTransfer ? (txn.amount < 0 ? "↗ " : "↘ ") : txn.amount < 0 ? "-" : "+"}₹{Math.abs(txn.amount).toLocaleString("en-IN")}
                </div>
                <div className="py-3 px-4 text-right w-[100px] flex-shrink-0">
                  <div className="flex gap-1 justify-end">
                    {onEdit && !isTransfer && txn.category !== "Credit Card Payment" && txn.category !== "Investment" && (
                      <button onClick={() => onEdit(txn)} className="text-xs px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Edit</button>
                    )}
                    {onDelete && (
                      <button onClick={() => onDelete(txn.id)} className="text-xs px-2 py-1 rounded-md text-danger/70 hover:text-danger hover:bg-danger/10 transition-colors">Del</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default memo(TransactionTable);
