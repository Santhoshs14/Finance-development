"use client";

import { memo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Check, Ellipsis, Pencil, Repeat, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

const FALLBACK_COLORS: Record<string, string> = {
  Food: "#FF3B30", Travel: "#5856D6", Shopping: "#30B0C7",
  Bills: "#8E8E93", Entertainment: "#FF2D55", Investment: "#007AFF",
  Income: "#34C759", Rent: "#FF9500", Petrol: "#f97316",
  Utilities: "#FFCC00", Subscription: "#32ADE6", Lending: "#84cc16",
  Gifts: "#f43f5e", Home: "#AF52DE", Other: "#AEAEB2",
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
  /** Group rows into day sections on phones (only meaningful when sorted by date). */
  groupByDate?: boolean;
}

function resolveCatColor(categoryName: string, categories: Category[] = []): string {
  const found = categories.find((c) => c.name === categoryName);
  return found?.color || FALLBACK_COLORS[categoryName] || "#AEAEB2";
}

const ROW_HEIGHT = 52;

function toDayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(date: string, today: Date) {
  if (date === toDayKey(today)) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date === toDayKey(yesterday)) return "Yesterday";
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== today.getFullYear() && { year: "numeric" }),
  });
}

function isEditable(txn: Transaction, isTransfer: boolean) {
  return !isTransfer && txn.category !== "Credit Card Payment" && txn.category !== "Investment";
}

interface MobileListProps {
  transactions: Transaction[];
  onEdit?: (txn: Transaction) => void;
  onDelete?: (id: string) => void;
  categories: Category[];
  allAccounts: Account[];
  creditCards: Account[];
  selectable: boolean;
  selectedIds: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (txns: Transaction[]) => void;
  groupByDate: boolean;
}

