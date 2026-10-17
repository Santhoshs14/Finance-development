/**
 * Centralized chart theme — read CSS variables so light/dark mode
 * is automatic and there's a single source of truth for colors used
 * across every Recharts visualization.
 */

import type { CSSProperties } from "react";

export interface ChartTheme {
  colors: string[];
  semantic: {
    success: string;
    warning: string;
    danger: string;
    info: string;
    brand: string;
    accent: string;
    purple: string;
  };
  grid: string;
  axis: string;
  text: string;
  tooltipBg: string;
  tooltipBorder: string;
}

/**
 * Theme-reactive colors as CSS variable references. Recharts passes them to SVG
 * attributes and inline styles, so light/dark switches apply without re-rendering.
 */
export const CHART_COLORS = {
  grid: "hsl(var(--border))",
  axis: "hsl(var(--muted-foreground))",
  track: "hsl(var(--muted))",
  surface: "hsl(var(--card))",
  text: "hsl(var(--foreground))",
} as const;

export const CHART_TOOLTIP_STYLE: CSSProperties = {
  background: "hsl(var(--popover))",
  color: "hsl(var(--foreground))",
  border: "0.5px solid hsl(var(--border))",
  borderRadius: 12,
  boxShadow: "var(--elev-3)",
};

export const CHART_TICK = { fontSize: 11, fill: CHART_COLORS.axis } as const;

/**
 * Helper that runs only on the client and reads the current CSS vars.
 * Falls back to sensible defaults during SSR.
 */
export function getChartTheme(): ChartTheme {
  if (typeof window === "undefined") {
    return DEFAULT_LIGHT_THEME;
  }
  const styles = getComputedStyle(document.documentElement);
  const hsl = (v: string) => `hsl(${styles.getPropertyValue(v).trim()})`;
  return {
    colors: [
      hsl("--chart-1"),
      hsl("--chart-2"),
      hsl("--chart-3"),
      hsl("--chart-4"),
      hsl("--chart-5"),
      hsl("--chart-6"),
    ],
    semantic: {
      brand: hsl("--brand"),
      accent: hsl("--accent"),
      success: hsl("--success"),
      warning: hsl("--warning"),
      danger: hsl("--danger"),
      info: hsl("--info"),
      purple: hsl("--chart-4"),
    },
    grid: hsl("--border"),
    axis: hsl("--muted-foreground"),
    text: hsl("--foreground"),
    tooltipBg: hsl("--popover"),
    tooltipBorder: hsl("--border"),
  };
}

const DEFAULT_LIGHT_THEME: ChartTheme = {
  colors: ["#007AFF", "#FF9500", "#34C759", "#AF52DE", "#32ADE6", "#FF2D55"],
  semantic: {
    brand: "#007AFF",
    accent: "#FF9500",
    success: "#248A3D",
    warning: "#C93400",
    danger: "#E5281C",
    info: "#0071A4",
    purple: "#AF52DE",
  },
  grid: "#E3E3E8",
  axis: "#6C6C70",
  text: "#000000",
  tooltipBg: "#FFFFFF",
  tooltipBorder: "#E3E3E8",
};

/** Color palette used for category breakdowns when no per-category color is set (iOS system hues). */
export const CATEGORY_PALETTE = [
  "#007AFF", "#FF9500", "#34C759", "#AF52DE", "#32ADE6", "#FF2D55",
  "#5856D6", "#00C7BE", "#FFCC00", "#30B0C7", "#FF3B30", "#A2845E",
  "#64D2FF", "#BF5AF2", "#30D158",
];

/** Deterministic color assignment for a category name. */
export function colorForCategory(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length] ?? "#007AFF";
}
