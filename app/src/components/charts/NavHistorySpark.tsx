"use client";

import * as React from "react";

export interface NavPoint {
  date: string;
  nav: number;
}

export interface NavHistorySparkProps {
  data: NavPoint[];
  width?: number;
  height?: number;
  /** Color override. Defaults to brand. */
  color?: string;
}

/**
 * Tiny inline sparkline for a fund's NAV history. Pure SVG — no
 * Recharts so it stays cheap in lists.
 */
export function NavHistorySpark({
  data,
  width = 96,
  height = 28,
  color = "hsl(var(--brand))",
}: NavHistorySparkProps) {
  if (data.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden
      >
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="hsl(var(--muted))"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
      </svg>
    );
  }

  const navs = data.map((d) => d.nav);
  const min = Math.min(...navs);
  const max = Math.max(...navs);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  const points = data
    .map((d, i) => {
      const x = i * step;
      const y = height - ((d.nav - min) / range) * (height - 2) - 1;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const startNav = data[0]?.nav ?? 0;
  const endNav = data[data.length - 1]?.nav ?? 0;
  const isUp = endNav >= startNav;
  const stroke = isUp ? color : "hsl(var(--danger))";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-label={`NAV trend: ${isUp ? "up" : "down"} ${
        Math.abs(((endNav - startNav) / startNav) * 100).toFixed(1)
      }%`}
      role="img"
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default NavHistorySpark;
