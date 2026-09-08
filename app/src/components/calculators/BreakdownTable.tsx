"use client";

import { useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface BreakdownColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
}

interface BreakdownTableProps<T> {
  title: string;
  columns: BreakdownColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  /** Rows shown before the "Show all" toggle appears. */
  initialRows?: number;
  emptyMessage?: string;
}

export function BreakdownTable<T>({
  title,
  columns,
  rows,
  rowKey,
  initialRows = 12,
  emptyMessage = "Enter values above to see the breakdown.",
}: BreakdownTableProps<T>) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, initialRows);
  const hidden = rows.length - visible.length;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        {rows.length > initialRows && (
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Show less" : `Show all ${rows.length}`}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">{emptyMessage}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        scope="col"
                        className={cn(
                          "py-2 text-xs font-medium text-muted-foreground whitespace-nowrap",
                          col.align === "right" ? "text-right" : "text-left"
                        )}
                      >
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row, i) => (
                    <tr key={rowKey(row, i)} className="border-b border-border/50">
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            "py-2.5 whitespace-nowrap",
                            col.align === "right"
                              ? "text-right text-foreground"
                              : "text-left text-muted-foreground"
                          )}
                        >
                          {col.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hidden > 0 && (
              <p className="text-[11px] text-muted-foreground mt-3">
                {hidden} more {hidden === 1 ? "row" : "rows"} hidden.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
