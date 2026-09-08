"use client";

import { useMemo, useState } from "react";
import { Receipt, Wallet, Percent, CalendarClock } from "lucide-react";
import {
  BreakdownTable,
  CalcField,
  CalculatorShell,
  InputsCard,
  ResultPanel,
  SplitDonut,
} from "@/components/calculators";
import { calculateEmi } from "@/utils/calculators";
import { fmt } from "@/utils/format";

export default function EmiCalculatorPage() {
  const [inputs, setInputs] = useState({
    principal: "2500000",
    annualRatePct: "9",
    tenureMonths: "240",
  });

  const set = (key: keyof typeof inputs) => (value: string) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const result = useMemo(
    () =>
      calculateEmi({
        principal: parseFloat(inputs.principal) || 0,
        annualRatePct: parseFloat(inputs.annualRatePct) || 0,
        tenureMonths: parseInt(inputs.tenureMonths) || 0,
      }),
    [inputs]
  );

  const months = parseInt(inputs.tenureMonths) || 0;

  return (
    <CalculatorShell
      title="EMI Calculator"
      description="Loan instalment, total interest and a full amortisation schedule"
      icon={Receipt}
    >
      <InputsCard>
        <CalcField
          label="Loan Amount"
          value={inputs.principal}
          onChange={set("principal")}
          unit="₹"
          min={10000}
          max={100000000}
          step={50000}
          slider
        />
        <CalcField
          label="Interest Rate"
          value={inputs.annualRatePct}
          onChange={set("annualRatePct")}
          unit="% p.a."
          min={0}
          max={30}
          step={0.05}
          slider
        />
        <CalcField
          label="Tenure"
          value={inputs.tenureMonths}
          onChange={set("tenureMonths")}
          unit="months"
          min={1}
          max={360}
          slider
          hint={
            months > 0
              ? `${Math.floor(months / 12)} years ${months % 12} months`
              : undefined
          }
        />
      </InputsCard>

      <ResultPanel
        headlineLabel="Monthly EMI"
        headline={fmt(result.emi)}
        headlineHint={`For ${months} months at ${inputs.annualRatePct}% per annum`}
        stats={[
          {
            label: "Principal",
            value: fmt(result.principal),
            hint: "Amount borrowed",
            icon: Wallet,
          },
          {
            label: "Total Interest",
            value: fmt(result.totalInterest),
            hint: "Cost of the loan",
            tone: "danger",
            icon: Percent,
          },
          {
            label: "Total Payment",
            value: fmt(result.totalPayment),
            hint: "Principal + interest",
            tone: "brand",
            icon: Receipt,
          },
          {
            label: "Interest Share",
            value: `${result.interestSharePct}%`,
            hint: "Of every rupee repaid",
            tone: "warning",
            icon: CalendarClock,
          },
        ]}
        note={
          <>
            Uses the standard reducing-balance formula
            <span className="font-medium text-foreground">
              {" "}EMI = P × r × (1+r)ⁿ ÷ ((1+r)ⁿ − 1)
            </span>
            , where r is the monthly rate and n the number of months. Processing
            fees, insurance and any floating-rate revisions are not included.
          </>
        }
      >
        <SplitDonut
          title="Payment Breakup"
          subtitle="How your total repayment splits"
          slices={[
            { name: "Principal", value: result.principal, color: "#0080ff" },
            { name: "Interest", value: result.totalInterest, color: "#ef4444" },
          ]}
        />

        <BreakdownTable
          title="Yearly Amortisation"
          rows={result.yearlySchedule}
          rowKey={(row) => row.year}
          columns={[
            { key: "year", header: "Year", render: (row) => row.year },
            {
              key: "principal",
              header: "Principal Paid",
              align: "right",
              render: (row) => fmt(row.principal),
            },
            {
              key: "interest",
              header: "Interest Paid",
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
