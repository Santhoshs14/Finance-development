/**
 * Centralized chart theme — read CSS variables so light/dark mode
 * is automatic and there's a single source of truth for colors used
 * across every Recharts visualization.
 */

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
  colors: ["#0080ff", "#f59e0b", "#10b981", "#a855f7", "#0ea5e9", "#ec4899"],
  semantic: {
    brand: "#0080ff",
    accent: "#f59e0b",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    info: "#0ea5e9",
    purple: "#a855f7",
  },
  grid: "#e2e8f0",
  axis: "#64748b",
  text: "#0f172a",
  tooltipBg: "#ffffff",
  tooltipBorder: "#e2e8f0",
};

/** Color palette used for category breakdowns when no per-category color is set. */
export const CATEGORY_PALETTE = [
  "#0080ff", "#f59e0b", "#10b981", "#a855f7", "#0ea5e9", "#ec4899",
  "#f97316", "#14b8a6", "#84cc16", "#06b6d4", "#eab308", "#8b5cf6",
  "#ef4444", "#3b82f6", "#22c55e",
];

/** Deterministic color assignment for a category name. */
export function colorForCategory(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length] ?? "#0080ff";
}
