"use client";

import * as React from "react";
import { fmt } from "@/utils/format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "./lazy";

export interface WaterfallEntry {
  name: string;
  /** Positive for income, negative for expense. Set `type: 'total'` for the
   *  opening / closing pillars that show absolute height. */
  value: number;
  type?: "income" | "expense" | "total";
}

export interface CashflowWaterfallProps {
  entries: WaterfallEntry[];
  height?: number;
}

interface RechartsBarData {
  name: string;
  base: number;
  height: number;
  raw: number;
  fill: string;
  type: "income" | "expense" | "total";
}

/**
 * Stacked-bar waterfall chart that walks from opening balance through
 * income (positive) and expenses (negative) to a closing balance.
 */
export function CashflowWaterfall({ entries, height = 280 }: CashflowWaterfallProps) {
  const data = React.useMemo<RechartsBarData[]>(() => {
    let running = 0;
    const out: RechartsBarData[] = [];
    for (const e of entries) {
      if (e.type === "total") {
        out.push({
          name: e.name,
          base: 0,
          height: e.value,
          raw: e.value,
          fill: "hsl(var(--brand))",
          type: "total",
        });
        running = e.value;
        continue;
      }
      const next = running + e.value;
      const base = Math.min(running, next);
      const barHeight = Math.abs(e.value);
      out.push({
        name: e.name,
        base,
        height: barHeight,
        raw: e.value,
        fill:
          e.value >= 0
            ? "hsl(var(--success))"
            : "hsl(var(--danger))",
        type: e.value >= 0 ? "income" : "expense",
      });
      running = next;
    }
    return out;
  }, [entries]);

  if (data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No cashflow data to visualize.
      </div>
    );
  }

  return (
    <div role="img" aria-label="Cashflow waterfall chart">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickFormatter={(v: number) => fmt(v)}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0]?.payload as RechartsBarData | undefined;
              if (!item) return null;
              return (
                <div className="rounded-xl border border-border bg-popover p-3 elev-3">
                  <div className="text-xs text-muted-foreground">{item.name}</div>
                  <div className="text-sm font-semibold">{fmt(item.raw)}</div>
                </div>
              );
            }}
          />
          {/* Invisible base bar so the visible bar floats */}
          <Bar dataKey="base" stackId="a" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="height" stackId="a" radius={[6, 6, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <table className="sr-only">
        <caption>Cashflow waterfall data</caption>
        <thead>
          <tr><th>Stage</th><th>Amount</th></tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i}>
              <td>{e.name}</td>
              <td>{fmt(e.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default CashflowWaterfall;
