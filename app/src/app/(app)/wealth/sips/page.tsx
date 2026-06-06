"use client";

import { useMemo } from "react";
import { useInvestments } from "@/hooks/useInvestments";
import { calculateSIPGrowth } from "@/utils/calculations";
import StatCard from "@/components/StatCard";
import ChartCard from "@/components/ChartCard";
import EmptyState from "@/components/EmptyState";
import { useTheme } from "@/providers/ThemeProvider";
import { Repeat, TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";

const PROJECTION_YEARS = [1, 3, 5, 10];
const ASSUMED_RETURN = 12; // 12% annual return for SIP projection

export default function SIPsPage() {
  const { investments, isLoading } = useInvestments();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const activeSIPs = useMemo(
    () => investments.filter((i) => (i.sip_amount || 0) > 0),
    [investments]
  );

  const monthlyOutflow = useMemo(
    () => activeSIPs.reduce((sum, i) => sum + (i.sip_amount || 0), 0),
    [activeSIPs]
  );

  const totalSIPInvested = useMemo(
    () => activeSIPs.reduce((sum, i) => sum + (i.buy_price * i.quantity || i.invested_amount || 0), 0),
    [activeSIPs]
  );

  const totalSIPCurrent = useMemo(
    () => activeSIPs.reduce((sum, i) => sum + (i.current_price * i.quantity || i.current_value || i.value || 0), 0),
    [activeSIPs]
  );

  // Growth projection chart data
  const projectionData = useMemo(() => {
    if (monthlyOutflow === 0) return [];
    return PROJECTION_YEARS.map((yr) => {
      const result = calculateSIPGrowth(monthlyOutflow, ASSUMED_RETURN, yr);
      return {
        year: `${yr}Y`,
        invested: Math.round(result.total_invested),
        value: Math.round(result.estimated_value),
        returns: Math.round(result.estimated_returns),
      };
    });
  }, [monthlyOutflow]);

  if (isLoading) {
    return <div className="animate-pulse space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted" />)}</div>;
  }

  if (activeSIPs.length === 0) {
    return (
      <EmptyState
        icon={Repeat}
        title="No active SIPs"
        description="Add a SIP amount to any investment in your Portfolio to track it here. SIPs help build wealth through disciplined investing."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Monthly SIP Outflow" value={monthlyOutflow} icon={Repeat} delay={0} />
        <StatCard title="Total SIP Invested" value={totalSIPInvested} color="accent" delay={0.1} />
        <StatCard
          title="Current SIP Value"
          value={totalSIPCurrent}
          color={totalSIPCurrent >= totalSIPInvested ? "primary" : "danger"}
          trend={totalSIPInvested > 0 ? ((totalSIPCurrent - totalSIPInvested) / totalSIPInvested) * 100 : 0}
          trendLabel="returns"
          delay={0.2}
        />
      </div>

      {/* Growth Projection */}
      {projectionData.length > 0 && (
        <ChartCard title="SIP Growth Projection" subtitle={`Assuming ${ASSUMED_RETURN}% annual returns`}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={projectionData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1f2937" : "#e5e7eb"} />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: isDark ? "#9ca3af" : "#6b7280" }} />
              <YAxis
                tick={{ fontSize: 11, fill: isDark ? "#9ca3af" : "#6b7280" }}
                tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`}
              />
              <Tooltip
                contentStyle={{ background: isDark ? "#1f2937" : "#fff", border: "none", borderRadius: 12 }}
                formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, ""]}
              />
              <Area type="monotone" dataKey="invested" stackId="1" stroke="#6b7280" fill="#6b7280" fillOpacity={0.3} name="Invested" />
              <Area type="monotone" dataKey="returns" stackId="1" stroke="#1abf94" fill="#1abf94" fillOpacity={0.4} name="Returns" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Active SIP Cards */}
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-foreground px-1">Active SIPs ({activeSIPs.length})</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeSIPs.map((sip, idx) => {
          const invested = sip.buy_price * sip.quantity || sip.invested_amount || 0;
          const current = sip.current_price * sip.quantity || sip.current_value || sip.value || 0;
          const pl = current - invested;
          const plPct = invested > 0 ? (pl / invested) * 100 : 0;

          return (
            <motion.div
              key={sip.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="rounded-2xl border border-border p-4 space-y-3"
              style={{ background: isDark ? "#111827" : "#ffffff" }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-foreground">{sip.name}</h4>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
                    {sip.investment_type || "Equity"}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Monthly</p>
                  <p className="text-sm font-bold text-brand">₹{(sip.sip_amount || 0).toLocaleString("en-IN")}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Invested</p>
                  <p className="font-semibold text-foreground">₹{invested.toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Current</p>
                  <p className="font-semibold text-foreground">₹{current.toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Returns</p>
                  <p className={`font-semibold ${pl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {pl >= 0 ? "+" : ""}{plPct.toFixed(1)}%
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* SIP Tip */}
      <div className="rounded-2xl border border-border p-4 flex items-start gap-3" style={{ background: isDark ? "#111827" : "#ffffff" }}>
        <TrendingUp className="w-5 h-5 text-brand shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">SIP Insight</p>
          <p className="text-xs text-muted-foreground mt-1">
            At ₹{monthlyOutflow.toLocaleString("en-IN")}/month with {ASSUMED_RETURN}% returns, your SIPs could grow to{" "}
            <span className="font-semibold text-brand">
              ₹{calculateSIPGrowth(monthlyOutflow, ASSUMED_RETURN, 10).estimated_value.toLocaleString("en-IN")}
            </span>{" "}
            in 10 years.
          </p>
        </div>
      </div>
    </div>
  );
}
