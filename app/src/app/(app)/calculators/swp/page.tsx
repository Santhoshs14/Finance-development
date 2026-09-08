"use client";

import { useMemo, useState } from "react";
import { Banknote, TrendingUp, Wallet, AlertTriangle, CalendarClock } from "lucide-react";
import {
  BreakdownTable,
  CalcField,
  CalculatorShell,
  GrowthChart,
  InputsCard,
  ResultPanel,
} from "@/components/calculators";
import { calculateSwp } from "@/utils/calculators";
import { fmt } from "@/utils/format";

export default function SwpCalculatorPage() {
  const [inputs, setInputs] = useState({
    corpus: "5000000",
    monthlyWithdrawal: "30000",
    annualRatePct: "9",
    years: "20",
    withdrawalStepUpPct: "0",
  });

  const set = (key: keyof typeof inputs) => (value: string) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const result = useMemo(
    () =>
      calculateSwp({
        corpus: parseFloat(inputs.corpus) || 0,
        monthlyWithdrawal: parseFloat(inputs.monthlyWithdrawal) || 0,
        annualRatePct: parseFloat(inputs.annualRatePct) || 0,
        years: parseInt(inputs.years) || 0,
        withdrawalStepUpPct: parseFloat(inputs.withdrawalStepUpPct) || 0,
      }),
    [inputs]
  );

  const exhausted = result.corpusExhaustedMonth !== null;
  const lastsFor = exhausted
    ? `${Math.floor(result.corpusExhaustedMonth! / 12)}y ${result.corpusExhaustedMonth! % 12}m`
    : `Beyond ${inputs.years} years`;

  return (
    <CalculatorShell
      title="SWP Calculator"
      description="See how long a corpus lasts against a regular monthly withdrawal"
      icon={Banknote}
    >
      <InputsCard>
        <CalcField
          label="Total Corpus"
          value={inputs.corpus}
          onChange={set("corpus")}
          unit="₹"
          min={10000}
          max={200000000}
          step={50000}
          slider
        />
        <CalcField
          label="Monthly Withdrawal"
          value={inputs.monthlyWithdrawal}
          onChange={set("monthlyWithdrawal")}
          unit="₹"
          min={1000}
          max={1000000}
          step={1000}
          slider
        />
        <CalcField
          label="Expected Return"
          value={inputs.annualRatePct}
          onChange={set("annualRatePct")}
          unit="% p.a."
          min={0}
          max={20}
          step={0.5}
          slider
        />
        <CalcField
          label="Withdrawal Period"
          value={inputs.years}
          onChange={set("years")}
          unit="years"
          min={1}
          max={50}
          slider
        />
        <CalcField
          label="Annual Withdrawal Increase"
          value={inputs.withdrawalStepUpPct}
          onChange={set("withdrawalStepUpPct")}
          unit="%"
          min={0}
          max={15}
          step={0.5}
          slider
          hint="Raise withdrawals yearly to keep pace with inflation"
        />
      </InputsCard>

      <ResultPanel
        headlineLabel={exhausted ? "Your corpus runs out in" : "Corpus remaining at the end"}
        headline={exhausted ? lastsFor : fmt(result.remainingCorpus)}
        headlineHint={
          exhausted
            ? `Withdrawing ${fmt(parseFloat(inputs.monthlyWithdrawal) || 0)}/month depletes the corpus before ${inputs.years} years`
            : `After ${inputs.years} years of withdrawals at ${inputs.annualRatePct}% returns`
        }
        stats={[
          {
            label: "Total Withdrawn",
            value: fmt(result.totalWithdrawn),
            hint: "Sum of all withdrawals",
            icon: Wallet,
          },
          {
            label: "Growth Earned",
            value: fmt(result.totalGrowth),
            hint: "Returns while invested",
            tone: "success",
            icon: TrendingUp,
          },
          {
            label: "Corpus Lasts",
            value: lastsFor,
            hint: exhausted ? "Then fully depleted" : "Still funded",
            tone: exhausted ? "danger" : "success",
            icon: exhausted ? AlertTriangle : CalendarClock,
          },
          {
            label: "Remaining",
            value: fmt(result.remainingCorpus),
            hint: "Balance at the end",
            tone: result.remainingCorpus > 0 ? "brand" : "danger",
            icon: Banknote,
          },
        ]}
        note={
          <>
            Withdrawals are taken at the end of each month, after that
            month&apos;s growth. Sustained withdrawals above your return rate will
            always deplete the corpus — raise returns, cut the withdrawal, or
            start with a larger corpus to extend it.
          </>
        }
      >
        <GrowthChart
          title="Corpus Drawdown"
          subtitle="Remaining balance year by year"
          data={result.schedule}
          xKey="year"
          stacked={false}
          series={[{ key: "balance", name: "Balance", color: "#0080ff" }]}
        />

        <BreakdownTable
          title="Year-wise Breakdown"
          rows={result.schedule.slice(1)}
          rowKey={(row) => row.year}
          columns={[
            { key: "year", header: "Year", render: (row) => row.year },
            {
              key: "withdrawn",
              header: "Withdrawn",
              align: "right",
              render: (row) => fmt(row.withdrawn),
            },
            {
              key: "balance",
              header: "Balance",
              align: "right",
              render: (row) => fmt(row.balance),
            },
          ]}
        />
      </ResultPanel>
    </CalculatorShell>
  );
}
