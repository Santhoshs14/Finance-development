"use client";

import { useMemo, useState } from "react";
import { LineChart, TrendingUp, Wallet, Percent, Plus, X } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";
import {
  CalcField,
  CalcSegmented,
  CalculatorShell,
  GrowthChart,
  InputsCard,
  ResultPanel,
} from "@/components/calculators";
import { calculateCagr } from "@/utils/calculators";
import { calculateXIRR } from "@/utils/calculations";
import { fmt } from "@/utils/format";

interface Cashflow {
  id: string;
  date: string;
  amount: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function CagrCalculatorPage() {
  const [mode, setMode] = useState<"cagr" | "xirr">("cagr");
  const [inputs, setInputs] = useState({
    initialValue: "100000",
    finalValue: "200000",
    years: "5",
  });
  const [cashflows, setCashflows] = useState<Cashflow[]>([
    { id: "1", date: "2021-04-01", amount: "-100000" },
    { id: "2", date: "2023-04-01", amount: "-50000" },
    { id: "3", date: today(), amount: "220000" },
  ]);

  const set = (key: keyof typeof inputs) => (value: string) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const cagrResult = useMemo(
    () =>
      calculateCagr({
        initialValue: parseFloat(inputs.initialValue) || 0,
        finalValue: parseFloat(inputs.finalValue) || 0,
        years: parseFloat(inputs.years) || 0,
      }),
    [inputs]
  );

  const xirr = useMemo(() => {
    const flows = cashflows
      .filter((cf) => cf.date && cf.amount.trim() !== "")
      .map((cf) => ({ date: cf.date, amount: parseFloat(cf.amount) || 0 }))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (flows.length < 2) return null;
    const invested = flows
      .filter((f) => f.amount < 0)
      .reduce((sum, f) => sum + Math.abs(f.amount), 0);
    const returned = flows
      .filter((f) => f.amount > 0)
      .reduce((sum, f) => sum + f.amount, 0);
    return { rate: calculateXIRR(flows), invested, returned };
  }, [cashflows]);

  const updateFlow = (id: string, patch: Partial<Cashflow>) =>
    setCashflows((prev) =>
      prev.map((cf) => (cf.id === id ? { ...cf, ...patch } : cf))
    );

  return (
    <CalculatorShell
      title="CAGR & XIRR Calculator"
      description="Annualised return on an investment, or IRR across dated cashflows"
      icon={LineChart}
    >
      <InputsCard title="Mode">
        <CalcSegmented
          label="Calculation"
          value={mode}
          options={[
            { value: "cagr", label: "CAGR (single investment)" },
            { value: "xirr", label: "XIRR (multiple cashflows)" },
          ]}
          onChange={setMode}
          className="sm:col-span-2 lg:col-span-3"
        />
      </InputsCard>

      {mode === "cagr" ? (
        <>
          <InputsCard>
            <CalcField
              label="Initial Value"
              value={inputs.initialValue}
              onChange={set("initialValue")}
              unit="₹"
              min={1}
              max={100000000}
              step={10000}
              slider
            />
            <CalcField
              label="Final Value"
              value={inputs.finalValue}
              onChange={set("finalValue")}
              unit="₹"
              min={0}
              max={100000000}
              step={10000}
              slider
            />
            <CalcField
              label="Duration"
              value={inputs.years}
              onChange={set("years")}
              unit="years"
              min={0.5}
              max={40}
              step={0.5}
              slider
            />
          </InputsCard>

          <ResultPanel
            headlineLabel="CAGR"
            headline={`${cagrResult.cagr}%`}
            headlineHint={`Compounded annually over ${inputs.years} years`}
            stats={[
              {
                label: "Initial Value",
                value: fmt(parseFloat(inputs.initialValue) || 0),
                hint: "Amount invested",
                icon: Wallet,
              },
              {
                label: "Final Value",
                value: fmt(parseFloat(inputs.finalValue) || 0),
                hint: "Value today",
                tone: "brand",
                icon: TrendingUp,
              },
              {
                label: "Total Gain",
                value: fmt(cagrResult.totalGain),
                hint: "Absolute profit",
                tone: cagrResult.totalGain >= 0 ? "success" : "danger",
                icon: LineChart,
              },
              {
                label: "Absolute Return",
                value: `${cagrResult.absoluteReturnPct}%`,
                hint: "Not annualised",
                tone: "warning",
                icon: Percent,
              },
            ]}
            note={
              <>
                CAGR ={" "}
                <span className="font-medium text-foreground">
                  (final ÷ initial)^(1 ÷ years) − 1
                </span>
                . It smooths out volatility into a single equivalent annual rate, so
                it does not reflect how bumpy the ride actually was. Use XIRR
                instead when money went in or out at different dates.
              </>
            }
          >
            <GrowthChart
              title="Smoothed Growth Path"
              subtitle="Value if it had grown at a constant CAGR"
              data={cagrResult.schedule}
              xKey="year"
              stacked={false}
              series={[{ key: "value", name: "Value", color: "#0080ff" }]}
            />
          </ResultPanel>
        </>
      ) : (
        <>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Cashflows</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCashflows((prev) => [
                    ...prev,
                    { id: crypto.randomUUID(), date: today(), amount: "" },
                  ])
                }
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Enter investments as negative amounts and redemptions (or the
                current value) as positive.
              </p>
              {cashflows.map((cf, i) => (
                <div key={cf.id} className="flex items-end gap-2">
                  <div className="flex-1">
                    <label
                      htmlFor={`date-${cf.id}`}
                      className="block text-[11px] font-medium text-muted-foreground mb-1"
                    >
                      Date {i + 1}
                    </label>
                    <Input
                      id={`date-${cf.id}`}
                      type="date"
                      value={cf.date}
                      onChange={(e) => updateFlow(cf.id, { date: e.target.value })}
                    />
                  </div>
                  <div className="flex-1">
                    <label
                      htmlFor={`amount-${cf.id}`}
                      className="block text-[11px] font-medium text-muted-foreground mb-1"
                    >
                      Amount (₹)
                    </label>
                    <Input
                      id={`amount-${cf.id}`}
                      type="number"
                      inputMode="decimal"
                      value={cf.amount}
                      placeholder="-100000"
                      onChange={(e) => updateFlow(cf.id, { amount: e.target.value })}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove cashflow ${i + 1}`}
                    disabled={cashflows.length <= 2}
                    onClick={() =>
                      setCashflows((prev) => prev.filter((row) => row.id !== cf.id))
                    }
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {xirr && (
            <ResultPanel
              headlineLabel="XIRR"
              headline={`${xirr.rate}%`}
              headlineHint="Annualised return across all dated cashflows"
              stats={[
                {
                  label: "Total Invested",
                  value: fmt(xirr.invested),
                  hint: "Sum of negative flows",
                  icon: Wallet,
                },
                {
                  label: "Total Received",
                  value: fmt(xirr.returned),
                  hint: "Sum of positive flows",
                  tone: "brand",
                  icon: TrendingUp,
                },
                {
                  label: "Net Gain",
                  value: fmt(xirr.returned - xirr.invested),
                  hint: "Received minus invested",
                  tone: xirr.returned >= xirr.invested ? "success" : "danger",
                  icon: LineChart,
                },
                {
                  label: "Cashflows",
                  value: `${cashflows.length}`,
                  hint: "Entries included",
                  tone: "warning",
                  icon: Percent,
                },
              ]}
              note={
                <>
                  XIRR solves for the discount rate that makes the net present value
                  of all cashflows zero, accounting for the exact date of each one.
                  It is the right measure for SIPs and any portfolio with irregular
                  contributions. A result of 0% usually means the flows are all the
                  same sign — you need at least one investment and one redemption.
                </>
              }
            />
          )}
        </>
      )}
    </CalculatorShell>
  );
}
