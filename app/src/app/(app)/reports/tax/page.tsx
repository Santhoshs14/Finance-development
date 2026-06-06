"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import ExportBar from "@/components/ExportBar";
import { useData } from "@/providers/DataProvider";
import { fmt } from "@/utils/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Input, Progress, Badge } from "@/components/ui";
import {
  Shield,
  Heart,
  Building2,
  PiggyBank,
  Calculator,
  Plus,
  X,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
} from "lucide-react";

type Regime = "new" | "old";

// --- New Regime (FY 2025-26) ---
const NEW_SLABS = [
  { from: 0, to: 400000, rate: 0 },
  { from: 400000, to: 800000, rate: 5 },
  { from: 800000, to: 1200000, rate: 10 },
  { from: 1200000, to: 1600000, rate: 15 },
  { from: 1600000, to: 2000000, rate: 20 },
  { from: 2000000, to: 2400000, rate: 25 },
  { from: 2400000, to: Infinity, rate: 30 },
];
const NEW_STANDARD_DEDUCTION = 75000;
const NEW_87A_REBATE = 60000;
const NEW_87A_INCOME_LIMIT = 1200000;

// --- Old Regime ---
const OLD_SLABS = [
  { from: 0, to: 250000, rate: 0 },
  { from: 250000, to: 500000, rate: 5 },
  { from: 500000, to: 1000000, rate: 20 },
  { from: 1000000, to: Infinity, rate: 30 },
];
const OLD_STANDARD_DEDUCTION = 50000;
const OLD_87A_REBATE = 12500;
const OLD_87A_INCOME_LIMIT = 500000;

function calculateTax(taxableIncome: number, slabs: typeof NEW_SLABS): number {
  let tax = 0;
  for (const slab of slabs) {
    if (taxableIncome <= slab.from) break;
    const taxable = Math.min(taxableIncome, slab.to) - slab.from;
    tax += taxable * (slab.rate / 100);
  }
  return Math.round(tax);
}

// --- Old Regime Sections ---
interface TaxEntry {
  id: string;
  description: string;
  amount: number;
  section: string;
}

const OLD_SECTIONS = {
  "80C": { label: "Section 80C", limit: 150000, icon: Shield, color: "#0080ff", description: "PPF, ELSS, Life Insurance, EPF, NSC, Tax-saving FDs, etc." },
  "80D": { label: "Section 80D", limit: 25000, icon: Heart, color: "#ef4444", description: "Health Insurance Premiums (self & family)" },
  "80D_parents": { label: "80D (Parents)", limit: 50000, icon: Heart, color: "#f97316", description: "Parents' health insurance (₹50K if senior citizen)" },
  "80CCD": { label: "Section 80CCD(1B)", limit: 50000, icon: PiggyBank, color: "#10b981", description: "NPS contribution (additional ₹50K beyond 80C)" },
  HRA: { label: "HRA Exemption", limit: 0, icon: Building2, color: "#8b5cf6", description: "House Rent Allowance tax benefit" },
} as const;

type OldSectionKey = keyof typeof OLD_SECTIONS;

const STORAGE_KEY = "wf_tax_entries";

function getStoredEntries(): TaxEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch { return []; }
}

