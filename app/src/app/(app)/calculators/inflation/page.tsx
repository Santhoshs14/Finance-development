"use client";

import { useMemo, useState } from "react";
import { Flame, TrendingDown, Wallet, Percent } from "lucide-react";
import {
  BreakdownTable,
  CalcField,
  CalculatorShell,
  GrowthChart,
  InputsCard,
  PrefillBanner,
  ResultPanel,
  usePrefill,
} from "@/components/calculators";
import { calculateInflationImpact } from "@/utils/calculators";
import { fmt } from "@/utils/format";

export default function InflationCalculatorPage() {
  const [inputs, setInputs] = useState({
    currentCost: "100000",
    inflationPct: "6",
    years: "10",
  });
  const { monthlyExpenses } = usePrefill();

  const set = (key: keyof typeof inputs) => (value: string) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const result = useMemo(
    () =>
      calculateInflationImpact({
        currentCost: parseFloat(inputs.currentCost) || 0,
        inflationPct: parseFloat(inputs.inflationPct) || 0,
        years: parseInt(inputs.years) || 0,
      }),
    [inputs]
  );

  return (
    <CalculatorShell
      title="Inflation Calculator"
      description="What today's money will cost, and be worth, years from now"
      icon={Flame}
    >
      <PrefillBanner
        label="Your average monthly spend is"
        value={monthlyExpenses}
        onApply={() =>
          setInputs((prev) => ({
            ...prev,
            currentCost: String(Math.round(monthlyExpenses)),
          }))
        }
      />

      <InputsCard>
        <CalcField
          label="Current Cost"
          value={inputs.currentCost}
          onChange={set("currentCost")}
          unit="₹"
          min={100}
          max={100000000}
          step={1000}
          slider
        />
        <CalcField
          label="Inflation Rate"
          value={inputs.inflationPct}
          onChange={set("inflationPct")}
          unit="% p.a."
          min={0}
          max={20}
          step={0.25}
          slider
          hint="India's long-run CPI has averaged about 6%"
        />
        <CalcField
          label="Time Period"
          value={inputs.years}
          onChange={set("years")}
          unit="years"
          min={1}
          max={50}
          slider
        />
      </InputsCard>

      <ResultPanel
        headlineLabel={`Cost in ${inputs.years} years`}
        headline={fmt(result.futureCost)}
        headlineHint={`What ${fmt(parseFloat(inputs.currentCost) || 0)} of goods will cost at ${inputs.inflationPct}% inflation`}
        stats={[
          {
            label: "Cost Today",
            value: fmt(parseFloat(inputs.currentCost) || 0),
            hint: "Current price",
            icon: Wallet,
          },
          {
            label: "Increase",
            value: fmt(result.increase),
            hint: "Extra rupees needed",
            tone: "danger",
            icon: Flame,
          },
          {
            label: "Future Purchasing Power",
            value: fmt(result.purchasingPower),
            hint: `What ${fmt(parseFloat(inputs.currentCost) || 0)} buys then`,
            tone: "warning",
            icon: TrendingDown,
          },
          {
            label: "Value Lost",
            value: `${result.purchasingPowerLossPct}%`,
            hint: "Erosion in real terms",
            tone: "brand",
            icon: Percent,
          },
        ]}
        note={
          <>
            Inflation cuts both ways: the same basket costs more, and idle cash buys
            less. This is why money parked in a savings account at 3% loses real
            value against 6% inflation — your investments need to beat the inflation
            rate just to stand still.
          </>
        }
      >
        <GrowthChart
          title="Cost vs Purchasing Power"
          subtitle="Rising prices against the shrinking value of today's money"
          data={result.schedule}
          xKey="year"
          stacked={false}
          series={[
            { key: "futureCost", name: "Future Cost", color: "#ef4444" },
            { key: "purchasingPower", name: "Purchasing Power", color: "#0080ff" },
          ]}
        />

        <BreakdownTable
          title="Year-wise Breakdown"
          rows={result.schedule.slice(1)}
          rowKey={(row) => row.year}
          columns={[
            { key: "year", header: "Year", render: (row) => row.year },
            {
              key: "futureCost",
              header: "Cost",
              align: "right",
              render: (row) => fmt(row.futureCost),
            },
            {
              key: "purchasingPower",
              header: "Purchasing Power",
              align: "right",
              render: (row) => fmt(row.purchasingPower),
            },
          ]}
        />
      </ResultPanel>
    </CalculatorShell>
  );
}
