"use client";

import dynamic from "next/dynamic";

/**
 * Lazy-loaded Recharts primitives — splits ~280KB out of the initial bundle.
 * Pages that need charts import from here instead of `recharts` directly.
 */

const loader = (factory: () => Promise<unknown>) =>
  dynamic(
    async () => {
      const mod = await factory();
      return mod as { default: React.ComponentType<unknown> };
    },
    { ssr: false }
  );

export const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);
export const AreaChart = dynamic(() => import("recharts").then((m) => m.AreaChart), { ssr: false });
export const Area = dynamic(() => import("recharts").then((m) => m.Area), { ssr: false });
export const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
export const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
export const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
export const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
export const PieChart = dynamic(() => import("recharts").then((m) => m.PieChart), { ssr: false });
export const Pie = dynamic(() => import("recharts").then((m) => m.Pie), { ssr: false });
export const Cell = dynamic(() => import("recharts").then((m) => m.Cell), { ssr: false });
export const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
export const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
export const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
export const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
export const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });
export const RadialBarChart = dynamic(() => import("recharts").then((m) => m.RadialBarChart), { ssr: false });
export const RadialBar = dynamic(() => import("recharts").then((m) => m.RadialBar), { ssr: false });
export const ReferenceLine = dynamic(() => import("recharts").then((m) => m.ReferenceLine), { ssr: false });
export const Sankey = dynamic(() => import("recharts").then((m) => m.Sankey), { ssr: false });
export const Treemap = dynamic(() => import("recharts").then((m) => m.Treemap), { ssr: false });

// (loader is exported in case a downstream chart wants its own custom dynamic factory)
export { loader };
