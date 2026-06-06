"use client";

import { useState, useMemo } from "react";
import { useData } from "@/providers/DataProvider";
import { getRecentFinancialMonths } from "@/utils/financialMonth";
import { creditCardsAPI } from "@/services/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fmt } from "@/utils/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Button, Progress } from "@/components/ui";
import { FileText, CheckCircle2, AlertTriangle, Clock, CreditCard, IndianRupee } from "lucide-react";
import toast from "react-hot-toast";
import { SkeletonCard } from "@/components/SkeletonLoader";

export default function StatementsPage() {
  const queryClient = useQueryClient();
  const { creditCards, transactions, accounts, cycleStartDay, dataReady } = useData();
  const [selectedCardId, setSelectedCardId] = useState<string>("all");
  const [payingCardId, setPayingCardId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payFromAccount, setPayFromAccount] = useState("");

  const recentCycles = useMemo(() => getRecentFinancialMonths(6, new Date(), cycleStartDay), [cycleStartDay]);
  const bankAccounts = useMemo(() => accounts.filter((a) => a.type !== "credit"), [accounts]);

  // Generate statement data for each card per cycle
  const statements = useMemo(() => {
    const cards = selectedCardId === "all" ? creditCards : creditCards.filter((c) => c.id === selectedCardId);

    return recentCycles.map((cycle) => {
      const cardStatements = cards.map((cc) => {
        const cycleTxns = transactions.filter(
          (t) => t.account_id === cc.id && t.date >= cycle.startDate && t.date <= cycle.endDate
        );
        const totalSpend = cycleTxns.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
        const payments = cycleTxns.filter((t) => t.category === "Credit Card Payment" && t.amount > 0).reduce((s, t) => s + t.amount, 0);
        const outstanding = totalSpend - payments;
        const limit = parseFloat(String(cc.credit_limit || 0));
        const minDue = Math.max(totalSpend * 0.05, 200); // 5% or ₹200 min

        // Payment status
        let status: "paid" | "partial" | "pending" | "overdue" = "pending";
        if (payments >= totalSpend && totalSpend > 0) status = "paid";
        else if (payments >= minDue && payments < totalSpend) status = "partial";
        else if (payments > 0 && payments < minDue) status = "overdue";

        return {
          cardId: cc.id,
          cardName: cc.account_name,
          totalSpend,
          payments,
          outstanding: Math.max(0, outstanding),
          minDue: totalSpend > 0 ? minDue : 0,
          status,
          txnCount: cycleTxns.filter((t) => t.amount < 0).length,
          limit,
        };
      });

      return { cycle, cardStatements };
    });
  }, [recentCycles, creditCards, transactions, selectedCardId]);

  const payMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => creditCardsAPI.payBill(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Payment recorded!");
      setPayingCardId(null);
      setPayAmount("");
      setPayFromAccount("");
    },
    onError: () => toast.error("Payment failed"),
  });

  const handlePay = (cardId: string) => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
    if (!payFromAccount) { toast.error("Select source account"); return; }
    payMutation.mutate({ credit_card_id: cardId, amount, from_account_id: payFromAccount, date: new Date().toISOString().split("T")[0] });
  };

  const statusConfig = {
    paid: { label: "Paid", icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
    partial: { label: "Partial", icon: Clock, color: "text-warning", bg: "bg-warning/10" },
    pending: { label: "Pending", icon: Clock, color: "text-muted-foreground", bg: "bg-muted" },
    overdue: { label: "Overdue", icon: AlertTriangle, color: "text-danger", bg: "bg-danger/10" },
  };

  if (!dataReady) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} lines={5} />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Card Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedCardId("all")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
            selectedCardId === "all" ? "bg-brand/10 text-brand border-brand/30" : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          All Cards
        </button>
        {creditCards.map((cc) => (
          <button
            key={cc.id}
            onClick={() => setSelectedCardId(cc.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              selectedCardId === cc.id ? "bg-brand/10 text-brand border-brand/30" : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {cc.account_name}
          </button>
        ))}
      </div>

      {/* Statement Cards by Cycle */}
      <div className="space-y-4">
        {statements.map(({ cycle, cardStatements }) => {
          const hasActivity = cardStatements.some((cs) => cs.totalSpend > 0);
          if (!hasActivity) return null;

          return (
            <Card key={cycle.cycleKey}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  {cycle.label}
                  <span className="text-xs text-muted-foreground font-normal ml-auto">
                    {cycle.startDate} → {cycle.endDate}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                {cardStatements.filter((cs) => cs.totalSpend > 0).map((cs) => {
                  const sc = statusConfig[cs.status];
                  const StatusIcon = sc.icon;
                  return (
                    <div key={cs.cardId} className="border border-border/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-accent" />
                          <span className="text-sm font-semibold text-foreground">{cs.cardName}</span>
                          <span className="text-[10px] text-muted-foreground">({cs.txnCount} txns)</span>
                        </div>
                        <div className={cn("flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full", sc.bg, sc.color)}>
                          <StatusIcon className="w-3 h-3" />
                          {sc.label}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Statement Amount</p>
                          <p className="text-sm font-bold text-foreground">{fmt(cs.totalSpend)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Paid</p>
                          <p className="text-sm font-bold text-success">{fmt(cs.payments)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Outstanding</p>
                          <p className={cn("text-sm font-bold", cs.outstanding > 0 ? "text-danger" : "text-success")}>{fmt(cs.outstanding)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Min Due</p>
                          <p className="text-sm font-bold text-warning">{fmt(cs.minDue)}</p>
                        </div>
                      </div>

                      {/* Payment progress */}
                      {cs.totalSpend > 0 && (
                        <div className="mb-3">
                          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                            <span>Payment Progress</span>
                            <span>{Math.min(100, Math.round((cs.payments / cs.totalSpend) * 100))}%</span>
                          </div>
                          <Progress
                            value={Math.min(100, (cs.payments / cs.totalSpend) * 100)}
                            className="h-1.5"
                            indicatorClassName={cs.status === "paid" ? "bg-success" : cs.status === "partial" ? "bg-warning" : "bg-muted-foreground"}
                          />
                        </div>
                      )}

                      {/* Pay button for current cycle */}
                      {cs.outstanding > 0 && cycle.cycleKey === recentCycles[0]?.cycleKey && (
                        <div>
                          {payingCardId === cs.cardId ? (
                            <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-border/50">
                              <input
                                type="number"
                                value={payAmount}
                                onChange={(e) => setPayAmount(e.target.value)}
                                placeholder={`₹${cs.outstanding}`}
                                className="h-8 w-24 px-2 rounded-lg text-xs border border-border bg-card text-foreground"
                              />
                              <select
                                value={payFromAccount}
                                onChange={(e) => setPayFromAccount(e.target.value)}
                                className="h-8 px-2 rounded-lg text-xs border border-border bg-card text-foreground"
                              >
                                <option value="">Pay from...</option>
                                {bankAccounts.map((a) => (
                                  <option key={a.id} value={a.id}>{a.account_name}</option>
                                ))}
                              </select>
                              <Button size="sm" className="h-8 text-xs" onClick={() => handlePay(cs.cardId)}>
                                <IndianRupee className="w-3 h-3 mr-1" /> Pay
                              </Button>
                              <button onClick={() => setPayingCardId(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                            </div>
                          ) : (
                            <Button variant="outline" size="sm" className="text-xs mt-2" onClick={() => { setPayingCardId(cs.cardId); setPayAmount(String(cs.outstanding)); }}>
                              Pay Bill ({fmt(cs.outstanding)})
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {creditCards.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-semibold text-foreground">No Credit Cards</p>
            <p className="text-sm text-muted-foreground mt-1">Add a credit card from Settings to track statements.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
