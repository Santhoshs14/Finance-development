"use client";

import { useMemo, useState } from "react";
import { Home, Wallet, Receipt, Percent } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import {
  CalcField,
  CalcSegmented,
  CalculatorShell,
  InputsCard,
  PrefillBanner,
  ResultPanel,
  SplitDonut,
  usePrefill,
} from "@/components/calculators";
import { calculateHraExemption } from "@/utils/calculators";
import { fmt } from "@/utils/format";

export default function HraCalculatorPage() {
  const [inputs, setInputs] = useState({
    basicSalary: "50000",
    hraReceived: "20000",
    rentPaid: "25000",
  });
  const [city, setCity] = useState<"metro" | "nonmetro">("metro");
  const { monthlySalary } = usePrefill();
  const estimatedBasic = Math.round(monthlySalary * 0.4);

  const set = (key: keyof typeof inputs) => (value: string) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const result = useMemo(
    () =>
      calculateHraExemption({
        basicSalary: parseFloat(inputs.basicSalary) || 0,
        hraReceived: parseFloat(inputs.hraReceived) || 0,
        rentPaid: parseFloat(inputs.rentPaid) || 0,
        isMetro: city === "metro",
      }),
    [inputs, city]
  );

  return (
    <CalculatorShell
      title="HRA Exemption Calculator"
      description="House rent allowance exempt from tax under Section 10(13A)"
      icon={Home}
    >
      <PrefillBanner
        label="Estimated basic (40% of your salary) is"
        value={estimatedBasic}
        onApply={() =>
          setInputs((prev) => ({ ...prev, basicSalary: String(estimatedBasic) }))
        }
      />

      <InputsCard>
        <CalcField
          label="Monthly Basic + DA"
          value={inputs.basicSalary}
          onChange={set("basicSalary")}
          unit="₹"
          min={0}
          max={1000000}
          step={1000}
          slider
        />
        <CalcField
          label="Monthly HRA Received"
          value={inputs.hraReceived}
          onChange={set("hraReceived")}
          unit="₹"
          min={0}
          max={500000}
          step={1000}
          slider
        />
        <CalcField
          label="Monthly Rent Paid"
          value={inputs.rentPaid}
          onChange={set("rentPaid")}
          unit="₹"
          min={0}
          max={500000}
          step={1000}
          slider
        />
        <CalcSegmented
          label="City"
          value={city}
          options={[
            { value: "metro", label: "Metro (50%)" },
            { value: "nonmetro", label: "Non-metro (40%)" },
          ]}
          onChange={setCity}
        />
      </InputsCard>

      {!result ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Enter your basic salary and the rent you pay to calculate the exemption.
          </CardContent>
        </Card>
      ) : (
        <ResultPanel
          headlineLabel="Annual HRA exemption"
          headline={fmt(result.exempt)}
          headlineHint={`${fmt(result.exempt / 12)} per month, exempt under Section 10(13A)`}
          stats={[
            {
              label: "Actual HRA Received",
              value: fmt(result.components.a),
              hint: "Component A (annual)",
              icon: Wallet,
            },
            {
              label: "Rent − 10% of Basic",
              value: fmt(result.components.b),
              hint: "Component B (annual)",
              tone: "brand",
              icon: Receipt,
            },
            {
              label: `${city === "metro" ? "50" : "40"}% of Basic`,
              value: fmt(result.components.c),
              hint: "Component C (annual)",
              tone: "warning",
              icon: Percent,
            },
            {
              label: "Taxable HRA",
              value: fmt(result.taxableHra),
              hint: "Added to your taxable income",
              tone: result.taxableHra > 0 ? "danger" : "success",
              icon: Home,
            },
          ]}
          note={
            <>
              The exemption is the <strong>least</strong> of the three components
              above. Metro cities for this purpose are Delhi, Mumbai, Kolkata and
              Chennai. HRA exemption is available only under the{" "}
              <strong>old tax regime</strong> — the new regime does not allow it.
              Rent above ₹1 lakh a year requires your landlord&apos;s PAN.
            </>
          }
        >
          <SplitDonut
            title="Annual HRA Split"
            subtitle="Exempt vs taxable portion of the HRA you receive"
            slices={[
              { name: "Exempt", value: result.exempt, color: "#10b981" },
              { name: "Taxable", value: result.taxableHra, color: "#ef4444" },
            ]}
          />
        </ResultPanel>
      )}
    </CalculatorShell>
  );
}
