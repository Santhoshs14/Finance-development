"use client";

import { useMemo, useState } from "react";
import { Shield, TrendingUp, Wallet, Banknote } from "lucide-react";
import {
  BreakdownTable,
  CalcField,
  CalculatorShell,
  GrowthChart,
  InputsCard,
  ResultPanel,
  SplitDonut,
} from "@/components/calculators";
import { calculateNps, NPS_MIN_ANNUITY_PCT } from "@/utils/calculators";
import { fmt } from "@/utils/format";

export default function NpsCalculatorPage() {
  const [inputs, setInputs] = useState({
    currentAge: "30",
    retireAge: "60",
    monthlyContribution: "10000",
    annualRatePct: "10",
    annuityPortionPct: "40",
    annuityRatePct: "6",
  });

  const set = (key: keyof typeof inputs) => (value: string) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const result = useMemo(
    () =>
      calculateNps({
        currentAge: parseInt(inputs.currentAge) || 0,
        retireAge: parseInt(inputs.retireAge) || 0,
        monthlyContribution: parseFloat(inputs.monthlyContribution) || 0,
        annualRatePct: parseFloat(inputs.annualRatePct) || 0,
        annuityPortionPct: parseFloat(inputs.annuityPortionPct) || 0,
        annuityRatePct: parseFloat(inputs.annuityRatePct) || 0,
      }),
    [inputs]
  );

  return (
    <CalculatorShell
      title="NPS Calculator"
      description="Retirement corpus, lump sum withdrawal and monthly pension"
      icon={Shield}
    >
      <InputsCard>
        <CalcField
          label="Current Age"
          value={inputs.currentAge}
          onChange={set("currentAge")}
          min={18}
          max={65}
          slider
        />
        <CalcField
          label="Retirement Age"
          value={inputs.retireAge}
          onChange={set("retireAge")}
          min={60}
          max={75}
          slider
        />
        <CalcField
          label="Monthly Contribution"
          value={inputs.monthlyContribution}
          onChange={set("monthlyContribution")}
          unit="₹"
          min={500}
          max={500000}
          step={500}
          slider
        />
        <CalcField
          label="Expected Return"
          value={inputs.annualRatePct}
          onChange={set("annualRatePct")}
          unit="% p.a."
          min={4}
          max={15}
          step={0.5}
          slider
        />
        <CalcField
          label="Annuity Portion"
          value={inputs.annuityPortionPct}
          onChange={set("annuityPortionPct")}
          unit="%"
          min={NPS_MIN_ANNUITY_PCT}
          max={100}
          step={5}
          slider
          hint={`At least ${NPS_MIN_ANNUITY_PCT}% must buy an annuity`}
        />
        <CalcField
          label="Annuity Rate"
          value={inputs.annuityRatePct}
          onChange={set("annuityRatePct")}
          unit="% p.a."
          min={3}
          max={12}
          step={0.25}
          slider
          hint="Rate offered by the annuity provider"
        />
      </InputsCard>

      <ResultPanel
        headlineLabel="Corpus at retirement"
        headline={fmt(result.corpusAtRetirement)}
        headlineHint={`After ${result.yearsToRetirement} years of contributions at ${inputs.annualRatePct}% returns`}
        stats={[
          {
            label: "Total Invested",
            value: fmt(result.totalInvested),
            hint: "Your contributions",
            icon: Wallet,
          },
          {
            label: "Returns Earned",
            value: fmt(result.totalReturns),
            hint: "Market growth",
            tone: "success",
            icon: TrendingUp,
          },
          {
            label: "Lump Sum",
            value: fmt(result.lumpSumWithdrawal),
            hint: "Tax-free withdrawal at 60",
            tone: "brand",
            icon: Banknote,
          },
          {
            label: "Monthly Pension",
            value: fmt(result.monthlyPension),
            hint: `From a ${fmt(result.annuityCorpus)} annuity`,
            tone: "warning",
            icon: Shield,
          },
        ]}
        note={
          <>
            At least {NPS_MIN_ANNUITY_PCT}% of the corpus must be used to buy an
            annuity; the balance can be withdrawn tax-free. Pension income from the
            annuity is taxable at your slab rate. Contributions qualify for an
            additional ₹50,000 deduction under Section 80CCD(1B), over and above
            the ₹1.5 lakh 80C limit.
          </>
        }
      >
        <SplitDonut
          title="Corpus Split at Retirement"
          subtitle="Annuity purchase vs lump sum withdrawal"
          slices={[
            { name: "Annuity", value: result.annuityCorpus, color: "#0080ff" },
            { name: "Lump Sum", value: result.lumpSumWithdrawal, color: "#10b981" },
          ]}
        />

        <GrowthChart
          title="Contribution Growth"
          subtitle="Invested amount and returns by year"
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
              header: "Corpus",
              align: "right",
              render: (row) => fmt(row.value),
            },
          ]}
        />
      </ResultPanel>
    </CalculatorShell>
  );
}
