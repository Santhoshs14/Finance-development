"use client";

import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useData } from "@/providers/DataProvider";
import { accountsAPI } from "@/services/api";
import TransactionTable from "@/components/TransactionTable";
import ConfirmDialog from "@/components/ConfirmDialog";
import { fmt } from "@/utils/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from "@/components/ui";
import { Wallet, CreditCard, Plus, ArrowUpRight, ArrowDownRight, Pencil, Trash2, Banknote, PiggyBank } from "lucide-react";
import toast from "react-hot-toast";
import { SkeletonCard } from "@/components/SkeletonLoader";

type AccountType = "savings" | "current" | "wallet" | "credit";
const ACCOUNT_TYPES: { value: AccountType; label: string; icon: typeof Wallet }[] = [
  { value: "savings", label: "Savings", icon: PiggyBank },
  { value: "current", label: "Current", icon: Banknote },
  { value: "wallet", label: "Wallet", icon: Wallet },
  { value: "credit", label: "Credit Card", icon: CreditCard },
];

function AccountModal({ open, onClose, onSubmit, initial }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  initial?: Record<string, unknown> | null;
}) {
  const [name, setName] = useState((initial?.account_name as string) || "");
  const [type, setType] = useState<AccountType>((initial?.type as AccountType) || "savings");
  const [balance, setBalance] = useState(String(initial?.balance ?? "0"));

  useEffect(() => {
    setName((initial?.account_name as string) || "");
    setType((initial?.type as AccountType) || "savings");
    setBalance(String(initial?.balance ?? "0"));
  }, [initial, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-foreground">{initial ? "Edit Account" : "Add Account"}</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Account Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HDFC Savings" autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
            <div className="grid grid-cols-4 gap-2">
              {ACCOUNT_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-all",
                    type === t.value ? "border-brand bg-brand/10 text-brand" : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <t.icon className="w-4 h-4" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {type === "credit" ? "Outstanding Balance" : "Current Balance"}
            </label>
            <Input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              if (!name.trim()) { toast.error("Name required"); return; }
              onSubmit({ account_name: name.trim(), type, balance: parseFloat(balance) || 0 });
              onClose();
            }}
          >
            {initial ? "Save" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const { accounts, creditCards, transactions, categories, dataReady } = useData();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editAccount, setEditAccount] = useState<Record<string, unknown> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const bankAccounts = useMemo(() => accounts.filter((a) => a.type !== "credit").sort((a, b) => (b.balance || 0) - (a.balance || 0)), [accounts]);
  const allAccounts = useMemo(() => [...bankAccounts, ...creditCards], [bankAccounts, creditCards]);

  const totalLiquidCash = useMemo(() => bankAccounts.reduce((sum, a) => sum + (a.balance || 0), 0), [bankAccounts]);
  const totalCCOutstanding = useMemo(() => creditCards.reduce((sum, c) => sum + (c.liability || c.balance || 0), 0), [creditCards]);

  useEffect(() => {
    if (!selectedAccountId && allAccounts.length > 0) setSelectedAccountId(allAccounts[0].id);
  }, [allAccounts, selectedAccountId]);

  const selectedAccount = useMemo(() => allAccounts.find((a) => a.id === selectedAccountId) || allAccounts[0] || null, [selectedAccountId, allAccounts]);

  const accountStats = useMemo(() => {
    if (!selectedAccount) return { income: 0, expense: 0, recentTxns: [] as typeof transactions, lastTxnDate: "" };
    const txns = transactions.filter((t) => t.account_id === selectedAccount.id);
    let income = 0, expense = 0;
    txns.forEach((t) => { if (t.amount > 0) income += t.amount; else expense += Math.abs(t.amount); });
    return { income, expense, recentTxns: txns.slice(0, 30), lastTxnDate: txns[0]?.date || "" };
  }, [selectedAccount, transactions]);

  // Group bank accounts by type
  const groupedAccounts = useMemo(() => {
    const groups: Record<string, typeof bankAccounts> = {};
    bankAccounts.forEach((acc) => {
      const key = acc.type || "savings";
      if (!groups[key]) groups[key] = [];
      groups[key].push(acc);
    });
    return groups;
  }, [bankAccounts]);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => accountsAPI.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["accounts"] }); toast.success("Account created!"); },
    onError: () => toast.error("Failed to create account"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => accountsAPI.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["accounts"] }); toast.success("Account updated!"); },
    onError: () => toast.error("Failed to update"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => accountsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Account deleted!");
      if (selectedAccountId === confirmDelete) setSelectedAccountId(null);
    },
    onError: () => toast.error("Failed to delete"),
  });

  const handleSubmitAccount = (data: Record<string, unknown>) => {
    if (editAccount?.id) {
      updateMutation.mutate({ id: editAccount.id as string, data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (!dataReady) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {bankAccounts.length} accounts · {creditCards.length} credit cards
          </p>
        </div>
        <Button onClick={() => { setEditAccount(null); setShowAccountModal(true); }} className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Account
        </Button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="border-success/20">
          <CardContent className="p-4">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">Liquid Cash</span>
            <p className="text-xl font-bold text-success mt-1">{fmt(totalLiquidCash)}</p>
          </CardContent>
        </Card>
        <Card className="border-danger/20">
          <CardContent className="p-4">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">CC Outstanding</span>
            <p className="text-xl font-bold text-danger mt-1">{fmt(totalCCOutstanding)}</p>
          </CardContent>
        </Card>
        <Card className="hidden sm:block">
          <CardContent className="p-4">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">Net Position</span>
            <p className={cn("text-xl font-bold mt-1", totalLiquidCash - totalCCOutstanding >= 0 ? "text-success" : "text-danger")}>
              {fmt(totalLiquidCash - totalCCOutstanding)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Account List */}
        <Card>
          <CardContent className="p-4 space-y-1 max-h-[calc(100vh-320px)] overflow-y-auto">
            {Object.entries(groupedAccounts).map(([type, accs]) => (
              <div key={type}>
                <h3 className="text-[11px] font-semibold uppercase text-muted-foreground mb-2 mt-3 first:mt-0">
                  {ACCOUNT_TYPES.find((t) => t.value === type)?.label || type}
                </h3>
                {accs.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => setSelectedAccountId(acc.id)}
                    className={cn(
                      "flex items-center gap-3 w-full p-3 rounded-xl text-left transition-all border-l-4",
                      selectedAccountId === acc.id
                        ? "bg-brand/5 border-l-brand"
                        : "border-l-transparent hover:bg-muted/50"
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-success" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{acc.account_name}</p>
                      <p className="text-xs text-muted-foreground">{fmt(acc.balance || 0)}</p>
                    </div>
                  </button>
                ))}
              </div>
            ))}

            {creditCards.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold uppercase text-muted-foreground mt-4 mb-2">Credit Cards</h3>
                {creditCards.map((cc) => (
                  <button
                    key={cc.id}
                    onClick={() => setSelectedAccountId(cc.id)}
                    className={cn(
                      "flex items-center gap-3 w-full p-3 rounded-xl text-left transition-all border-l-4",
                      selectedAccountId === cc.id
                        ? "bg-accent/5 border-l-accent"
                        : "border-l-transparent hover:bg-muted/50"
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{cc.account_name}</p>
                      <p className="text-xs text-danger">Outstanding: {fmt(cc.liability || cc.balance || 0)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Details */}
        <div className="lg:col-span-2 space-y-4">
          {selectedAccount && (
            <>
              {/* Account header with actions */}
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-foreground">{selectedAccount.account_name}</h2>
                    <p className="text-xs text-muted-foreground capitalize">{selectedAccount.type || "savings"} · Last txn: {accountStats.lastTxnDate || "—"}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setEditAccount(selectedAccount as unknown as Record<string, unknown>); setShowAccountModal(true); }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmDelete(selectedAccount.id)}
                      className="text-danger border-danger/30 hover:bg-danger/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowUpRight className="w-4 h-4 text-success" />
                      <span className="text-[11px] font-medium text-muted-foreground uppercase">Income</span>
                    </div>
                    <p className="text-xl font-bold text-success">{fmt(accountStats.income)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowDownRight className="w-4 h-4 text-danger" />
                      <span className="text-[11px] font-medium text-muted-foreground uppercase">Expenses</span>
                    </div>
                    <p className="text-xl font-bold text-danger">{fmt(accountStats.expense)}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Recent Transactions — {selectedAccount.account_name}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <TransactionTable
                    transactions={accountStats.recentTxns}
                    categories={categories}
                    accounts={accounts}
                    creditCards={creditCards}
                    maxHeight="calc(100vh - 520px)"
                  />
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      <AccountModal
        open={showAccountModal}
        onClose={() => { setShowAccountModal(false); setEditAccount(null); }}
        onSubmit={handleSubmitAccount}
        initial={editAccount}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Account?"
        message="All associated transactions will be unlinked. This cannot be undone."
        confirmLabel="Delete"
        confirmColor="danger"
        onConfirm={() => { if (confirmDelete) deleteMutation.mutate(confirmDelete); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