export default function TaxPage() {
  const { transactions } = useData();
  const [regime, setRegime] = useState<Regime>("new");
  const [grossIncome, setGrossIncome] = useState("");
  const [npsEmployer, setNpsEmployer] = useState("");

  // Old regime state
  const [entries, setEntries] = useState<TaxEntry[]>(getStoredEntries);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ description: "", amount: "", section: "80C" as OldSectionKey });
  const [hra, setHra] = useState({ basicSalary: "", hraReceived: "", rentPaid: "", isMetro: true });

  const saveEntries = (updated: TaxEntry[]) => {
    setEntries(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const addEntry = () => {
    if (!form.description || !form.amount) return;
    const entry: TaxEntry = {
      id: Date.now().toString(36),
      description: form.description,
      amount: parseFloat(form.amount) || 0,
      section: form.section,
    };
    saveEntries([...entries, entry]);
    setForm({ description: "", amount: "", section: "80C" });
    setShowAdd(false);
  };

  const removeEntry = (id: string) => saveEntries(entries.filter((e) => e.id !== id));

  // Auto-detect investments for Old Regime
  const autoDetected = useMemo(() => {
    const detected: TaxEntry[] = [];
    const investmentTxns = transactions.filter((t) => t.category === "Investment" && t.amount < 0);
    const totalInvested = investmentTxns.reduce((s, t) => s + Math.abs(t.amount), 0);
    if (totalInvested > 0) {
      detected.push({ id: "auto-investment", description: "Investments (auto-detected)", amount: totalInvested, section: "80C" });
    }
    return detected;
  }, [transactions]);

  const allEntries = useMemo(() => [...entries, ...autoDetected], [entries, autoDetected]);

  // Old regime section summaries
  const sectionSummary = useMemo(() => {
    const summary: Record<string, { total: number; entries: TaxEntry[] }> = {};
    Object.keys(OLD_SECTIONS).forEach((key) => { summary[key] = { total: 0, entries: [] }; });
    allEntries.forEach((e) => {
      if (summary[e.section]) {
        summary[e.section].total += e.amount;
        summary[e.section].entries.push(e);
      }
    });
    return summary;
  }, [allEntries]);

  // HRA calc (Old Regime)
  const hraExemption = useMemo(() => {
    const basic = parseFloat(hra.basicSalary) || 0;
    const received = parseFloat(hra.hraReceived) || 0;
    const rent = parseFloat(hra.rentPaid) || 0;
    if (basic === 0 || rent === 0) return null;
    const annualBasic = basic * 12;
    const annualHRA = received * 12;
    const annualRent = rent * 12;
    const a = annualHRA;
    const b = annualRent - 0.1 * annualBasic;
    const c = (hra.isMetro ? 0.5 : 0.4) * annualBasic;
    const exempt = Math.max(0, Math.min(a, b, c));
    return { exempt, components: { a, b: Math.max(0, b), c } };
  }, [hra]);

  // --- Tax Computation ---
  const gross = parseFloat(grossIncome) || 0;
  const npsEmp = parseFloat(npsEmployer) || 0;

  const newRegimeCalc = useMemo(() => {
    const standardDed = NEW_STANDARD_DEDUCTION;
    const nps80CCD2 = Math.min(npsEmp, gross * 0.14); // max 14% of salary
    const totalDeductions = standardDed + nps80CCD2;
    const taxableIncome = Math.max(0, gross - totalDeductions);
    let tax = calculateTax(taxableIncome, NEW_SLABS);
    // 87A rebate
    const rebate = taxableIncome <= NEW_87A_INCOME_LIMIT ? Math.min(tax, NEW_87A_REBATE) : 0;
    tax = Math.max(0, tax - rebate);
    return { standardDed, nps80CCD2, totalDeductions, taxableIncome, grossTax: calculateTax(taxableIncome, NEW_SLABS), rebate, finalTax: tax };
  }, [gross, npsEmp]);

  const oldRegimeCalc = useMemo(() => {
    const standardDed = OLD_STANDARD_DEDUCTION;
    let sectionDeductions = 0;
    (Object.keys(OLD_SECTIONS) as OldSectionKey[]).forEach((key) => {
      const sec = OLD_SECTIONS[key];
      const used = sectionSummary[key]?.total || 0;
      sectionDeductions += sec.limit > 0 ? Math.min(used, sec.limit) : 0;
    });
    const hraAmount = hraExemption?.exempt || 0;
    const totalDeductions = standardDed + sectionDeductions + hraAmount;
    const taxableIncome = Math.max(0, gross - totalDeductions);
    let tax = calculateTax(taxableIncome, OLD_SLABS);
    const rebate = taxableIncome <= OLD_87A_INCOME_LIMIT ? Math.min(tax, OLD_87A_REBATE) : 0;
    tax = Math.max(0, tax - rebate);
    return { standardDed, sectionDeductions, hraAmount, totalDeductions, taxableIncome, grossTax: calculateTax(taxableIncome, OLD_SLABS), rebate, finalTax: tax };
  }, [gross, sectionSummary, hraExemption]);

  const activeCalc = regime === "new" ? newRegimeCalc : oldRegimeCalc;
  const betterRegime = newRegimeCalc.finalTax <= oldRegimeCalc.finalTax ? "new" : "old";
  const savings = Math.abs(newRegimeCalc.finalTax - oldRegimeCalc.finalTax);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header + Regime Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Income Tax Calculator</h1>
          <p className="text-sm text-muted-foreground">FY 2025-26 · New Regime (default) or Old Regime</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportBar elementId="tax-report" filename={`tax-${regime}-regime`} title="Tax Calculation" />
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted border border-border">
          <button
            onClick={() => setRegime("new")}
            className={cn("px-4 py-2 rounded-md text-sm font-medium transition-all", regime === "new" ? "bg-brand text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            New Regime
          </button>
          <button
            onClick={() => setRegime("old")}
            className={cn("px-4 py-2 rounded-md text-sm font-medium transition-all", regime === "old" ? "bg-brand text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            Old Regime
          </button>
        </div>
        </div>
      </div>

      <div id="tax-report" className="space-y-6">
      {/* Gross Income Input */}
      <Card>
        <CardContent className="py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Gross Annual Income (₹)</label>
              <Input type="number" value={grossIncome} onChange={(e) => setGrossIncome(e.target.value)} placeholder="e.g. 1500000" className="text-lg font-semibold" />
            </div>
            {regime === "new" && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">NPS Employer Contribution (₹/year) <span className="text-muted-foreground/60">— 80CCD(2)</span></label>
                <Input type="number" value={npsEmployer} onChange={(e) => setNpsEmployer(e.target.value)} placeholder="0" className="text-lg font-semibold" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tax Summary */}
      {gross > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-brand/20">
            <CardContent className="py-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase">Gross Income</p>
                  <p className="text-xl font-bold text-foreground">{fmt(gross)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase">Deductions</p>
                  <p className="text-xl font-bold text-success">{fmt(activeCalc.totalDeductions)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase">Taxable Income</p>
                  <p className="text-xl font-bold text-foreground">{fmt(activeCalc.taxableIncome)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase">Tax Payable</p>
                  <p className="text-xl font-bold text-danger">{fmt(activeCalc.finalTax)}</p>
                  {activeCalc.rebate > 0 && <p className="text-[10px] text-success">87A rebate: -{fmt(activeCalc.rebate)}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Regime Comparison */}
      {gross > 0 && (
        <Card className={cn("border", betterRegime === "new" ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5")}>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <ArrowRightLeft className="w-5 h-5 text-brand flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {betterRegime === "new" ? "New Regime" : "Old Regime"} saves you {fmt(savings)}
                </p>
                <p className="text-xs text-muted-foreground">
                  New: {fmt(newRegimeCalc.finalTax)} · Old: {fmt(oldRegimeCalc.finalTax)}
                </p>
              </div>
              <Badge variant={betterRegime === regime ? "success" : "warning"}>
                {betterRegime === regime ? "You're on the better regime" : `Switch to ${betterRegime === "new" ? "New" : "Old"} Regime`}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* NEW REGIME — Slab Breakdown */}
      {regime === "new" && gross > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>New Regime — Tax Slab Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {/* Deduction lines */}
              <div className="flex justify-between text-sm py-2 border-b border-border">
                <span className="text-muted-foreground">Standard Deduction</span>
                <span className="font-medium text-success">-{fmt(newRegimeCalc.standardDed)}</span>
              </div>
              {newRegimeCalc.nps80CCD2 > 0 && (
                <div className="flex justify-between text-sm py-2 border-b border-border">
                  <span className="text-muted-foreground">NPS Employer 80CCD(2)</span>
                  <span className="font-medium text-success">-{fmt(newRegimeCalc.nps80CCD2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm py-2 border-b border-border font-medium">
                <span className="text-foreground">Taxable Income</span>
                <span className="text-foreground">{fmt(newRegimeCalc.taxableIncome)}</span>
              </div>

              {/* Slab-wise tax */}
              {NEW_SLABS.map((slab) => {
                const taxable = newRegimeCalc.taxableIncome;
                if (taxable <= slab.from) return null;
                const amount = Math.min(taxable, slab.to) - slab.from;
                const tax = Math.round(amount * (slab.rate / 100));
                return (
                  <div key={slab.from} className="flex justify-between text-xs py-1.5 text-muted-foreground">
                    <span>
                      ₹{(slab.from / 100000).toFixed(1)}L – {slab.to === Infinity ? "above" : `₹${(slab.to / 100000).toFixed(1)}L`} @ {slab.rate}%
                    </span>
                    <span className="text-foreground font-medium">{fmt(tax)}</span>
                  </div>
                );
              })}

              <div className="flex justify-between text-sm pt-2 border-t border-border font-medium">
                <span>Tax before rebate</span>
                <span>{fmt(newRegimeCalc.grossTax)}</span>
              </div>
              {newRegimeCalc.rebate > 0 && (
                <div className="flex justify-between text-sm text-success">
                  <span>Section 87A Rebate</span>
                  <span>-{fmt(newRegimeCalc.rebate)}</span>
                </div>
              )}
              <div className="flex justify-between text-base pt-2 border-t border-border font-bold">
                <span>Final Tax</span>
                <span className="text-danger">{fmt(newRegimeCalc.finalTax)}</span>
              </div>
            </div>

            {/* Info */}
            <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <strong>New Regime (FY 2025-26):</strong> Limited deductions — only Standard Deduction (₹75K) and NPS Employer contribution under 80CCD(2) up to 14% of salary. No 80C, 80D, HRA, LTA etc. Section 87A rebate of ₹60,000 for taxable income ≤ ₹12L (effectively zero tax up to ~₹12.75L gross).
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* OLD REGIME — Deductions + Slabs */}
      {regime === "old" && (
        <>
          {/* Add Deduction button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Deduction
            </button>
          </div>

          {/* Section Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Object.entries(OLD_SECTIONS) as [OldSectionKey, typeof OLD_SECTIONS[OldSectionKey]][]).map(([key, sec]) => {
              const summary = sectionSummary[key];
              const used = summary?.total || 0;
              const limit = sec.limit;
              const percentage = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
              const Icon = sec.icon;
              const remaining = limit > 0 ? Math.max(0, limit - used) : 0;

              return (
                <motion.div key={key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${sec.color}15` }}>
                            <Icon className="w-4 h-4" style={{ color: sec.color }} />
                          </div>
                          <div>
                            <CardTitle className="text-sm">{sec.label}</CardTitle>
                            <p className="text-[11px] text-muted-foreground">{sec.description}</p>
                          </div>
                        </div>
                        {limit > 0 && (
                          <Badge variant={percentage >= 100 ? "success" : percentage > 50 ? "warning" : "secondary"}>
                            {percentage >= 100 ? "Maxed" : `${percentage.toFixed(0)}%`}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {limit > 0 && (
                        <>
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Used: {fmt(Math.min(used, limit))}</span>
                            <span>Limit: {fmt(limit)}</span>
                          </div>
                          <Progress value={percentage} />
                          {remaining > 0 && (
                            <p className="text-[11px] text-muted-foreground mt-1.5">
                              <span className="text-warning font-medium">{fmt(remaining)}</span> remaining
                            </p>
                          )}
                        </>
                      )}
                      {summary?.entries.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          {summary.entries.map((entry) => (
                            <div key={entry.id} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/50">
                              <span className="text-xs text-foreground">{entry.description}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-foreground">{fmt(entry.amount)}</span>
                                {!entry.id.startsWith("auto-") && (
                                  <button onClick={() => removeEntry(entry.id)} className="text-muted-foreground hover:text-danger transition-colors">
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* HRA Calculator */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-brand" />
                <CardTitle>HRA Exemption Calculator</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">Monthly Basic</label>
                  <Input type="number" placeholder="50000" value={hra.basicSalary} onChange={(e) => setHra({ ...hra, basicSalary: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">Monthly HRA Received</label>
                  <Input type="number" placeholder="20000" value={hra.hraReceived} onChange={(e) => setHra({ ...hra, hraReceived: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">Monthly Rent Paid</label>
                  <Input type="number" placeholder="25000" value={hra.rentPaid} onChange={(e) => setHra({ ...hra, rentPaid: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">Metro City?</label>
                  <div className="flex gap-2 mt-1.5">
                    <button onClick={() => setHra({ ...hra, isMetro: true })} className={cn("px-3 py-1.5 rounded-md text-xs font-medium", hra.isMetro ? "bg-brand text-white" : "bg-muted text-muted-foreground")}>Yes</button>
                    <button onClick={() => setHra({ ...hra, isMetro: false })} className={cn("px-3 py-1.5 rounded-md text-xs font-medium", !hra.isMetro ? "bg-brand text-white" : "bg-muted text-muted-foreground")}>No</button>
                  </div>
                </div>
              </div>
              {hraExemption && (
                <div className="p-4 rounded-xl bg-success/5 border border-success/20">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <span className="text-sm font-semibold text-foreground">HRA Exemption: {fmt(hraExemption.exempt)}/year</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                    <div><p className="font-medium">Actual HRA</p><p>{fmt(hraExemption.components.a)}</p></div>
                    <div><p className="font-medium">Rent - 10% Basic</p><p>{fmt(hraExemption.components.b)}</p></div>
                    <div><p className="font-medium">{hra.isMetro ? "50%" : "40%"} of Basic</p><p>{fmt(hraExemption.components.c)}</p></div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">Minimum of above = {fmt(hraExemption.exempt)} (tax exempt)</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Old Regime Slab Breakdown */}
          {gross > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Old Regime — Tax Slab Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm py-2 border-b border-border">
                    <span className="text-muted-foreground">Standard Deduction</span>
                    <span className="font-medium text-success">-{fmt(oldRegimeCalc.standardDed)}</span>
                  </div>
                  <div className="flex justify-between text-sm py-2 border-b border-border">
                    <span className="text-muted-foreground">Section Deductions (80C/80D/80CCD)</span>
                    <span className="font-medium text-success">-{fmt(oldRegimeCalc.sectionDeductions)}</span>
                  </div>
                  {oldRegimeCalc.hraAmount > 0 && (
                    <div className="flex justify-between text-sm py-2 border-b border-border">
                      <span className="text-muted-foreground">HRA Exemption</span>
                      <span className="font-medium text-success">-{fmt(oldRegimeCalc.hraAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm py-2 border-b border-border font-medium">
                    <span>Taxable Income</span>
                    <span>{fmt(oldRegimeCalc.taxableIncome)}</span>
                  </div>
                  {OLD_SLABS.map((slab) => {
                    if (oldRegimeCalc.taxableIncome <= slab.from) return null;
                    const amount = Math.min(oldRegimeCalc.taxableIncome, slab.to) - slab.from;
                    const tax = Math.round(amount * (slab.rate / 100));
                    return (
                      <div key={slab.from} className="flex justify-between text-xs py-1.5 text-muted-foreground">
                        <span>₹{(slab.from / 100000).toFixed(1)}L – {slab.to === Infinity ? "above" : `₹${(slab.to / 100000).toFixed(1)}L`} @ {slab.rate}%</span>
                        <span className="text-foreground font-medium">{fmt(tax)}</span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between text-sm pt-2 border-t border-border font-medium">
                    <span>Tax before rebate</span>
                    <span>{fmt(oldRegimeCalc.grossTax)}</span>
                  </div>
                  {oldRegimeCalc.rebate > 0 && (
                    <div className="flex justify-between text-sm text-success">
                      <span>Section 87A Rebate</span>
                      <span>-{fmt(oldRegimeCalc.rebate)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base pt-2 border-t border-border font-bold">
                    <span>Final Tax</span>
                    <span className="text-danger">{fmt(oldRegimeCalc.finalTax)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Tips */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              {regime === "new" ? (
                <>
                  <p><strong>New Regime:</strong> No need to invest in tax-saving instruments. Effective zero tax up to ~₹12.75L gross salary (₹12L taxable after ₹75K standard deduction).</p>
                  <p>Only NPS employer contribution (80CCD(2), up to 14% of salary) provides additional deduction in this regime.</p>
                </>
              ) : (
                <>
                  <p><strong>Old Regime Tip:</strong> Max out 80C (₹1.5L) + 80CCD(1B) (₹50K) + 80D (₹25K) = ₹2.25L deductions = ~₹67,500 saved at 30% slab.</p>
                  <p>ELSS has only 3-year lock-in (shortest among 80C options). Consider NPS for extra ₹50K deduction.</p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Entry Modal (Old Regime only) */}
      {showAdd && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md mx-4 rounded-2xl bg-card border border-border shadow-2xl p-6">
            <h3 className="text-lg font-bold text-foreground mb-4">Add Tax Deduction</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Section</label>
                <select
                  value={form.section}
                  onChange={(e) => setForm({ ...form, section: e.target.value as OldSectionKey })}
                  className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm text-foreground"
                >
                  {(Object.entries(OLD_SECTIONS) as [OldSectionKey, typeof OLD_SECTIONS[OldSectionKey]][]).map(([key, sec]) => (
                    <option key={key} value={key}>{sec.label} (Limit: {sec.limit > 0 ? `₹${sec.limit.toLocaleString("en-IN")}` : "N/A"})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. PPF Contribution" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Amount (₹)</label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted">Cancel</button>
                <button onClick={addEntry} className="flex-1 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90">Add</button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
