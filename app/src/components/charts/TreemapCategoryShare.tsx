"use client";

import * as React from "react";
import { fmt } from "@/utils/format";
import { ResponsiveContainer, Tooltip, Treemap } from "./lazy";
import { colorForCategory } from "./theme";

export interface TreemapCategoryShareProps {
  /** Map of category → spent amount. */
  breakdown: Record<string, number>;
  height?: number;
}

interface TreemapDatum extends Record<string, unknown> {
  name: string;
  size: number;
  fill: string;
}

/**
 * Treemap of spend share per category. Each rectangle's area is
 * proportional to the spend, color-coded deterministically.
 */
export function TreemapCategoryShare({
  breakdown,
  height = 320,
}: TreemapCategoryShareProps) {
  const data = React.useMemo<TreemapDatum[]>(() => {
    return Object.entries(breakdown)
      .filter(([, v]) => v > 0)
      .map(([name, v]) => ({ name, size: v, fill: colorForCategory(name) }))
      .sort((a, b) => b.size - a.size);
  }, [breakdown]);

  if (!data.length) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No spending to break down yet.
      </div>
    );
  }

  return (
    <div role="img" aria-label="Treemap of category spend share">
      <ResponsiveContainer width="100%" height={height}>
        <Treemap
          data={data}
          dataKey="size"
          stroke="hsl(var(--background))"
          fill="hsl(var(--brand))"
          isAnimationActive
          animationDuration={500}
        >
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0]?.payload as TreemapDatum | undefined;
              if (!item) return null;
              return (
                <div className="rounded-xl border border-border bg-popover p-3 elev-3">
                  <div className="text-xs text-muted-foreground">{item.name}</div>
                  <div className="text-sm font-semibold">{fmt(item.size)}</div>
                </div>
              );
            }}
          />
        </Treemap>
      </ResponsiveContainer>
      <table className="sr-only">
        <caption>Category spend share</caption>
        <thead><tr><th>Category</th><th>Amount</th></tr></thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.name}><td>{d.name}</td><td>{fmt(d.size)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TreemapCategoryShare;
