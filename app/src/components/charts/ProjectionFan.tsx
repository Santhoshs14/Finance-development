"use client";

import * as React from "react";
import { fmt } from "@/utils/format";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "./lazy";

export interface FanPoint {
  /** X-axis label (e.g. month). */
  label: string;
  /** Lower band (p10). */
  low: number;
  /** Median (p50). */
  median: number;
  /** Upper band (p90). */
  high: number;
}

export interface ProjectionFanProps {
  data: FanPoint[];
  height?: number;
  /** When provided, draws a horizontal reference line for the goal. */
  targetValue?: number;
}

/**
 * Monte-Carlo style "fan chart": stacked area for the high band,
 * inset area for the low band (rendered as background gap), and a
 * bold line for the median forecast.
 */
export function ProjectionFan({ data, height = 280 }: ProjectionFanProps) {
  if (!data.length) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Not enough history to project yet.
      </div>
    );
  }

  return (
    <div role="img" aria-label="Projection fan chart">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 12, left: 8, bottom: 10 }}>
          <defs>
            <linearGradient id="fan-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          />
          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickFormatter={(v: number) => fmt(v)}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0]?.payload as FanPoint | undefined;
              if (!point) return null;
              return (
                <div className="rounded-xl border border-border bg-popover p-3 elev-3">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-sm font-semibold">Median: {fmt(point.median)}</div>
                  <div className="text-xs text-muted-foreground">
                    p10–p90: {fmt(point.low)} → {fmt(point.high)}
                  </div>
                </div>
              );
            }}
          />
          {/* Render the "high" band, then overlay the "low" band in background to leave gap. */}
          <Area
            type="monotone"
            dataKey="high"
            stroke="transparent"
            fill="url(#fan-fill)"
          />
          <Area
            type="monotone"
            dataKey="low"
            stroke="transparent"
            fill="hsl(var(--background))"
          />
          <Line
            type="monotone"
            dataKey="median"
            stroke="hsl(var(--brand))"
            strokeWidth={2.5}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <table className="sr-only">
        <caption>Projection bands</caption>
        <thead><tr><th>Period</th><th>p10</th><th>Median</th><th>p90</th></tr></thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <td>{d.label}</td>
              <td>{fmt(d.low)}</td>
              <td>{fmt(d.median)}</td>
              <td>{fmt(d.high)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ProjectionFan;
