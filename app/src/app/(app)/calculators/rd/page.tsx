"use client";

import { useMemo, useState } from "react";
import { CalendarClock, TrendingUp, Wallet, Percent } from "lucide-react";
import {
  BreakdownTable,
  CalcField,
  CalculatorShell,
  GrowthChart,
  InputsCard,
  ResultPanel,
} from "@/components/calculators";
import { calculateRd } from "@/utils/calculators";
import { fmt } from "@/utils/format";

export default function RdCalculatorPage() {
  const [inputs, setInputs] = useState({
    monthlyDeposit: "10000",
    annualRatePct: "7",
    months: "60",
  });

  const set = (key: keyof typeof inputs) => (value: string) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const result = useMemo(
    () =>
      calculateRd({
        monthlyDeposit: parseFloat(inputs.monthlyDeposit) || 0,
        annualRatePct: parseFloat(inputs.annualRatePct) || 0,
        months: parseInt(inputs.months) || 0,
      }),
    [inputs]
  );

  const months = parseInt(inputs.months) || 0;

  return (
    <CalculatorShell
      title="RD Calculator"
      description="Recurring deposit maturity value from a fixed monthly deposit"
      icon={CalendarClock}
    >
      <InputsCard>
        <CalcField
          label="Monthly Deposit"
          value={inputs.monthlyDeposit}
          onChange={set("monthlyDeposit")}
          unit="₹"
          min={100}
          max={500000}
          step={500}
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
          value={inputs.months}
          onChange={set("months")}
          unit="months"
          min={6}
          max={120}
          slider
          hint={
            months > 0
              ? `${Math.floor(months / 12)} years ${months % 12} months`
              : undefined
          }
        />
      </InputsCard>

      <ResultPanel
        headlineLabel="Maturity amount"
        headline={fmt(result.maturityValue)}
        headlineHint={`After ${months} monthly deposits at ${inputs.annualRatePct}% per annum`}
        stats={[
          {
            label: "Total Deposited",
            value: fmt(result.invested),
            hint: `${months} instalments`,
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
            label: "Monthly Deposit",
            value: fmt(parseFloat(inputs.monthlyDeposit) || 0),
            hint: "Fixed each month",
            tone: "warning",
            icon: CalendarClock,
          },
        ]}
        note={
          <>
            Each instalment earns interest only for the months it stays invested,
            so an RD returns less than a lump-sum FD of the same total. Interest is
            taxable at your slab rate.
          </>
        }
      >
        <GrowthChart
          title="Deposit Growth"
          subtitle="Deposits and accumulated interest by year"
          data={result.schedule}
          xKey="year"
          series={[
            { key: "invested", name: "Deposited", color: "#0080ff" },
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
              key: "invested",
              header: "Deposited",
              align: "right",
              render: (row) => fmt(row.invested),
            },
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
