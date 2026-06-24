"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useInvestments } from "@/hooks/useInvestments";
import { useSips } from "@/hooks/useSips";
import { useData } from "@/providers/DataProvider";
import {
  calculateInvestmentPL,
  calculatePortfolioAllocation,
  calculateXIRR,
  daysToMaturity,
} from "@/utils/calculations";
import { fmt } from "@/utils/format";
import StatCard from "@/components/StatCard";
import ChartCard from "@/components/ChartCard";
import EmptyState from "@/components/EmptyState";
import { useTheme } from "@/providers/ThemeProvider";
import {
  TrendingUp,
  TrendingDown,
  Repeat,
  Gem,
  Landmark,
  ArrowRight,
  CalendarClock,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const PIE_COLORS = ["#1abf94", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#6b7280"];
const FREQ_TO_MONTHLY: Record<string, number> = {
  weekly: 52 / 12,
  monthly: 1,
  yearly: 1 / 12,
};

/**
 * Investments Overview — read-only summary + insights. All add / edit / delete
 * lives in the Mutual Funds, Gold, and Other tabs.
 */
export default function InvestmentsOverviewPage() {
  const { investments, isLoading } = useInvestments();
  const { sips } = useSips();
  const { accounts } = useData();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const router = useRouter();

  const plData = useMemo(() => calculateInvestmentPL(investments), [investments]);
  const allocation = useMemo(
    () => calculatePortfolioAllocation(accounts, investments),
    [accounts, investments]
  );

  const totals = useMemo(() => {
    const invested = plData.reduce((s, p) => s + p.invested, 0);
    const current = plData.reduce((s, p) => s + p.current_value, 0);
    const pl = current - invested;
    const plPct = invested > 0 ? (pl / invested) * 100 : 0;
    return { invested, current, pl, plPct };
  }, [plData]);

  const portfolioXIRR = useMemo(() => {
    const cashflows: { date: string; amount: number }[] = [];
    investments.forEach((inv) => {
      if (inv.purchase_date && inv.buy_price && inv.quantity) {
        cashflows.push({ date: inv.purchase_date, amount: -(inv.buy_price * inv.quantity) });
      }
    });
    if (cashflows.length === 0) return null;
    const today = new Date().toISOString().slice(0, 10);
    const totalCurrent = investments.reduce(
      (s, inv) => s + (inv.current_price * inv.quantity || inv.current_value || 0),
      0
    );
    cashflows.push({ date: today, amount: totalCurrent });
    const result = calculateXIRR(cashflows);
    return isFinite(result) ? result : null;
  }, [investments]);

  const pieData = useMemo(
    () =>
      Object.entries(allocation.percentages)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value })),
    [allocation]
  );

  // By-instrument totals (current value per investment_type).
  const byType = useMemo(() => {
    const map = new Map<string, number>();
    investments.forEach((inv) => {
      const v = inv.current_price * inv.quantity || inv.current_value || 0;
      const key = inv.investment_type || "Other";
      map.set(key, (map.get(key) || 0) + v);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [investments]);

  const movers = useMemo(() => {
    const sorted = [...plData]
      .filter((p) => p.invested > 0)
      .sort((a, b) => b.pl_percentage - a.pl_percentage);
    return { best: sorted.slice(0, 3), worst: sorted.slice(-3).reverse() };
  }, [plData]);

  const activeSips = useMemo(() => sips.filter((s) => s.status === "active"), [sips]);
  const monthlyCommitment = useMemo(
    () =>
      activeSips.reduce(
        (s, sip) => s + sip.amount * (FREQ_TO_MONTHLY[sip.frequency] ?? 1),
        0
      ),
    [activeSips]
  );
  const upcomingSips = useMemo(
    () =>
      [...activeSips]
        .sort((a, b) => a.next_date.localeCompare(b.next_date))
        .slice(0, 4),
    [activeSips]
  );

  const maturing = useMemo(
    () =>
      investments
        .map((inv) => ({ inv, days: daysToMaturity(inv.maturity_date) }))
        .filter(
          (m): m is { inv: (typeof investments)[number]; days: number } =>
            m.days !== null && m.days >= 0
        )
        .sort((a, b) => a.days - b.days)
        .slice(0, 4),
    [investments]
  );

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  if (investments.length === 0 && sips.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No investments yet"
        description="Add mutual funds, gold, or other assets to see your portfolio summary and insights here."
        actionLabel="Add Mutual Funds"
        onAction={() => router.push("/investments/mutual-funds")}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Total Invested" value={totals.invested} icon={TrendingUp} delay={0} />
        <StatCard title="Current Value" value={totals.current} color="accent" delay={0.1} />
        <StatCard
          title="Total P/L"
          value={totals.pl}
          color={totals.pl >= 0 ? "primary" : "danger"}
          trend={Number(totals.plPct.toFixed(2))}
          trendLabel="overall"
          delay={0.2}
        />
        {portfolioXIRR !== null ? (
          <StatCard
            title="XIRR"
            value={Number(portfolioXIRR.toFixed(2))}
            prefix=""
            suffix="%"
            color={portfolioXIRR >= 0 ? "primary" : "danger"}
            delay={0.3}
          />
        ) : (
          <StatCard
            title="Monthly SIPs"
            value={monthlyCommitment}
            icon={Repeat}
            color="accent"
            delay={0.3}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Allocation */}
        {pieData.length > 0 && (
          <ChartCard title="Asset Allocation" subtitle="By asset class">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                  label={({ name, value }) => `${name} ${value}%`}
                >
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* By instrument */}
        <ChartCard title="By Instrument" subtitle="Current value per type">
          <div className="space-y-2">
            {byType.map(([type, value]) => {
              const pct = totals.current > 0 ? (value / totals.current) * 100 : 0;
              return (
                <div key={type} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{type}</span>
                    <span className="text-muted-foreground">
                      {fmt(value)} · {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {byType.length === 0 && (
              <p className="text-sm text-muted-foreground">No holdings yet.</p>
            )}
          </div>
        </ChartCard>
      </div>

      {/* Top movers */}
      {plData.length > 0 && (movers.best.length > 0 || movers.worst.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChartCard title="Top Performers" subtitle="By return %">
            <div className="space-y-2">
              {movers.best.map((m) => (
                <div key={m.name} className="flex items-center justify-between text-sm">
                  <span className="truncate text-foreground">{m.name}</span>
                  <span className="flex items-center gap-1 font-semibold text-emerald-500">
                    <TrendingUp className="w-3.5 h-3.5" /> {m.pl_percentage}%
                  </span>
                </div>
              ))}
            </div>
          </ChartCard>
          <ChartCard title="Needs Attention" subtitle="Lowest return %">
            <div className="space-y-2">
              {movers.worst.map((m) => (
                <div key={m.name} className="flex items-center justify-between text-sm">
                  <span className="truncate text-foreground">{m.name}</span>
                  <span
                    className={`flex items-center gap-1 font-semibold ${
                      m.pl_percentage >= 0 ? "text-emerald-500" : "text-red-500"
                    }`}
                  >
                    {m.pl_percentage >= 0 ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5" />
                    )}
                    {m.pl_percentage}%
                  </span>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      )}

      {/* SIP commitment + upcoming debits */}
      {activeSips.length > 0 && (
        <ChartCard
          title="Active SIPs"
          subtitle={`${activeSips.length} running · ${fmt(monthlyCommitment)}/mo committed`}
        >
          <div className="space-y-2">
            {upcomingSips.map((sip) => (
              <div key={sip.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-foreground">
                  <CalendarClock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="truncate">{sip.fund_name}</span>
                </span>
                <span className="text-muted-foreground">
                  {fmt(sip.amount)} · {sip.next_date}
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {/* Maturing soon */}
      {maturing.length > 0 && (
        <ChartCard title="Maturing Soon" subtitle="Fixed-income instruments">
          <div className="space-y-2">
            {maturing.map(({ inv, days }) => (
              <div key={inv.id} className="flex items-center justify-between text-sm">
                <span className="truncate text-foreground">{inv.name}</span>
                <span className="text-muted-foreground">
                  {inv.maturity_date} · {days === 0 ? "today" : `in ${days}d`}
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {/* Quick links to the CRUD tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { href: "/investments/mutual-funds", label: "Mutual Funds & SIPs", icon: TrendingUp },
          { href: "/investments/gold", label: "Gold", icon: Gem },
          { href: "/investments/other", label: "Other Investments", icon: Landmark },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card p-4 hover:border-brand/50 transition-colors"
            style={{ background: isDark ? "#111827" : undefined }}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <link.icon className="w-4 h-4 text-brand" />
              {link.label}
            </span>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
