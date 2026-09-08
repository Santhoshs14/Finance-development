"use client";

import { useMemo, useState } from "react";
import { Landmark, TrendingUp, Wallet, Percent } from "lucide-react";
import {
  BreakdownTable,
  CalcField,
  CalcSegmented,
  CalculatorShell,
  GrowthChart,
  InputsCard,
  ResultPanel,
} from "@/components/calculators";
import { calculateFd } from "@/utils/calculators";
import { fmt } from "@/utils/format";

type Compounding = "simple" | "monthly" | "quarterly" | "halfyearly" | "annually";

const COMPOUNDING_OPTIONS: { value: Compounding; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "halfyearly", label: "Half-yearly" },
  { value: "annually", label: "Yearly" },
  { value: "simple", label: "Simple" },
];

export default function FdCalculatorPage() {
  const [inputs, setInputs] = useState({
    principal: "500000",
    annualRatePct: "7",
    years: "5",
  });
  const [compounding, setCompounding] = useState<Compounding>("quarterly");

  const set = (key: keyof typeof inputs) => (value: string) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const result = useMemo(
    () =>
      calculateFd({
        principal: parseFloat(inputs.principal) || 0,
        annualRatePct: parseFloat(inputs.annualRatePct) || 0,
        years: parseFloat(inputs.years) || 0,
        compounding,
      }),
    [inputs, compounding]
  );

  return (
    <CalculatorShell
      title="FD Calculator"
      description="Fixed deposit maturity value and interest at any compounding frequency"
      icon={Landmark}
    >
      <InputsCard>
        <CalcField
          label="Deposit Amount"
          value={inputs.principal}
          onChange={set("principal")}
          unit="₹"
          min={1000}
          max={50000000}
          step={10000}
          slider
        />
        <CalcField
          label="Interest Rate"
          value={inputs.annualRatePct}
          onChange={set("annualRatePct")}
          unit="% p.a."
          min={0}
          max={15}
          step={0.05}
          slider
        />
        <CalcField
          label="Tenure"
          value={inputs.years}
          onChange={set("years")}
          unit="years"
          min={0.5}
          max={20}
          step={0.5}
          slider
        />
        <CalcSegmented
          label="Compounding"
          value={compounding}
          options={COMPOUNDING_OPTIONS}
          onChange={setCompounding}
          className="sm:col-span-2 lg:col-span-3"
        />
      </InputsCard>

      <ResultPanel
        headlineLabel="Maturity amount"
        headline={fmt(result.maturityValue)}
        headlineHint={`After ${inputs.years} years at ${inputs.annualRatePct}% compounded ${compounding === "simple" ? "simply" : compounding}`}
        stats={[
          {
            label: "Principal",
            value: fmt(result.invested),
            hint: "Amount deposited",
            icon: Wallet,
          },
          {
            label: "Interest Earned",
            value: fmt(result.interestEarned),
            hint: "Total interest",
            tone: "success",
            icon: TrendingUp,
          },
          {
            label: "Effective Growth",
            value:
              result.invested > 0
                ? `${((result.interestEarned / result.invested) * 100).toFixed(2)}%`
                : "—",
            hint: "Over the full tenure",
            tone: "brand",
            icon: Percent,
          },
          {
            label: "Monthly Interest",
            value: fmt(
              (parseFloat(inputs.principal) || 0) *
                ((parseFloat(inputs.annualRatePct) || 0) / 100 / 12)
            ),
            hint: "If paid out instead",
            tone: "warning",
            icon: Landmark,
          },
        ]}
        note={
          <>
            Most Indian banks compound FD interest quarterly. Interest is fully
            taxable at your slab rate and banks deduct TDS above ₹40,000 of
            interest in a year (₹50,000 for senior citizens) — the figures here are
            pre-tax.
          </>
        }
      >
        <GrowthChart
          title="Deposit Growth"
          subtitle="Principal and accumulated interest by year"
          data={result.schedule}
          xKey="year"
          series={[
            { key: "invested", name: "Principal", color: "#0080ff" },
            { key: "returns", name: "Interest", color: "#10b981" },
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
              header: "Interest",
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
