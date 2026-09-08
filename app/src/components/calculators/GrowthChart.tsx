"use client";

import { useId } from "react";
import ChartCard from "@/components/ChartCard";
import CustomTooltip from "@/components/CustomTooltip";
import { fmtCompact } from "@/utils/format";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "@/components/charts/lazy";

export interface GrowthSeries {
  key: string;
  name: string;
  color: string;
}

interface GrowthChartProps {
  title: string;
  subtitle?: string;
  data: readonly object[];
  xKey: string;
  xLabelPrefix?: string;
  series: GrowthSeries[];
  stacked?: boolean;
}

/** Shared area chart for the year/month-wise schedules every calculator returns. */
export function GrowthChart({
  title,
  subtitle,
  data,
  xKey,
  xLabelPrefix = "Year",
  series,
  stacked = true,
}: GrowthChartProps) {
  const gradientId = useId().replace(/:/g, "");

  return (
    <ChartCard title={title} subtitle={subtitle}>
      <div className="w-full" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {series.map((s) => (
                <linearGradient
                  key={s.key}
                  id={`${gradientId}-${s.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor={s.color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={s.color} stopOpacity={0.04} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              width={64}
              className="fill-muted-foreground"
              tickFormatter={(v: number) => fmtCompact(v)}
            />
            <Tooltip
              content={<CustomTooltip />}
              labelFormatter={(label: React.ReactNode) => `${xLabelPrefix} ${label}`}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stackId={stacked ? "1" : undefined}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#${gradientId}-${s.key})`}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
