"use client";

import ChartCard from "@/components/ChartCard";
import { fmt } from "@/utils/format";
import { Cell, Pie, PieChart, ResponsiveContainer } from "@/components/charts/lazy";

export interface SplitSlice {
  name: string;
  value: number;
  color: string;
}

interface SplitDonutProps {
  title: string;
  subtitle?: string;
  slices: SplitSlice[];
}

/** Composition donut with a legend — used for principal/interest style splits. */
export function SplitDonut({ title, subtitle, slices }: SplitDonutProps) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <ChartCard title={title} subtitle={subtitle}>
      <div className="w-full" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius={62}
              outerRadius={92}
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {slices.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-2 mt-2">
        {slices.map((slice) => (
          <li key={slice.name} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              {slice.name}
            </span>
            <span className="font-medium text-foreground">
              {fmt(slice.value)}
              {total > 0 && (
                <span className="ml-1.5 text-muted-foreground font-normal">
                  {((slice.value / total) * 100).toFixed(1)}%
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}
