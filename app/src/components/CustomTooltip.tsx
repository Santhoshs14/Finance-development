"use client";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; payload?: Record<string, unknown> }>;
  label?: string;
}

export default function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="glass-sheet rounded-xl px-3 py-2 text-xs">
      {label && <p className="mb-1 font-semibold text-foreground">{label}</p>}
      {payload.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color }} />
          <span className="tabular-nums text-foreground/80">{item.name}: ₹{(item.value || 0).toLocaleString("en-IN")}</span>
        </div>
      ))}
    </div>
  );
}
