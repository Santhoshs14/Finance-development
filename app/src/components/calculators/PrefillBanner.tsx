"use client";

import { Sparkles } from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui";
import { useData } from "@/providers/DataProvider";
import { fmt } from "@/utils/format";

/**
 * Figures already known from the user's account, offered as opt-in defaults.
 * Only reads data DataProvider has loaded eagerly — no extra subscriptions.
 */
export function usePrefill() {
  const { monthlySalary, currentAggregate } = useData();
  return {
    monthlySalary: monthlySalary || 0,
    monthlyExpenses: currentAggregate?.totalSpent || 0,
    monthlyIncome: currentAggregate?.totalIncome || monthlySalary || 0,
  };
}

interface PrefillBannerProps {
  label: string;
  value: number;
  onApply: () => void;
}

export function PrefillBanner({ label, value, onApply }: PrefillBannerProps) {
  if (!(value > 0)) return null;

  return (
    <Card variant="outlined" className="border-brand/30 bg-brand/5">
      <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="w-3.5 h-3.5 text-brand shrink-0" />
          {label} <strong className="text-foreground">{fmt(value)}</strong>
        </span>
        <Button variant="outline" size="sm" onClick={onApply}>
          Use my data
        </Button>
      </CardContent>
    </Card>
  );
}
