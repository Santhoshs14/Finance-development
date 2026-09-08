"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeft, TrendingUp, Wallet, Repeat } from "lucide-react";
import {
  BreakdownTable,
  CalcField,
  CalculatorShell,
  GrowthChart,
  InputsCard,
  ResultPanel,
} from "@/components/calculators";
import { calculateStp } from "@/utils/calculators";
import { fmt } from "@/utils/format";

export default function StpCalculatorPage() {
  const [inputs, setInputs] = useState({
    sourceCorpus: "1200000",
    monthlyTransfer: "50000",
    sourceRatePct: "6",
    targetRatePct: "12",
    months: "24",
  });

  const set = (key: keyof typeof inputs) => (value: string) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const result = useMemo(
    () =>
      calculateStp({
        sourceCorpus: parseFloat(inputs.sourceCorpus) || 0,
        monthlyTransfer: parseFloat(inputs.monthlyTransfer) || 0,
        sourceRatePct: parseFloat(inputs.sourceRatePct) || 0,
        targetRatePct: parseFloat(inputs.targetRatePct) || 0,
        months: parseInt(inputs.months) || 0,
      }),
    [inputs]
  );

  return (
    <CalculatorShell
      title="STP Calculator"
      description="Stagger a lump sum from a debt fund into equity via systematic transfers"
      icon={ArrowRightLeft}
    >
      <InputsCard>
        <CalcField
          label="Source Corpus"
          value={inputs.sourceCorpus}
          onChange={set("sourceCorpus")}
          unit="₹"
          min={10000}
          max={50000000}
          step={50000}
          slider
        />
        <CalcField
          label="Monthly Transfer"
          value={inputs.monthlyTransfer}
          onChange={set("monthlyTransfer")}
          unit="₹"
          min={1000}
          max={1000000}
          step={1000}
          slider
        />
        <CalcField
          label="Source Fund Return"
          value={inputs.sourceRatePct}
          onChange={set("sourceRatePct")}
          unit="% p.a."
          min={0}
          max={15}
          step={0.5}
          slider
          hint="Typically a debt or liquid fund"
        />
        <CalcField
          label="Target Fund Return"
          value={inputs.targetRatePct}
          onChange={set("targetRatePct")}
          unit="% p.a."
          min={0}
          max={30}
          step={0.5}
          slider
          hint="Typically an equity fund"
        />
        <CalcField
          label="Transfer Period"
          value={inputs.months}
          onChange={set("months")}
          unit="months"
          min={1}
          max={120}
          slider
        />
      </InputsCard>

      <ResultPanel
        headlineLabel="Total value at the end"
        headline={fmt(result.totalValue)}
        headlineHint={`Source + target after ${inputs.months} months of transfers`}
        stats={[
          {
            label: "Target Fund",
            value: fmt(result.targetValue),
            hint: "Value of transferred units",
            tone: "success",
            icon: TrendingUp,
          },
          {
            label: "Source Remaining",
            value: fmt(result.sourceRemaining),
            hint: "Still to be transferred",
            icon: Wallet,
          },
          {
            label: "Total Transferred",
            value: fmt(result.totalTransferred),
            hint: `${result.transfersCompleted} transfers completed`,
            tone: "brand",
            icon: Repeat,
          },
          {
            label: "Net Gain",
            value: fmt(result.totalGains),
            hint: "Over the original corpus",
            tone: result.totalGains >= 0 ? "success" : "danger",
            icon: ArrowRightLeft,
          },
        ]}
        note={
          <>
            Both legs compound monthly at their own rate; each transfer moves money
            from the source into the target at the start of the month. Transfers
            stop automatically once the source is exhausted. Note that STP
            redemptions from a debt fund are taxable events.
          </>
        }
      >
        <GrowthChart
          title="Source vs Target"
          subtitle="Month-by-month migration of your corpus"
          data={result.schedule}
          xKey="month"
          xLabelPrefix="Month"
          series={[
            { key: "source", name: "Source Fund", color: "#64748b" },
            { key: "target", name: "Target Fund", color: "#10b981" },
          ]}
        />

        <BreakdownTable
          title="Month-wise Breakdown"
          rows={result.schedule.slice(1)}
          rowKey={(row) => row.month}
          columns={[
            { key: "month", header: "Month", render: (row) => row.month },
            {
              key: "transferred",
              header: "Transferred",
              align: "right",
              render: (row) => fmt(row.transferred),
            },
            {
              key: "source",
              header: "Source",
              align: "right",
              render: (row) => fmt(row.source),
            },
            {
              key: "target",
              header: "Target",
              align: "right",
              render: (row) => fmt(row.target),
            },
          ]}
        />
      </ResultPanel>
    </CalculatorShell>
  );
}
