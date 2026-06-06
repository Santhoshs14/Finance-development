"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useData } from "@/providers/DataProvider";
import { detectRecurringTransactions, RecurringPattern } from "@/utils/calculations";
import { recurringAPI } from "@/services/api";
import { fmt } from "@/utils/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui";
import { CalendarClock, AlertTriangle, Clock, IndianRupee, Plus, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { SkeletonCard } from "@/components/SkeletonLoader";

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function StatusBadge({ days }: { days: number }) {
  if (days < 0) return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-danger/10 text-danger font-medium">Overdue</span>;
  if (days <= 3) return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning/10 text-warning font-medium">Due soon</span>;
  if (days <= 7) return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-info/10 text-info font-medium">This week</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Upcoming</span>;
}

export default function BillsPage() {
  const { transactions, recurring: confirmedRecurring, dataReady } = useData();
  const queryClient = useQueryClient();

  // Detected patterns from transaction history
  const detectedPatterns = useMemo(() => detectRecurringTransactions(transactions), [transactions]);

  // Filter out patterns that are already confirmed (matched by description+category+similar amount)
  const suggestedPatterns = useMemo(() => {
    return detectedPatterns.filter((pattern) => {
      return !confirmedRecurring.some(
        (r) =>
          r.description.toLowerCase() === pattern.description.toLowerCase() &&
          r.category === pattern.category
      );
    });
  }, [detectedPatterns, confirmedRecurring]);

  // Active confirmed recurring items
  const activeRecurring = useMemo(
    () => confirmedRecurring.filter((r) => r.status === "active"),
    [confirmedRecurring]
  );

  // Stats from confirmed recurring
  const totalFixedCosts = useMemo(() => {
    return activeRecurring.reduce((s, r) => {
      if (r.frequency === "monthly") return s + r.amount;
      if (r.frequency === "weekly") return s + r.amount * 4.33;
      if (r.frequency === "yearly") return s + r.amount / 12;
      return s;
    }, 0);
  }, [activeRecurring]);

  // Upcoming from confirmed recurring
  const upcoming7Days = useMemo(() => {
    return activeRecurring
      .filter((r) => {
        const d = daysUntil(r.next_date);
        return d >= -3 && d <= 7;
      })
      .sort((a, b) => a.next_date.localeCompare(b.next_date));
  }, [activeRecurring]);

  // Waste detection from detected patterns
  const potentialWaste = useMemo(() => {
    const today = new Date();
    return detectedPatterns.filter((r) => {
      const daysSinceLast = Math.ceil((today.getTime() - new Date(r.lastDate + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceLast > r.avgIntervalDays * 2.5 && r.frequency !== "yearly";
    });
  }, [detectedPatterns]);

  // Confirm a detected pattern into the recurring collection
  const confirmMutation = useMutation({
    mutationFn: (pattern: RecurringPattern) =>
      recurringAPI.create({
        description: pattern.description,
        category: pattern.category,
        amount: Math.round(pattern.avgAmount),
        frequency: pattern.frequency === "irregular" ? "monthly" : pattern.frequency,
        next_date: pattern.nextExpectedDate,
        type: "expense",
      }),
    onSuccess: () => {
      toast.success("Added to recurring");
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const frequencyLabel = (f: string) => {
    if (f === "monthly") return "Monthly";
    if (f === "weekly") return "Weekly";
    if (f === "yearly") return "Yearly";
    return "Irregular";
  };

  if (!dataReady) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={2} />)}
        </div>
        <SkeletonCard lines={6} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <IndianRupee className="w-3.5 h-3.5 text-brand" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase">Fixed Costs/mo</span>
            </div>
            <p className="text-lg font-bold text-foreground">{fmt(totalFixedCosts)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarClock className="w-3.5 h-3.5 text-info" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase">Active</span>
            </div>
            <p className="text-lg font-bold text-foreground">{activeRecurring.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3.5 h-3.5 text-warning" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase">Due (7 days)</span>
            </div>
            <p className="text-lg font-bold text-foreground">{upcoming7Days.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-danger" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase">Potential Waste</span>
            </div>
            <p className="text-lg font-bold text-danger">{potentialWaste.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming Timeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Upcoming (Next 7 Days)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            {upcoming7Days.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No bills due in the next 7 days</p>
            ) : (
              upcoming7Days.map((item) => {
                const days = daysUntil(item.next_date);
                return (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.description}</p>
                      <p className="text-xs text-muted-foreground">{item.category} · {frequencyLabel(item.frequency)}</p>
                    </div>
                    <StatusBadge days={days} />
                    <p className="text-sm font-bold text-danger whitespace-nowrap">{fmt(item.amount)}</p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Waste Detection */}
        {potentialWaste.length > 0 && (
          <Card className="border-warning/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" /> Potential Waste
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              {potentialWaste.map((item) => (
                <div key={item.key} className="flex items-center gap-3 p-3 rounded-lg border border-warning/20 bg-warning/5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.description}</p>
                    <p className="text-xs text-muted-foreground">Last: {item.lastDate} · Was {frequencyLabel(item.frequency)}</p>
                  </div>
                  <p className="text-sm font-bold text-warning whitespace-nowrap">{fmt(item.avgAmount)}/mo</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Suggested Recurring (Detected but not confirmed) */}
      {suggestedPatterns.length > 0 && (
        <Card className="border-brand/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand" />
              Suggested Recurring ({suggestedPatterns.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">Detected patterns from your transactions. Confirm to track them automatically.</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {suggestedPatterns.map((item) => (
                <div key={item.key} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                    item.frequency === "monthly" ? "bg-brand/10 text-brand" : item.frequency === "weekly" ? "bg-info/10 text-info" : "bg-muted text-muted-foreground"
                  )}>
                    {item.frequency === "monthly" ? "M" : item.frequency === "weekly" ? "W" : item.frequency === "yearly" ? "Y" : "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.description}</p>
                    <p className="text-xs text-muted-foreground">{item.category} · {item.occurrences} times · Next: {item.nextExpectedDate}</p>
                  </div>
                  <p className="text-sm font-bold text-foreground whitespace-nowrap">{fmt(item.avgAmount)}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 text-xs"
                    onClick={() => confirmMutation.mutate(item)}
                    disabled={confirmMutation.isPending}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Confirm
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Confirmed Recurring */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">All Confirmed Recurring ({confirmedRecurring.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/50">
            {confirmedRecurring.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                  item.status !== "active" ? "bg-muted text-muted-foreground" : item.frequency === "monthly" ? "bg-brand/10 text-brand" : item.frequency === "weekly" ? "bg-info/10 text-info" : "bg-success/10 text-success"
                )}>
                  {item.frequency === "monthly" ? "M" : item.frequency === "weekly" ? "W" : "Y"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{item.description}</p>
                    {item.status !== "active" && (
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize",
                        item.status === "paused" ? "bg-warning/10 text-warning" : "bg-danger/10 text-danger"
                      )}>
                        {item.status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.category} · {frequencyLabel(item.frequency)}
                    {item.status === "active" && item.next_date && ` · Next: ${item.next_date}`}
                  </p>
                </div>
                <p className="text-sm font-bold text-foreground whitespace-nowrap">{fmt(item.amount)}</p>
              </div>
            ))}
            {confirmedRecurring.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">No confirmed recurring items yet. Confirm detected patterns above or add them manually from the Recurring page.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
