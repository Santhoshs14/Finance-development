"use client";

import { useMemo, useState } from "react";
import { Coins, TrendingUp, Wallet, Percent } from "lucide-react";
import {
  BreakdownTable,
  CalcField,
  CalculatorShell,
  GrowthChart,
  InputsCard,
  ResultPanel,
} from "@/components/calculators";
import { calculateLumpsum } from "@/utils/calculators";
import { fmt } from "@/utils/format";

export default function LumpsumCalculatorPage() {
  const [inputs, setInputs] = useState({
    principal: "500000",
    annualRatePct: "12",
    years: "10",
  });

  const set = (key: keyof typeof inputs) => (value: string) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const result = useMemo(
    () =>
      calculateLumpsum({
        principal: parseFloat(inputs.principal) || 0,
        annualRatePct: parseFloat(inputs.annualRatePct) || 0,
        years: parseInt(inputs.years) || 0,
      }),
    [inputs]
  );

  return (
    <CalculatorShell
      title="Lumpsum Calculator"
      description="Future value and returns on a one-time investment"
      icon={Coins}
    >
      <InputsCard>
        <CalcField
          label="Investment Amount"
          value={inputs.principal}
          onChange={set("principal")}
          unit="₹"
          min={1000}
          max={100000000}
          step={10000}
          slider
        />
        <CalcField
          label="Expected Return"
          value={inputs.annualRatePct}
          onChange={set("annualRatePct")}
          unit="% p.a."
          min={1}
          max={30}
          step={0.5}
          slider
        />
        <CalcField
          label="Investment Period"
          value={inputs.years}
          onChange={set("years")}
          unit="years"
          min={1}
          max={40}
          slider
        />
      </InputsCard>

      <ResultPanel
        headlineLabel="Maturity value"
        headline={fmt(result.maturityValue)}
        headlineHint={`After ${inputs.years} years at ${inputs.annualRatePct}% compounded annually`}
        stats={[
          {
            label: "Invested",
            value: fmt(result.totalInvested),
            hint: "One-time amount",
            icon: Wallet,
          },
          {
            label: "Est. Returns",
            value: fmt(result.totalReturns),
            hint: "Wealth gained",
            tone: "success",
            icon: TrendingUp,
          },
          {
            label: "Absolute Return",
            value: `${result.absoluteReturnPct}%`,
            hint: "Gain over invested amount",
            tone: "brand",
            icon: Percent,
          },
          {
            label: "Wealth Multiple",
            value:
              result.totalInvested > 0
                ? `${(result.maturityValue / result.totalInvested).toFixed(2)}x`
                : "—",
            hint: "Times your money grows",
            tone: "warning",
            icon: Coins,
          },
        ]}
        note={
          <>
            Growth compounds annually at the expected rate. Equity returns are
            volatile year to year, so treat this as a long-run illustration rather
            than a prediction of any single year&apos;s outcome.
          </>
        }
      >
        <GrowthChart
          title="Invested vs Returns"
          subtitle="Year-wise growth of your corpus"
          data={result.schedule}
          xKey="year"
          series={[
            { key: "invested", name: "Invested", color: "#0080ff" },
            { key: "returns", name: "Returns", color: "#10b981" },
          ]}
        />

        <BreakdownTable
          title="Year-wise Breakdown"
          rows={result.schedule.slice(1)}
          rowKey={(row) => row.year}
          columns={[
            { key: "year", header: "Year", render: (row) => row.year },
            {
              key: "returns",
              header: "Returns",
              align: "right",
              render: (row) => fmt(row.returns),
            },
            {
              key: "value",
              header: "Value",
              align: "right",
              render: (row) => fmt(row.value),
            },
          ]}
        />
      </ResultPanel>
    </CalculatorShell>
  );
}
