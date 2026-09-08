"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { fmt, fmtCompact } from "@/utils/format";
import { cn } from "@/lib/utils";
import { Badge, Card, CardContent } from "@/components/ui";
import ChartCard from "@/components/ChartCard";
import CustomTooltip from "@/components/CustomTooltip";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "@/components/charts/lazy";
import {
  CalcField,
  CalculatorShell,
  InputsCard,
  PrefillBanner,
  ResultPanel,
  usePrefill,
} from "@/components/calculators";
import { calculateRetirementPlan } from "@/utils/calculators";
import {
  Wallet,
  TrendingUp,
  Target,
  Calendar,
  PiggyBank,
  AlertTriangle,
} from "lucide-react";

interface Scenario {
  label: string;
  returnRate: number;
  color: string;
}

const SCENARIOS: Scenario[] = [
  { label: "Conservative", returnRate: 8, color: "#64748b" },
  { label: "Moderate", returnRate: 12, color: "#0080ff" },
  { label: "Optimistic", returnRate: 15, color: "#10b981" },
];

export default function RetirementCalculatorPage() {
  const [inputs, setInputs] = useState({
    currentAge: "30",
    retireAge: "55",
    monthlyExpenses: "50000",
    inflationRate: "6",
    currentCorpus: "500000",
    monthlySIP: "20000",
  });
  const [activeScenario, setActiveScenario] = useState(1); // Moderate
  const prefill = usePrefill();

  const set = (key: keyof typeof inputs) => (value: string) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const results = useMemo(
    () =>
      SCENARIOS.map((s) =>
        calculateRetirementPlan({
          currentAge: parseInt(inputs.currentAge) || 30,
          retireAge: parseInt(inputs.retireAge) || 55,
          monthlyExpenses: parseFloat(inputs.monthlyExpenses) || 0,
          inflationRate: parseFloat(inputs.inflationRate) || 0,
          returnRate: s.returnRate,
          currentCorpus: parseFloat(inputs.currentCorpus) || 0,
          monthlySIP: parseFloat(inputs.monthlySIP) || 0,
        })
      ),
    [inputs]
  );

  const activeResult = results[activeScenario];
  const scenario = SCENARIOS[activeScenario];

  return (
    <CalculatorShell
      title="Retirement Calculator"
      description="Plan your financial independence with scenario analysis"
      icon={Wallet}
    >
      <PrefillBanner
        label="Your average monthly spend is"
        value={prefill.monthlyExpenses}
        onApply={() =>
          setInputs((prev) => ({
            ...prev,
            monthlyExpenses: String(Math.round(prefill.monthlyExpenses)),
          }))
        }
      />

      <InputsCard>
        <CalcField
          label="Current Age"
          value={inputs.currentAge}
          onChange={set("currentAge")}
          min={18}
          max={70}
          slider
        />
        <CalcField
          label="Retire At"
          value={inputs.retireAge}
          onChange={set("retireAge")}
          min={30}
          max={80}
          slider
        />
        <CalcField
          label="Monthly Expenses"
          value={inputs.monthlyExpenses}
          onChange={set("monthlyExpenses")}
          unit="₹"
          min={0}
        />
        <CalcField
          label="Inflation"
          value={inputs.inflationRate}
          onChange={set("inflationRate")}
          unit="%"
          min={0}
          max={15}
          step={0.5}
          slider
        />
        <CalcField
          label="Current Corpus"
          value={inputs.currentCorpus}
          onChange={set("currentCorpus")}
          unit="₹"
          min={0}
        />
        <CalcField
          label="Monthly SIP"
          value={inputs.monthlySIP}
          onChange={set("monthlySIP")}
          unit="₹"
          min={0}
        />
      </InputsCard>

      <div className="flex flex-wrap gap-2">
        {SCENARIOS.map((s, i) => (
          <button
            key={s.label}
            type="button"
            aria-pressed={activeScenario === i}
            onClick={() => setActiveScenario(i)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeScenario === i
                ? "bg-brand text-white shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.label} ({s.returnRate}%)
          </button>
        ))}
      </div>

      {!activeResult ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Set a retirement age above your current age to see a projection.
          </CardContent>
        </Card>
      ) : (
        <motion.div
          key={activeScenario}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <ResultPanel
            headlineLabel="Corpus needed at retirement"
            headline={fmt(activeResult.corpusNeeded)}
            headlineHint={`To fund ${activeResult.yearsInRetirement} years of retirement at ${scenario.returnRate}% returns`}
            stats={[
              {
                label: "Projected Corpus",
                value: fmt(activeResult.projectedCorpus),
                hint: "From current corpus + SIP",
                tone: "success",
                icon: TrendingUp,
              },
              {
                label: "Gap",
                value: activeResult.gap > 0 ? fmt(activeResult.gap) : "On track!",
                hint: activeResult.gap > 0 ? "Shortfall to cover" : undefined,
                tone: activeResult.gap > 0 ? "danger" : "success",
                icon: activeResult.gap > 0 ? AlertTriangle : PiggyBank,
              },
              {
                label: "Required SIP",
                value: fmt(activeResult.requiredSIP),
                hint: "/month to reach target",
                tone: "brand",
                icon: Calendar,
              },
              {
                label: "Expenses at Retirement",
                value: fmt(activeResult.futureMonthlyExpenses),
                hint: `Today's ${fmt(parseFloat(inputs.monthlyExpenses) || 0)}/month`,
                tone: "warning",
                icon: Target,
              },
            ]}
            note={
              <>
                Corpus needed is the present value at retirement of an
                inflation-adjusted monthly expense annuity, discounted at the real
                (post-inflation) return. A life expectancy of 85 is assumed and
                returns are treated as constant — real markets vary year to year.
              </>
            }
          >
            <ChartCard
              title="Corpus Growth Projection"
              subtitle={`${scenario.label} scenario — ${scenario.returnRate}% annual returns`}
            >
              <div className="w-full" style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart
                    data={activeResult.projection}
                    margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="corpusGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={scenario.color} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={scenario.color} stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="age"
                      tick={{ fontSize: 11 }}
                      className="fill-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      width={64}
                      className="fill-muted-foreground"
                      tickFormatter={(v: number) => fmtCompact(v)}
                    />
                    <RTooltip
                      content={<CustomTooltip />}
                      labelFormatter={(label: React.ReactNode) => `Age ${label}`}
                    />
                    <ReferenceLine
                      y={activeResult.corpusNeeded}
                      stroke="#ef4444"
                      strokeDasharray="4 4"
                      label={{
                        value: "Target",
                        position: "insideTopRight",
                        fontSize: 11,
                        fill: "#ef4444",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="corpus"
                      name="Corpus"
                      stroke={scenario.color}
                      fill="url(#corpusGrad)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Scenario Comparison
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th scope="col" className="text-left py-2 text-xs font-medium text-muted-foreground">
                          Scenario
                        </th>
                        <th scope="col" className="text-right py-2 text-xs font-medium text-muted-foreground">
                          Returns
                        </th>
                        <th scope="col" className="text-right py-2 text-xs font-medium text-muted-foreground">
                          Projected
                        </th>
                        <th scope="col" className="text-right py-2 text-xs font-medium text-muted-foreground">
                          Needed
                        </th>
                        <th scope="col" className="text-right py-2 text-xs font-medium text-muted-foreground">
                          SIP Required
                        </th>
                        <th scope="col" className="text-right py-2 text-xs font-medium text-muted-foreground">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {SCENARIOS.map((s, i) => {
                        const row = results[i];
                        if (!row) return null;
                        return (
                          <tr key={s.label} className="border-b border-border/50">
                            <td className="py-2.5 flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: s.color }}
                              />
                              <span className="font-medium text-foreground">{s.label}</span>
                            </td>
                            <td className="text-right text-muted-foreground">
                              {s.returnRate}%
                            </td>
                            <td className="text-right font-medium text-foreground">
                              {fmt(row.projectedCorpus)}
                            </td>
                            <td className="text-right text-muted-foreground">
                              {fmt(row.corpusNeeded)}
                            </td>
                            <td className="text-right font-medium text-brand">
                              {fmt(row.requiredSIP)}
                            </td>
                            <td className="text-right">
                              <Badge variant={row.gap === 0 ? "success" : "warning"}>
                                {row.gap === 0 ? "On Track" : "Gap"}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </ResultPanel>
        </motion.div>
      )}
    </CalculatorShell>
  );
}
