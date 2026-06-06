"use client";

import { useMemo } from "react";

interface BalanceSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showDot?: boolean;
}

export default function BalanceSparkline({
  data,
  width = 80,
  height = 28,
  color: _color = "var(--color-brand)",
  showDot = true,
}: BalanceSparklineProps) {
  const pathD = useMemo(() => {
    if (data.length < 2) return "";
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padY = 3;
    const usableH = height - padY * 2;
    const stepX = width / (data.length - 1);

    return data
      .map((v, i) => {
        const x = i * stepX;
        const y = padY + usableH - ((v - min) / range) * usableH;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [data, width, height]);

  if (data.length < 2) return null;

  const lastX = width;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padY = 3;
  const usableH = height - padY * 2;
  const lastY = padY + usableH - ((data[data.length - 1] - min) / range) * usableH;
  const trend = data[data.length - 1] >= data[0];

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <path
        d={pathD}
        fill="none"
        stroke={trend ? "var(--color-success)" : "var(--color-danger)"}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDot && (
        <circle
          cx={lastX - (width / (data.length - 1)) * 0 }
          cy={lastY}
          r={2.5}
          fill={trend ? "var(--color-success)" : "var(--color-danger)"}
        />
      )}
    </svg>
  );
}
