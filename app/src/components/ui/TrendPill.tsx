"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TrendPillProps {
  /** Percentage change (e.g. 12.5 for +12.5%). Sign is preserved. */
  delta: number;
  /** Whether higher is better (defaults to `true`). For things like
   * "spent vs budget" set this to `false` so red = bad and green = good. */
  higherIsBetter?: boolean;
  /** Display label after the percent (e.g. "vs last cycle"). */
  label?: string;
  /** Override the format (e.g. show one decimal). */
  decimals?: number;
  /** Compact size for inline use. */
  size?: "sm" | "md";
  className?: string;
}

/**
 * Color-coded percent change pill with arrow icon.
 */
export function TrendPill({
  delta,
  higherIsBetter = true,
  label,
  decimals = 1,
  size = "sm",
  className,
}: TrendPillProps) {
  const abs = Math.abs(delta);
  const isFlat = abs < 0.05;
  const positive = delta > 0;
  const good = isFlat
    ? true
    : higherIsBetter
    ? positive
    : !positive;
  const tone = isFlat
    ? "bg-muted text-muted-foreground border-transparent"
    : good
    ? "bg-success/12 text-success border-success/20"
    : "bg-danger/12 text-danger border-danger/20";

  const Icon = isFlat ? Minus : positive ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium tabular-nums transition-colors",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        tone,
        className
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
      {abs.toFixed(decimals)}%
      {label && <span className="text-muted-foreground font-normal">{label}</span>}
    </span>
  );
}

export default TrendPill;
