"use client";

import { Card, CardContent } from "@/components/ui";
import { cn } from "@/lib/utils";

export type StatTone = "default" | "brand" | "success" | "danger" | "warning";

const TONE_TEXT: Record<StatTone, string> = {
  default: "text-foreground",
  brand: "text-brand",
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
};

export interface ResultStat {
  label: string;
  value: string;
  hint?: string;
  tone?: StatTone;
  icon?: React.ComponentType<{ className?: string }>;
}

interface ResultPanelProps {
  headlineLabel: string;
  headline: string;
  headlineHint?: string;
  stats: ResultStat[];
  children?: React.ReactNode;
  note?: React.ReactNode;
}

export function ResultPanel({
  headlineLabel,
  headline,
  headlineHint,
  stats,
  children,
  note,
}: ResultPanelProps) {
  return (
    <div className="space-y-4">
      <Card variant="gradient">
        <CardContent className="p-6 text-center sm:text-left">
          <p className="text-[11px] font-medium uppercase tracking-wide text-white/70">
            {headlineLabel}
          </p>
          <p className="text-3xl sm:text-4xl font-bold text-white mt-1 break-words">
            {headline}
          </p>
          {headlineHint && (
            <p className="text-xs text-white/70 mt-1">{headlineHint}</p>
          )}
        </CardContent>
      </Card>

      {stats.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <StatTile key={stat.label} {...stat} />
          ))}
        </div>
      )}

      {children}

      {note && (
        <Card>
          <CardContent className="p-4 text-xs text-muted-foreground leading-relaxed">
            {note}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function StatTile({ label, value, hint, tone = "default", icon: Icon }: ResultStat) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          {Icon && <Icon className={cn("w-4 h-4", TONE_TEXT[tone])} />}
          <span className="text-[11px] font-medium text-muted-foreground uppercase">
            {label}
          </span>
        </div>
        <p className={cn("text-xl font-bold break-words", TONE_TEXT[tone])}>{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
}
