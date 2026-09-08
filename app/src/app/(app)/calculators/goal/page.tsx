"use client";

import { useMemo, useState } from "react";
import { Target, TrendingUp, Wallet, Coins, CheckCircle2 } from "lucide-react";
import {
  BreakdownTable,
  CalcField,
  CalculatorShell,
  GrowthChart,
  InputsCard,
  ResultPanel,
} from "@/components/calculators";
import { calculateGoal } from "@/utils/calculators";
import { fmt } from "@/utils/format";

export default function GoalCalculatorPage() {
  const [inputs, setInputs] = useState({
    targetAmount: "5000000",
    years: "10",
    annualRatePct: "12",
    currentSavings: "500000",
    inflationPct: "6",
  });

  const set = (key: keyof typeof inputs) => (value: string) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const result = useMemo(
    () =>
      calculateGoal({
        targetAmount: parseFloat(inputs.targetAmount) || 0,
        years: parseInt(inputs.years) || 0,
        annualRatePct: parseFloat(inputs.annualRatePct) || 0,
        currentSavings: parseFloat(inputs.currentSavings) || 0,
        inflationPct: parseFloat(inputs.inflationPct) || 0,
      }),
    [inputs]
  );

  return (
    <CalculatorShell
      title="Goal Planner"
      description="Work out the monthly SIP or lump sum needed to hit a financial goal"
      icon={Target}
    >
      <InputsCard>
        <CalcField
          label="Goal Amount (today's cost)"
          value={inputs.targetAmount}
          onChange={set("targetAmount")}
          unit="₹"
          min={10000}
          max={100000000}
          step={50000}
          slider
        />
        <CalcField
          label="Years to Goal"
          value={inputs.years}
          onChange={set("years")}
          unit="years"
          min={1}
          max={40}
          slider
        />
        <CalcField
          label="Expected Return"
          value={inputs.annualRatePct}
          onChange={set("annualRatePct")}
          unit="% p.a."
          min={1}
          max={25}
          step={0.5}
          slider
        />
        <CalcField
          label="Current Savings"
          value={inputs.currentSavings}
          onChange={set("currentSavings")}
          unit="₹"
          min={0}
          max={100000000}
          step={50000}
          slider
        />
        <CalcField
          label="Inflation"
          value={inputs.inflationPct}
          onChange={set("inflationPct")}
          unit="%"
          min={0}
          max={15}
          step={0.5}
          slider
          hint="Inflates the goal to its future cost"
        />
      </InputsCard>

      <ResultPanel
        headlineLabel={result.onTrack ? "You're on track" : "Monthly SIP required"}
        headline={
          result.onTrack ? "No extra saving needed" : fmt(result.requiredMonthlySip)
        }
        headlineHint={
          result.onTrack
            ? `Your existing savings alone grow to ${fmt(result.futureValueOfSavings)}`
            : `To reach ${fmt(result.inflatedTarget)} in ${inputs.years} years`
        }
        stats={[
          {
            label: "Future Goal Cost",
            value: fmt(result.inflatedTarget),
            hint: `${inputs.inflationPct}% inflation applied`,
            tone: "warning",
            icon: Target,
          },
          {
            label: "Savings Will Grow To",
            value: fmt(result.futureValueOfSavings),
            hint: "From your current corpus",
            tone: "success",
            icon: TrendingUp,
          },
          {
            label: "Shortfall",
            value: result.shortfall > 0 ? fmt(result.shortfall) : "None",
            hint: result.shortfall > 0 ? "Left to fund" : "Goal already covered",
            tone: result.shortfall > 0 ? "danger" : "success",
            icon: result.shortfall > 0 ? Wallet : CheckCircle2,
          },
          {
            label: "Or Invest Today",
            value: result.requiredLumpsum > 0 ? fmt(result.requiredLumpsum) : "—",
            hint: "One-time alternative to the SIP",
            tone: "brand",
            icon: Coins,
          },
        ]}
        note={
          <>
            The goal is first inflated to its future cost, then your existing
            savings are grown at the expected return. Whatever remains is the
            shortfall, funded either by a monthly SIP invested at the start of each
            month or by a single lump sum invested today.
          </>
        }
      >
        <GrowthChart
          title="Path to Your Goal"
          subtitle="Projected corpus from savings plus the required SIP"
          data={result.schedule}
          xKey="year"
          stacked={false}
          series={[{ key: "value", name: "Projected Corpus", color: "#0080ff" }]}
        />

        <BreakdownTable
          title="Year-wise Breakdown"
          rows={result.schedule.slice(1)}
          rowKey={(row) => row.year}
          columns={[
            { key: "year", header: "Year", render: (row) => row.year },
            {
              key: "invested",
              header: "Invested",
              align: "right",
              render: (row) => fmt(row.invested),
            },
            {
              key: "value",
              header: "Projected Corpus",
              align: "right",
              render: (row) => fmt(row.value),
            },
          ]}
        />
      </ResultPanel>
    </CalculatorShell>
  );
}
