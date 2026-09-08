"use client";

import { useMemo, useState } from "react";
import { Building2, TrendingUp, Wallet, Users } from "lucide-react";
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
import { calculateEpf, EPF_RATE, EPF_WAGE_CEILING } from "@/utils/calculators";
import { fmt } from "@/utils/format";

export default function EpfCalculatorPage() {
  const [inputs, setInputs] = useState({
    monthlyBasicDa: "50000",
    currentAge: "30",
    retireAge: "58",
    annualRatePct: String(EPF_RATE),
    salaryGrowthPct: "7",
  });
  const { monthlySalary } = usePrefill();
  // EPF is computed on basic + DA, conventionally around 40% of gross pay.
  const estimatedBasic = Math.round(monthlySalary * 0.4);

  const set = (key: keyof typeof inputs) => (value: string) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const result = useMemo(
    () =>
      calculateEpf({
        monthlyBasicDa: parseFloat(inputs.monthlyBasicDa) || 0,
        currentAge: parseInt(inputs.currentAge) || 0,
        retireAge: parseInt(inputs.retireAge) || 0,
        annualRatePct: parseFloat(inputs.annualRatePct) || 0,
        salaryGrowthPct: parseFloat(inputs.salaryGrowthPct) || 0,
      }),
    [inputs]
  );

  return (
    <CalculatorShell
      title="EPF Calculator"
      description="Provident fund corpus at retirement from your basic salary"
      icon={Building2}
    >
      <PrefillBanner
        label="Estimated basic (40% of your salary) is"
        value={estimatedBasic}
        onApply={() =>
          setInputs((prev) => ({ ...prev, monthlyBasicDa: String(estimatedBasic) }))
        }
      />

      <InputsCard>
        <CalcField
          label="Monthly Basic + DA"
          value={inputs.monthlyBasicDa}
          onChange={set("monthlyBasicDa")}
          unit="₹"
          min={1000}
          max={500000}
          step={1000}
          slider
        />
        <CalcField
          label="Current Age"
          value={inputs.currentAge}
          onChange={set("currentAge")}
          min={18}
          max={58}
          slider
        />
        <CalcField
          label="Retirement Age"
          value={inputs.retireAge}
          onChange={set("retireAge")}
          min={40}
          max={70}
          slider
        />
        <CalcField
          label="EPF Interest Rate"
          value={inputs.annualRatePct}
          onChange={set("annualRatePct")}
          unit="% p.a."
          min={5}
          max={12}
          step={0.05}
          slider
        />
        <CalcField
          label="Annual Salary Growth"
          value={inputs.salaryGrowthPct}
          onChange={set("salaryGrowthPct")}
          unit="%"
          min={0}
          max={20}
          step={0.5}
          slider
        />
      </InputsCard>

      <ResultPanel
        headlineLabel="EPF corpus at retirement"
        headline={fmt(result.maturityValue)}
        headlineHint={`Over ${result.yearsToRetirement} years of service at ${inputs.annualRatePct}% interest`}
        stats={[
          {
            label: "Your Contribution",
            value: fmt(result.totalEmployee),
            hint: "12% of basic + DA",
            icon: Wallet,
          },
          {
            label: "Employer Contribution",
            value: fmt(result.totalEmployer),
            hint: "3.67% after the EPS split",
            tone: "brand",
            icon: Users,
          },
          {
            label: "Interest Earned",
            value: fmt(result.totalInterest),
            hint: "Tax-free on withdrawal after 5 years",
            tone: "success",
            icon: TrendingUp,
          },
          {
            label: "Years of Service",
            value: `${result.yearsToRetirement}`,
            hint: "Contributing years",
            tone: "warning",
            icon: Building2,
          },
        ]}
        note={
          <>
            You contribute 12% of basic + DA. Your employer matches 12%, but 8.33%
            of it (capped at a {fmt(EPF_WAGE_CEILING)} wage ceiling) is diverted to
            the EPS pension scheme and does not form part of this corpus — only the
            remaining 3.67% is credited to EPF. Interest is credited annually on
            the running balance.
          </>
        }
      >
        <GrowthChart
          title="Corpus Growth"
          subtitle="Balance accumulated year by year"
          data={result.schedule}
          xKey="age"
          xLabelPrefix="Age"
          stacked={false}
          series={[{ key: "balance", name: "Balance", color: "#0080ff" }]}
        />

        <BreakdownTable
          title="Year-wise Breakdown"
          rows={result.schedule}
          rowKey={(row) => row.year}
          columns={[
            { key: "age", header: "Age", render: (row) => row.age },
            {
              key: "employee",
              header: "You",
              align: "right",
              render: (row) => fmt(row.employee),
            },
            {
              key: "employer",
              header: "Employer",
              align: "right",
              render: (row) => fmt(row.employer),
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
