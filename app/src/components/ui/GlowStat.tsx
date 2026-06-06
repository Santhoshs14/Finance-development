"use client";

import * as React from "react";
import { Card } from "./Card";
import { AnimatedCounter, type AnimatedCounterProps } from "./AnimatedCounter";
import { TrendPill } from "./TrendPill";
import { cn } from "@/lib/utils";

export interface GlowStatProps {
  label: string;
  value: number;
  icon?: React.ReactNode;
  /** Counter formatting hints. */
  prefix?: AnimatedCounterProps["prefix"];
  suffix?: AnimatedCounterProps["suffix"];
  decimals?: AnimatedCounterProps["decimals"];
  compact?: boolean;
  /** Percentage trend vs previous period (signed). */
  delta?: number;
  /** Set false when down is "good" (e.g. expenses, debt). */
  higherIsBetter?: boolean;
  /** Glow color — defaults to brand. */
  glow?: "brand" | "success" | "warning" | "danger" | "accent" | "info" | "none";
  className?: string;
  /** Optional sublabel below the value. */
  sublabel?: string;
}

const GLOW_TO_CLASS: Record<NonNullable<GlowStatProps["glow"]>, string> = {
  none: "",
  brand: "glow-brand",
  success: "glow-success",
  warning: "glow-warning",
  danger: "glow-danger",
  accent: "glow-accent",
  info: "glow-info",
};

/**
 * Premium KPI card: large animated value, optional trend pill, optional glow.
 */
export function GlowStat({
  label,
  value,
  icon,
  prefix = "₹",
  suffix,
  decimals = 0,
  compact = true,
  delta,
  higherIsBetter = true,
  glow = "brand",
  className,
  sublabel,
}: GlowStatProps) {
  return (
    <Card
      variant="default"
      className={cn(
        "p-5 transition-shadow duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:elev-3",
        GLOW_TO_CLASS[glow],
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <AnimatedCounter
              value={value}
              prefix={prefix}
              suffix={suffix}
              decimals={decimals}
              compact={compact}
              signColor="never"
              className="text-2xl font-bold"
            />
          </div>
          {(delta !== undefined || sublabel) && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              {delta !== undefined && (
                <TrendPill delta={delta} higherIsBetter={higherIsBetter} />
              )}
              {sublabel && <span>{sublabel}</span>}
            </div>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand",
              glow === "success" && "bg-success/10 text-success",
              glow === "warning" && "bg-warning/10 text-warning",
              glow === "danger" && "bg-danger/10 text-danger",
              glow === "accent" && "bg-accent/10 text-accent",
              glow === "info" && "bg-info/10 text-info"
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

export default GlowStat;
