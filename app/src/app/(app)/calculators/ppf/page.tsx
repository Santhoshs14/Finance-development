"use client";

import { useMemo, useState } from "react";
import { PiggyBank, TrendingUp, Wallet, ShieldCheck } from "lucide-react";
import {
  BreakdownTable,
  CalcField,
  CalculatorShell,
  GrowthChart,
  InputsCard,
  ResultPanel,
} from "@/components/calculators";
import {
  calculatePpf,
  PPF_MAX_DEPOSIT,
  PPF_MIN_DEPOSIT,
  PPF_RATE,
  PPF_TENURE_YEARS,
} from "@/utils/calculators";
import { fmt } from "@/utils/format";

export default function PpfCalculatorPage() {
  const [inputs, setInputs] = useState({
    yearlyDeposit: "150000",
    annualRatePct: String(PPF_RATE),
    years: String(PPF_TENURE_YEARS),
  });

  const set = (key: keyof typeof inputs) => (value: string) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const result = useMemo(
    () =>
      calculatePpf({
        yearlyDeposit: parseFloat(inputs.yearlyDeposit) || 0,
        annualRatePct: parseFloat(inputs.annualRatePct) || 0,
        years: parseInt(inputs.years) || 0,
      }),
    [inputs]
  );

  return (
    <CalculatorShell
      title="PPF Calculator"
      description="Public Provident Fund maturity value over the 15-year lock-in"
      icon={PiggyBank}
    >
      <InputsCard>
        <CalcField
          label="Yearly Deposit"
          value={inputs.yearlyDeposit}
          onChange={set("yearlyDeposit")}
          unit="₹"
          min={PPF_MIN_DEPOSIT}
          max={PPF_MAX_DEPOSIT}
          step={500}
          slider
          hint={`Statutory limit: ${fmt(PPF_MIN_DEPOSIT)}–${fmt(PPF_MAX_DEPOSIT)} per year`}
        />
        <CalcField
          label="Interest Rate"
          value={inputs.annualRatePct}
          onChange={set("annualRatePct")}
          unit="% p.a."
          min={4}
          max={12}
          step={0.1}
          slider
          hint="Revised quarterly by the government"
        />
        <CalcField
          label="Tenure"
          value={inputs.years}
          onChange={set("years")}
          unit="years"
          min={15}
          max={50}
          step={5}
          slider
          hint="15-year lock-in, extendable in 5-year blocks"
        />
      </InputsCard>

      <ResultPanel
        headlineLabel="Maturity value"
        headline={fmt(result.maturityValue)}
        headlineHint={`After ${inputs.years} years at ${inputs.annualRatePct}% compounded annually`}
        stats={[
          {
            label: "Total Invested",
            value: fmt(result.totalInvested),
            hint: `${inputs.years} yearly deposits`,
            icon: Wallet,
          },
          {
            label: "Interest Earned",
            value: fmt(result.totalInterest),
            hint: "Fully tax-free",
            tone: "success",
            icon: TrendingUp,
          },
          {
            label: "80C Deduction",
            value: fmt(
              Math.min(parseFloat(inputs.yearlyDeposit) || 0, PPF_MAX_DEPOSIT)
            ),
            hint: "Claimable per year",
            tone: "brand",
            icon: ShieldCheck,
          },
          {
            label: "Wealth Multiple",
            value:
              result.totalInvested > 0
                ? `${(result.maturityValue / result.totalInvested).toFixed(2)}x`
                : "—",
            hint: "Times your deposits",
            tone: "warning",
            icon: PiggyBank,
          },
        ]}
        note={
          <>
            PPF is an EEE instrument — deposits qualify under Section 80C, and both
            the interest and the maturity amount are tax-free. Interest is credited
            annually here; in practice it is calculated on the lowest balance
            between the 5th and the last day of each month, so depositing before
            the 5th of April maximises it.
          </>
        }
      >
        {result.depositOutOfRange && (
          <p className="text-xs text-warning">
            A PPF account accepts between {fmt(PPF_MIN_DEPOSIT)} and{" "}
            {fmt(PPF_MAX_DEPOSIT)} per financial year — deposits outside this range
            are not permitted.
          </p>
        )}

        <GrowthChart
          title="Corpus Growth"
          subtitle="Deposits and accumulated interest by year"
          data={result.schedule}
          xKey="year"
          stacked={false}
          series={[{ key: "balance", name: "Balance", color: "#0080ff" }]}
        />

        <BreakdownTable
          title="Year-wise Breakdown"
          rows={result.schedule}
          rowKey={(row) => row.year}
          initialRows={15}
          columns={[
            { key: "year", header: "Year", render: (row) => row.year },
            {
              key: "deposit",
              header: "Deposit",
              align: "right",
              render: (row) => fmt(row.deposit),
            },
            {
              key: "interest",
              header: "Interest",
              align: "right",
              render: (row) => fmt(row.interest),
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
