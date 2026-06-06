"use client";

import * as React from "react";
import CountUp from "react-countup";
import { cn } from "@/lib/utils";

export type SignMode = "auto" | "always" | "never";

export interface AnimatedCounterProps {
  value: number;
  /** Number of decimal places. Defaults to 0. */
  decimals?: number;
  /** Prefix (e.g. "₹"). Defaults to ₹ for INR currency feel. */
  prefix?: string;
  /** Suffix (e.g. "%", " yrs"). */
  suffix?: string;
  /** Duration of the count animation in seconds. */
  duration?: number;
  /** Sign behavior — `auto` colors positive green / negative red. */
  signColor?: SignMode;
  /** When `true`, formats as Indian-locale grouping (1,00,000). */
  indianGrouping?: boolean;
  /** Custom className applied to the wrapping span. */
  className?: string;
  /** Render the value as compact (1.2L, 45K) when large. */
  compact?: boolean;
  /** Render only the integer portion as a giant headline. */
  large?: boolean;
}

function compactFormat(n: number): { value: number; suffix: string } {
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return { value: n / 1_00_00_000, suffix: "Cr" };
  if (abs >= 1_00_000) return { value: n / 1_00_000, suffix: "L" };
  if (abs >= 1_000) return { value: n / 1_000, suffix: "K" };
  return { value: n, suffix: "" };
}

/**
 * Renders a number with smooth count-up animation. The number's
 * displayed sign + color is handled here so callers can drop
 * `<AnimatedCounter value={x} />` anywhere.
 */
export function AnimatedCounter({
  value,
  decimals = 0,
  prefix = "₹",
  suffix,
  duration = 1.2,
  signColor = "auto",
  indianGrouping = true,
  className,
  compact = false,
  large = false,
}: AnimatedCounterProps) {
  const isNegative = value < 0;
  const isPositive = value > 0;

  let displayValue = Math.abs(value);
  let computedSuffix = suffix ?? "";
  if (compact) {
    const c = compactFormat(value);
    displayValue = Math.abs(c.value);
    computedSuffix = c.suffix + (suffix ?? "");
  }

  const colorClass =
    signColor === "never"
      ? ""
      : signColor === "always"
      ? isNegative
        ? "text-danger"
        : "text-success"
      : isNegative
      ? "text-danger"
      : isPositive
      ? "text-foreground"
      : "text-foreground";

  // Use Indian numbering style via Intl when not in compact mode.
  const formattingFn = (n: number) =>
    indianGrouping && !compact
      ? n.toLocaleString("en-IN", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : n.toFixed(decimals);

  return (
    <span
      className={cn(
        "tabular-nums tracking-tight",
        large && "text-3xl font-bold",
        colorClass,
        className
      )}
    >
      {isNegative && "-"}
      {prefix}
      <CountUp
        end={displayValue}
        duration={duration}
        decimals={decimals}
        preserveValue
        formattingFn={formattingFn}
      />
      {computedSuffix}
    </span>
  );
}

export default AnimatedCounter;
