"use client";

import * as React from "react";
import { fmt } from "@/utils/format";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "./lazy";
import { colorForCategory } from "./theme";

export interface DonutDatum {
  name: string;
  value: number;
  color?: string;
}

export interface DonutWithCenterProps {
  data: DonutDatum[];
  /** Center label (e.g. "Total"). */
  centerLabel?: string;
  /** Center value (auto-sums data if not provided). */
  centerValue?: number;
  height?: number;
}

/**
 * Donut chart with a centered KPI label — a common finance-dashboard pattern.
 */
export function DonutWithCenter({
  data,
  centerLabel = "Total",
  centerValue,
  height = 240,
}: DonutWithCenterProps) {
  const total = centerValue ?? data.reduce((a, b) => a + b.value, 0);

  if (!data.length || total === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No data yet.
      </div>
    );
  }

  return (
    <div className="relative" role="img" aria-label={`Donut chart, ${centerLabel}: ${fmt(total)}`}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={2}
            stroke="hsl(var(--background))"
            strokeWidth={2}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color ?? colorForCategory(d.name)} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: unknown) => fmt(Number(v))}
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{centerLabel}</div>
        <div className="text-lg font-bold text-foreground tabular-nums">{fmt(total)}</div>
      </div>
    </div>
  );
}

export default DonutWithCenter;
