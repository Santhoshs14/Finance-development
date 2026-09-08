"use client";

import { useMemo, useState } from "react";
import { TrendingUp, Coins, Wallet, Percent } from "lucide-react";
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
import { calculateSip } from "@/utils/calculators";
import { fmt } from "@/utils/format";

export default function SipCalculatorPage() {
  const [inputs, setInputs] = useState({
    monthlyAmount: "10000",
    annualRatePct: "12",
    years: "10",
    stepUpPct: "0",
  });
  const { monthlyIncome, monthlyExpenses } = usePrefill();
  const surplus = Math.max(0, monthlyIncome - monthlyExpenses);

  const set = (key: keyof typeof inputs) => (value: string) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const result = useMemo(
    () =>
      calculateSip({
        monthlyAmount: parseFloat(inputs.monthlyAmount) || 0,
        annualRatePct: parseFloat(inputs.annualRatePct) || 0,
        years: parseInt(inputs.years) || 0,
        stepUpPct: parseFloat(inputs.stepUpPct) || 0,
      }),
    [inputs]
  );

  return (
    <CalculatorShell
      title="SIP Calculator"
      description="Project the maturity value of a monthly systematic investment plan"
      icon={TrendingUp}
    >
      <PrefillBanner
        label="Your monthly surplus is"
        value={surplus}
        onApply={() =>
          setInputs((prev) => ({ ...prev, monthlyAmount: String(Math.round(surplus)) }))
        }
      />

      <InputsCard>
        <CalcField
          label="Monthly Investment"
          value={inputs.monthlyAmount}
          onChange={set("monthlyAmount")}
          unit="₹"
          min={100}
          max={1000000}
          step={500}
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
        <CalcField
          label="Annual Step-up"
          value={inputs.stepUpPct}
          onChange={set("stepUpPct")}
          unit="%"
          min={0}
          max={25}
          step={1}
          slider
          hint="Increase your SIP each year as income grows"
        />
      </InputsCard>

      <ResultPanel
        headlineLabel="Maturity value"
        headline={fmt(result.maturityValue)}
        headlineHint={`After ${inputs.years} years at ${inputs.annualRatePct}% expected returns`}
        stats={[
          {
            label: "Invested",
            value: fmt(result.totalInvested),
            hint: "Total of all instalments",
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
            label: "Final Instalment",
            value: fmt(
              (parseFloat(inputs.monthlyAmount) || 0) *
                Math.pow(1 + (parseFloat(inputs.stepUpPct) || 0) / 100,
                  Math.max(0, (parseInt(inputs.years) || 1) - 1))
            ),
            hint: "Monthly amount in the final year",
            tone: "warning",
            icon: Coins,
          },
        ]}
        note={
          <>
            Instalments are assumed to be invested at the start of each month and
            to compound monthly at the expected rate. Actual mutual fund returns
            are not linear — this projection is an illustration, not a guarantee.
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
              key: "invested",
              header: "Invested",
              align: "right",
              render: (row) => fmt(row.invested),
            },
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
