"use client";

import { useMemo, useState } from "react";
import { Gift, Wallet, CalendarClock, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import {
  CalcField,
  CalcSegmented,
  CalculatorShell,
  InputsCard,
  PrefillBanner,
  ResultPanel,
  usePrefill,
} from "@/components/calculators";
import { calculateGratuity, GRATUITY_CAP } from "@/utils/calculators";
import { fmt } from "@/utils/format";

export default function GratuityCalculatorPage() {
  const [inputs, setInputs] = useState({
    lastDrawnBasicDa: "50000",
    yearsOfService: "10",
  });
  const [coverage, setCoverage] = useState<"act" | "outside">("act");
  const { monthlySalary } = usePrefill();
  const estimatedBasic = Math.round(monthlySalary * 0.4);

  const set = (key: keyof typeof inputs) => (value: string) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const result = useMemo(
    () =>
      calculateGratuity({
        lastDrawnBasicDa: parseFloat(inputs.lastDrawnBasicDa) || 0,
        yearsOfService: parseFloat(inputs.yearsOfService) || 0,
        coveredByAct: coverage === "act",
      }),
    [inputs, coverage]
  );

  const divisor = coverage === "act" ? 26 : 30;

  return (
    <CalculatorShell
      title="Gratuity Calculator"
      description="Statutory gratuity payable on your last drawn salary and tenure"
      icon={Gift}
    >
      <PrefillBanner
        label="Estimated basic (40% of your salary) is"
        value={estimatedBasic}
        onApply={() =>
          setInputs((prev) => ({ ...prev, lastDrawnBasicDa: String(estimatedBasic) }))
        }
      />

      <InputsCard>
        <CalcField
          label="Last Drawn Basic + DA"
          value={inputs.lastDrawnBasicDa}
          onChange={set("lastDrawnBasicDa")}
          unit="₹"
          min={1000}
          max={1000000}
          step={1000}
          slider
        />
        <CalcField
          label="Years of Service"
          value={inputs.yearsOfService}
          onChange={set("yearsOfService")}
          unit="years"
          min={0}
          max={45}
          step={0.5}
          slider
        />
        <CalcSegmented
          label="Employer Coverage"
          value={coverage}
          options={[
            { value: "act", label: "Covered by Gratuity Act" },
            { value: "outside", label: "Not covered" },
          ]}
          onChange={setCoverage}
        />
      </InputsCard>

      {!result.eligible ? (
        <Card>
          <CardContent className="p-4 flex items-start gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
            <p className="text-muted-foreground">
              Gratuity requires at least 5 years of continuous service. At{" "}
              {inputs.yearsOfService} years no gratuity is payable — the only
              exceptions are death or permanent disablement.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ResultPanel
          headlineLabel="Gratuity payable"
          headline={fmt(result.gratuity)}
          headlineHint={`${result.roundedYears} years of service on ${fmt(parseFloat(inputs.lastDrawnBasicDa) || 0)} basic + DA`}
          stats={[
            {
              label: "Last Drawn Salary",
              value: fmt(parseFloat(inputs.lastDrawnBasicDa) || 0),
              hint: "Basic + dearness allowance",
              icon: Wallet,
            },
            {
              label: "Service Counted",
              value: `${result.roundedYears} years`,
              hint:
                coverage === "act"
                  ? "Rounded to the nearest year"
                  : "Completed years only",
              tone: "brand",
              icon: CalendarClock,
            },
            {
              label: "Before Cap",
              value: fmt(result.uncappedGratuity),
              hint: result.cappedAtLimit ? "Reduced to the limit" : "Within the limit",
              tone: result.cappedAtLimit ? "warning" : "default",
              icon: Gift,
            },
            {
              label: "Statutory Cap",
              value: fmt(GRATUITY_CAP),
              hint: "Maximum tax-exempt gratuity",
              tone: "success",
              icon: AlertTriangle,
            },
          ]}
          note={
            <>
              Gratuity ={" "}
              <span className="font-medium text-foreground">
                last drawn basic + DA × 15 ÷ {divisor} × years of service
              </span>
              .{" "}
              {coverage === "act"
                ? "Under the Payment of Gratuity Act a month is treated as 26 working days, and service beyond 6 months rounds up to a full year."
                : "Employers outside the Act use a 30-day month and count only completed years."}{" "}
              Gratuity up to {fmt(GRATUITY_CAP)} is exempt from income tax; anything
              above is taxable at your slab rate.
            </>
          }
        />
      )}
    </CalculatorShell>
  );
}