/** iOS-style inset list used below the md breakpoint: day sections, tap to edit, ⋯ for more. */
function MobileTransactionList({
  transactions, onEdit, onDelete, categories, allAccounts, creditCards,
  selectable, selectedIds, onToggleSelect, onToggleSelectAll, groupByDate,
}: MobileListProps) {
  const today = new Date();
  const groups: { key: string; label: string | null; items: Transaction[] }[] = [];
  for (const txn of transactions) {
    const last = groups[groups.length - 1];
    if (groupByDate && last?.key === txn.date) last.items.push(txn);
    else if (!groupByDate && last) last.items.push(txn);
    else groups.push({ key: groupByDate ? txn.date : "all", label: groupByDate ? dayLabel(txn.date, today) : null, items: [txn] });
  }
  const allSelected = transactions.every((t) => selectedIds.has(t.id));

  return (
    <div>
      {selectable && (
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
          <span className="text-footnote text-muted-foreground">{selectedIds.size} selected</span>
          <button
            type="button"
            onClick={() => onToggleSelectAll?.(transactions)}
            className="text-subhead font-medium text-brand"
          >
            {allSelected ? "Deselect All" : "Select All"}
          </button>
        </div>
      )}
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label ?? undefined}>
          {group.label && (
            <h3 className="bg-muted/40 px-4 py-1.5 text-footnote font-semibold text-muted-foreground">
              {group.label}
            </h3>
          )}
          <ul>
            {group.items.map((txn) => {
              const catColor = resolveCatColor(txn.category, categories);
              const isTransfer = txn.payment_type === "Self Transfer" || txn.category === "Transfer";
              const isChecked = selectedIds.has(txn.id);
              const account = allAccounts.find((a) => a.id === txn.account_id);
              const isCreditCard = account && creditCards.some((c) => c.id === account.id);
              const canEdit = !!onEdit && isEditable(txn, isTransfer);
              const showMenu = !selectable && (canEdit || !!onDelete);
              const interactive = selectable || canEdit;
              const title = txn.notes?.trim() || txn.category;
              const subtitle = [
                txn.notes?.trim() ? txn.category : null,
                txn.payment_type,
                account ? `${isCreditCard ? "💳" : ""}${account.account_name}` : null,
                groupByDate ? null : new Date(txn.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
              ].filter(Boolean).join(" · ");
              const sign = isTransfer ? (txn.amount < 0 ? "↗ " : "↘ ") : txn.amount < 0 ? "−" : "+";

              const content = (
                <>
                  {selectable && (
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-[22px] shrink-0 place-items-center rounded-full border-[1.5px] transition-colors",
                        isChecked ? "border-brand bg-brand text-white" : "border-muted-foreground/40"
                      )}
                    >
                      {isChecked && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                  )}
                  <span
                    aria-hidden
                    className="grid size-10 shrink-0 place-items-center rounded-xl text-[15px] font-semibold"
                    style={{ background: `${catColor}22`, color: catColor }}
                  >
                    {txn.category.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[15px] font-medium leading-5 text-foreground">{title}</span>
                      {txn.is_recurring && <Repeat aria-label="Recurring" className="size-3 shrink-0 text-brand" />}
                    </span>
                    {subtitle && <span className="block truncate text-footnote text-muted-foreground">{subtitle}</span>}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-rounded text-[15px] font-semibold tabular-nums",
                      isTransfer ? "text-info" : txn.amount < 0 ? "text-foreground" : "text-success"
                    )}
                  >
                    {sign}₹{Math.abs(txn.amount).toLocaleString("en-IN")}
                  </span>
                </>
              );
              const rowClass = cn(
                "flex w-full items-center gap-3 py-2.5 pl-4 text-left",
                showMenu ? "pr-12" : "pr-4",
                isChecked && "bg-brand/[0.06]"
              );

              return (
                <li
                  key={txn.id}
                  className={cn(
                    "relative [contain-intrinsic-size:auto_60px] [content-visibility:auto]",
                    "after:absolute after:bottom-0 after:right-0 after:h-px after:bg-border/60 last:after:hidden",
                    selectable ? "after:left-[102px]" : "after:left-[68px]"
                  )}
                >
                  {interactive ? (
                    <button
                      type="button"
                      aria-pressed={selectable ? isChecked : undefined}
                      onClick={() => (selectable ? onToggleSelect?.(txn.id) : onEdit?.(txn))}
                      className={cn(rowClass, "transition-colors active:bg-foreground/[0.05]")}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className={rowClass}>{content}</div>
                  )}
                  {showMenu && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`More actions for ${title}`}
                        className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors active:bg-foreground/[0.06]"
                      >
                        <Ellipsis className="size-[18px]" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-40">
                        {canEdit && (
                          <DropdownMenuItem onSelect={() => onEdit?.(txn)} className="gap-2.5">
                            <Pencil className="size-4" /> Edit
                          </DropdownMenuItem>
                        )}
                        {onDelete && (
                          <DropdownMenuItem onSelect={() => onDelete(txn.id)} className="gap-2.5 text-danger focus:text-danger">
                            <Trash2 className="size-4" /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TransactionTable({
  transactions, onEdit, onDelete, categories = [], accounts = [], creditCards = [],
  selectable = false, selectedIds = new Set(), onToggleSelect, onToggleSelectAll,
  maxHeight = "calc(100dvh - 320px)", groupByDate = true,
}: TransactionTableProps) {
  const allAccounts = [...accounts, ...creditCards];
  const parentRef = useRef<HTMLDivElement>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const virtualizer = useVirtualizer({
    count: isDesktop ? transactions.length : 0,
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

  if (!isDesktop) {
    return (
      <MobileTransactionList
        transactions={transactions}
        onEdit={onEdit}
        onDelete={onDelete}
        categories={categories}
        allAccounts={allAccounts}
        creditCards={creditCards}
        selectable={selectable}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        onToggleSelectAll={onToggleSelectAll}
        groupByDate={groupByDate}
      />
    );
  }

  const allSelected = transactions.length > 0 && transactions.every((t) => selectedIds.has(t.id));

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div ref={parentRef} className="overflow-auto" style={{ maxHeight }}>
        <div className="min-w-[900px]">
          {/* Sticky header */}
          <div className="sticky top-0 z-10 bg-card border-b border-border flex items-center text-muted-foreground">
            {selectable && (
              <div className="py-3 px-2 w-10 flex-shrink-0">
                <input type="checkbox" checked={allSelected} onChange={() => onToggleSelectAll?.(transactions)} className="w-4 h-4 rounded cursor-pointer accent-brand" />
              </div>
            )}
            <div className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider w-[100px] flex-shrink-0">Date</div>
            <div className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider flex-1 min-w-[150px]">Category</div>
            <div className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider w-[110px] flex-shrink-0">Payment</div>
            <div className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider w-[120px] flex-shrink-0">Account</div>
            <div className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider flex-1 min-w-[150px]">Notes</div>
            <div className="text-right py-3 px-4 text-[11px] font-semibold uppercase tracking-wider w-[120px] flex-shrink-0">Amount</div>
            <div className="text-right py-3 px-4 text-[11px] font-semibold uppercase tracking-wider w-[100px] flex-shrink-0">Actions</div>
          </div>

          {/* Virtualized body */}
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
                  <div className="py-3 px-4 flex-1 min-w-[150px]">
                    <div className="flex items-center flex-wrap gap-1.5">
                      <span style={{ background: `${catColor}18`, color: catColor, borderColor: `${catColor}40` }} className="text-xs px-2.5 py-0.5 rounded-full font-medium border flex items-center gap-1.5 truncate max-w-full">
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: catColor, display: "inline-block", flexShrink: 0 }} />
                        <span className="truncate">{txn.category}</span>
                      </span>
                      {txn.is_recurring && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-brand/50 text-brand uppercase font-bold tracking-wider flex-shrink-0">↻</span>
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
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap truncate max-w-full inline-block", isCreditCard ? "bg-accent/10 text-accent" : "bg-info/10 text-info")}>
                        {isCreditCard ? "💳" : "🏦"} {linkedAccount.account_name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                  <div className="py-3 px-4 flex-1 min-w-[150px]">
                    <span className="text-sm truncate block text-muted-foreground">{txn.notes || "—"}</span>
                  </div>
                  <div className={cn("py-3 px-4 text-sm text-right font-semibold whitespace-nowrap w-[120px] flex-shrink-0", isTransfer ? "text-info" : txn.amount < 0 ? "text-danger" : "text-success")}>
                    {isTransfer ? (txn.amount < 0 ? "↗ " : "↘ ") : txn.amount < 0 ? "-" : "+"}₹{Math.abs(txn.amount).toLocaleString("en-IN")}
                  </div>
                  <div className="py-3 px-4 text-right w-[100px] flex-shrink-0">
                    <div className="flex gap-1 justify-end">
                      {onEdit && isEditable(txn, isTransfer) && (
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
    </div>
  );
}

export default memo(TransactionTable);
