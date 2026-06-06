"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { fmt } from "@/utils/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Input, Badge } from "@/components/ui";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip,
} from "recharts";
import {
  Calculator,
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

function calculateRetirement(params: {
  currentAge: number;
  retireAge: number;
  monthlyExpenses: number;
  inflationRate: number;
  returnRate: number;
  currentCorpus: number;
  monthlySIP: number;
}) {
  const { currentAge, retireAge, monthlyExpenses, inflationRate, returnRate, currentCorpus, monthlySIP } = params;
  const yearsToRetire = retireAge - currentAge;
  const yearsInRetirement = 85 - retireAge; // Assume lifespan 85

  if (yearsToRetire <= 0) return null;

  // Future monthly expenses at retirement (adjusted for inflation)
  const futureMonthlyExpenses = monthlyExpenses * Math.pow(1 + inflationRate / 100, yearsToRetire);

  // Corpus needed at retirement (using 4% safe withdrawal adjusted for inflation)
  // Or more accurately: PV of annuity during retirement
  const realReturnInRetirement = (returnRate - inflationRate) / 100;
  const monthlyRealReturn = realReturnInRetirement / 12;

  let corpusNeeded: number;
  if (monthlyRealReturn <= 0) {
    corpusNeeded = futureMonthlyExpenses * 12 * yearsInRetirement;
  } else {
    corpusNeeded = futureMonthlyExpenses * (1 - Math.pow(1 + monthlyRealReturn, -yearsInRetirement * 12)) / monthlyRealReturn;
  }

  // What current corpus + SIPs will grow to
  const monthlyReturn = returnRate / 100 / 12;
  const months = yearsToRetire * 12;

  const corpusGrowth = currentCorpus * Math.pow(1 + monthlyReturn, months);
  const sipGrowth = monthlySIP * ((Math.pow(1 + monthlyReturn, months) - 1) / monthlyReturn);
  const projectedCorpus = corpusGrowth + sipGrowth;

  // Required monthly SIP to reach target
  const gap = corpusNeeded - corpusGrowth;
  const requiredSIP = gap > 0 ? gap * monthlyReturn / (Math.pow(1 + monthlyReturn, months) - 1) : 0;

  // Build year-by-year projection
  const projection: Array<{ year: number; age: number; corpus: number }> = [];
  let running = currentCorpus;
  for (let y = 0; y <= yearsToRetire; y++) {
    projection.push({ year: new Date().getFullYear() + y, age: currentAge + y, corpus: Math.round(running) });
    running = running * (1 + returnRate / 100) + monthlySIP * 12;
  }

  return {
    corpusNeeded: Math.round(corpusNeeded),
    projectedCorpus: Math.round(projectedCorpus),
    gap: Math.round(Math.max(0, corpusNeeded - projectedCorpus)),
    requiredSIP: Math.round(requiredSIP),
    futureMonthlyExpenses: Math.round(futureMonthlyExpenses),
    yearsToRetire,
    yearsInRetirement,
    projection,
  };
}

export default function RetirementPage() {
  const [inputs, setInputs] = useState({
    currentAge: "30",
    retireAge: "55",
    monthlyExpenses: "50000",
    inflationRate: "6",
    currentCorpus: "500000",
    monthlySIP: "20000",
  });

  const [activeScenario, setActiveScenario] = useState(1); // Moderate

  const results = useMemo(() => {
    return SCENARIOS.map((s) =>
      calculateRetirement({
        currentAge: parseInt(inputs.currentAge) || 30,
        retireAge: parseInt(inputs.retireAge) || 55,
        monthlyExpenses: parseFloat(inputs.monthlyExpenses) || 50000,
        inflationRate: parseFloat(inputs.inflationRate) || 6,
        returnRate: s.returnRate,
        currentCorpus: parseFloat(inputs.currentCorpus) || 0,
        monthlySIP: parseFloat(inputs.monthlySIP) || 0,
      })
    );
  }, [inputs]);

  const activeResult = results[activeScenario];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Retirement Calculator</h1>
        <p className="text-sm text-muted-foreground">Plan your financial independence with scenario analysis</p>
      </div>

      {/* Inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-brand" /> Parameters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Current Age</label>
              <Input type="number" value={inputs.currentAge} onChange={(e) => setInputs({ ...inputs, currentAge: e.target.value })} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Retire At</label>
              <Input type="number" value={inputs.retireAge} onChange={(e) => setInputs({ ...inputs, retireAge: e.target.value })} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Monthly Expenses</label>
              <Input type="number" value={inputs.monthlyExpenses} onChange={(e) => setInputs({ ...inputs, monthlyExpenses: e.target.value })} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Inflation (%)</label>
              <Input type="number" value={inputs.inflationRate} onChange={(e) => setInputs({ ...inputs, inflationRate: e.target.value })} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Current Corpus</label>
              <Input type="number" value={inputs.currentCorpus} onChange={(e) => setInputs({ ...inputs, currentCorpus: e.target.value })} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Monthly SIP</label>
              <Input type="number" value={inputs.monthlySIP} onChange={(e) => setInputs({ ...inputs, monthlySIP: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scenario Tabs */}
      <div className="flex gap-2">
        {SCENARIOS.map((s, i) => (
          <button
            key={s.label}
            onClick={() => setActiveScenario(i)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeScenario === i ? "bg-brand text-white shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label} ({s.returnRate}%)
          </button>
        ))}
      </div>

      {/* Results */}
      {activeResult && (
        <motion.div key={activeScenario} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-danger" />
                  <span className="text-[11px] font-medium text-muted-foreground uppercase">Corpus Needed</span>
                </div>
                <p className="text-xl font-bold text-foreground">{fmt(activeResult.corpusNeeded)}</p>
                <p className="text-[11px] text-muted-foreground">For {activeResult.yearsInRetirement} years post-retirement</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-success" />
                  <span className="text-[11px] font-medium text-muted-foreground uppercase">Projected Corpus</span>
                </div>
                <p className="text-xl font-bold text-foreground">{fmt(activeResult.projectedCorpus)}</p>
                <p className="text-[11px] text-muted-foreground">At current SIP + corpus growth</p>
              </CardContent>
            </Card>
            <Card className={activeResult.gap > 0 ? "border-danger/30" : "border-success/30"}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  {activeResult.gap > 0 ? <AlertTriangle className="w-4 h-4 text-danger" /> : <PiggyBank className="w-4 h-4 text-success" />}
                  <span className="text-[11px] font-medium text-muted-foreground uppercase">Gap</span>
                </div>
                <p className={cn("text-xl font-bold", activeResult.gap > 0 ? "text-danger" : "text-success")}>
                  {activeResult.gap > 0 ? fmt(activeResult.gap) : "On Track!"}
                </p>
                {activeResult.gap > 0 && <p className="text-[11px] text-muted-foreground">Shortfall to cover</p>}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-brand" />
                  <span className="text-[11px] font-medium text-muted-foreground uppercase">Required SIP</span>
                </div>
                <p className="text-xl font-bold text-brand">{fmt(activeResult.requiredSIP)}</p>
                <p className="text-[11px] text-muted-foreground">/month to reach target</p>
              </CardContent>
            </Card>
          </div>

          {/* Projection Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Corpus Growth Projection</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full" style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={activeResult.projection}>
                    <defs>
                      <linearGradient id="corpusGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={SCENARIOS[activeScenario].color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={SCENARIOS[activeScenario].color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="age" tick={{ fontSize: 11 }} className="fill-muted-foreground" label={{ value: "Age", position: "bottom", fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => `₹${(v / 10000000).toFixed(1)}Cr`} />
                    <RTooltip
                      formatter={(value) => [fmt(value as number), "Corpus"]}
                      labelFormatter={(label) => `Age ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="corpus"
                      stroke={SCENARIOS[activeScenario].color}
                      fill="url(#corpusGrad)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {/* Target line indicator */}
              <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: SCENARIOS[activeScenario].color }} />
                  Projected Growth
                </span>
                <span>Target: {fmt(activeResult.corpusNeeded)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Future expenses */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <p>Your current ₹{parseInt(inputs.monthlyExpenses).toLocaleString("en-IN")}/month expenses will become <strong className="text-foreground">{fmt(activeResult.futureMonthlyExpenses)}/month</strong> at retirement (adjusted for {inputs.inflationRate}% inflation over {activeResult.yearsToRetire} years).</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* All scenarios comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Scenario Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-xs font-medium text-muted-foreground">Scenario</th>
                      <th className="text-right py-2 text-xs font-medium text-muted-foreground">Returns</th>
                      <th className="text-right py-2 text-xs font-medium text-muted-foreground">Projected</th>
                      <th className="text-right py-2 text-xs font-medium text-muted-foreground">Needed</th>
                      <th className="text-right py-2 text-xs font-medium text-muted-foreground">SIP Required</th>
                      <th className="text-right py-2 text-xs font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SCENARIOS.map((s, i) => {
                      const r = results[i];
                      if (!r) return null;
                      return (
                        <tr key={s.label} className="border-b border-border/50">
                          <td className="py-2.5 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                            <span className="font-medium text-foreground">{s.label}</span>
                          </td>
                          <td className="text-right text-muted-foreground">{s.returnRate}%</td>
                          <td className="text-right font-medium text-foreground">{fmt(r.projectedCorpus)}</td>
                          <td className="text-right text-muted-foreground">{fmt(r.corpusNeeded)}</td>
                          <td className="text-right font-medium text-brand">{fmt(r.requiredSIP)}</td>
                          <td className="text-right">
                            <Badge variant={r.gap === 0 ? "success" : "warning"}>
                              {r.gap === 0 ? "On Track" : "Gap"}
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
        </motion.div>
      )}
    </div>
  );
}
