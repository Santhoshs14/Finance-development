"use client";

import * as React from "react";
import { fmt } from "@/utils/format";
import { Sankey, Tooltip, ResponsiveContainer } from "./lazy";
import { colorForCategory } from "./theme";

export interface MoneyFlowNode {
  name: string;
}

export interface MoneyFlowLink {
  source: number;
  target: number;
  value: number;
}

export interface MoneyFlowSankeyProps {
  /** Income transactions grouped by source label. */
  incomeBySource: Record<string, number>;
  /** Expenses grouped by category. */
  expensesByCategory: Record<string, number>;
  /** Optional summary node label between income and expenses. */
  centralLabel?: string;
  height?: number;
}

/**
 * Sankey diagram showing income → savings → expense categories.
 *
 * The visualization adapts to any input. Income sources flow into a
 * central "Total Income" node, which then flows to: each expense
 * category (proportional to spend) and a "Savings" remainder if any.
 */
export function MoneyFlowSankey({
  incomeBySource,
  expensesByCategory,
  centralLabel = "Total Income",
  height = 320,
}: MoneyFlowSankeyProps) {
  const data = React.useMemo(() => {
    const nodes: MoneyFlowNode[] = [];
    const links: MoneyFlowLink[] = [];

    const totalIncome = Object.values(incomeBySource).reduce((a, b) => a + b, 0);
    const totalExpense = Object.values(expensesByCategory).reduce((a, b) => a + b, 0);
    const savings = Math.max(0, totalIncome - totalExpense);

    // 1) Income source nodes
    const incomeEntries = Object.entries(incomeBySource).filter(([, v]) => v > 0);
    for (const [name] of incomeEntries) nodes.push({ name });
    // 2) Central node
    const centralIdx = nodes.length;
    nodes.push({ name: centralLabel });
    // 3) Expense category nodes
    const expenseEntries = Object.entries(expensesByCategory).filter(([, v]) => v > 0);
    for (const [name] of expenseEntries) nodes.push({ name });
    // 4) Savings node
    if (savings > 0) nodes.push({ name: "Savings" });

    // Links: income → central
    incomeEntries.forEach(([, value], i) => {
      links.push({ source: i, target: centralIdx, value });
    });

    // Links: central → expenses
    expenseEntries.forEach(([, value], i) => {
      links.push({
        source: centralIdx,
        target: centralIdx + 1 + i,
        value,
      });
    });

    if (savings > 0) {
      links.push({
        source: centralIdx,
        target: nodes.length - 1,
        value: savings,
      });
    }

    return { nodes, links };
  }, [incomeBySource, expensesByCategory, centralLabel]);

  if (data.nodes.length === 0 || data.links.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No income or expenses to visualize yet.
      </div>
    );
  }

  return (
    <div role="img" aria-label="Sankey diagram of money flow">
      <ResponsiveContainer width="100%" height={height}>
        <Sankey
          data={data}
          node={{ stroke: "transparent", strokeWidth: 0 }}
          link={{ stroke: "transparent" }}
          nodePadding={20}
          margin={{ top: 10, right: 100, bottom: 10, left: 10 }}
          nodeWidth={10}
        >
          <Tooltip
            formatter={(value: unknown) => fmt(Number(value))}
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 12,
            }}
          />
        </Sankey>
      </ResponsiveContainer>
      {/* Hidden accessible table fallback */}
      <table className="sr-only">
        <caption>Money flow breakdown</caption>
        <thead>
          <tr><th>Source</th><th>Target</th><th>Amount</th></tr>
        </thead>
        <tbody>
          {data.links.map((l, i) => (
            <tr key={i}>
              <td>{data.nodes[l.source]?.name}</td>
              <td>{data.nodes[l.target]?.name}</td>
              <td>{fmt(l.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Help the linter understand the deterministic palette helper is part of this module's API.
export const _internalForTests = { colorForCategory };

export default MoneyFlowSankey;
