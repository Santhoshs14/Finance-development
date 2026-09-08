"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import ExportBar from "@/components/ExportBar";
import { useData } from "@/providers/DataProvider";
import { taxAPI } from "@/services/api";
import { fmt } from "@/utils/format";
import { cn } from "@/lib/utils";
import { compareRegimes } from "@/utils/taxRegime";
import {
  getRecentFinancialYears,
  getFinancialYearForDate,
  isInFinancialYear,
  type FinancialYear,
} from "@/utils/financialYear";
import {
  applyFifoRedemption,
  rollupFy,
  type CapitalGainRow,
  type AssetClass,
} from "@/utils/capitalGains";
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
  TrendingUp,
} from "lucide-react";

type Regime = "new" | "old";

interface TaxEntry {
  id: string;
  description: string;
  amount: number;
  section: string;
}

interface CapitalGainSale {
  id: string;
  asset: string;
  assetClass: AssetClass;
  buyDate: string;
  sellDate: string;
  units: number;
  buyPrice: number;
  sellPrice: number;
}

const OLD_SECTIONS = {
  "80C": { label: "Section 80C", limit: 150000, icon: Shield, color: "#0080ff", description: "PPF, ELSS, Life Insurance, EPF, NSC, Tax-saving FDs, etc." },
  "80D": { label: "Section 80D", limit: 25000, icon: Heart, color: "#ef4444", description: "Health Insurance Premiums (self & family)" },
  "80D_parents": { label: "80D (Parents)", limit: 50000, icon: Heart, color: "#f97316", description: "Parents' health insurance (₹50K if senior citizen)" },
  "80CCD": { label: "Section 80CCD(1B)", limit: 50000, icon: PiggyBank, color: "#10b981", description: "NPS contribution (additional ₹50K beyond 80C)" },
  HRA: { label: "HRA Exemption", limit: 0, icon: Building2, color: "#8b5cf6", description: "House Rent Allowance tax benefit" },
} as const;

type OldSectionKey = keyof typeof OLD_SECTIONS;

const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  equity_mf: "Equity MF",
  equity: "Stocks",
  debt_mf: "Debt MF",
  gold: "Gold",
};

export default function TaxPage() {
  const { transactions } = useData();
  const queryClient = useQueryClient();

  // ── Financial-year selector ──
  const recentFYs = useMemo<FinancialYear[]>(() => getRecentFinancialYears(5), []);
  const [fyKey, setFyKey] = useState(() => getFinancialYearForDate(new Date()).fyKey);
  const selectedFY = useMemo(
    () => recentFYs.find((f) => f.fyKey === fyKey) ?? recentFYs[0],
    [recentFYs, fyKey]
  );

  const [regime, setRegime] = useState<Regime>("new");
  const [grossIncome, setGrossIncome] = useState("");
  const [npsEmployer, setNpsEmployer] = useState("");
  const [entries, setEntries] = useState<TaxEntry[]>([]);
  const [hra, setHra] = useState({ basicSalary: "", hraReceived: "", rentPaid: "", isMetro: true });
  const [capitalGains, setCapitalGains] = useState<CapitalGainSale[]>([]);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ description: "", amount: "", section: "80C" as OldSectionKey });
  const [showAddSale, setShowAddSale] = useState(false);
  const [saleForm, setSaleForm] = useState({
    asset: "", assetClass: "equity_mf" as AssetClass, buyDate: "", sellDate: "", units: "", buyPrice: "", sellPrice: "",
  });

  // ── Load the saved profile for the selected FY (Firestore) ──
  const { data: profileData } = useQuery({
    queryKey: ["tax-profile", fyKey],
    queryFn: () => taxAPI.get(fyKey),
  });

  // Hydrate local state when the profile for a given FY arrives. The ref
  // guards the autosave effect from firing on the hydration setState.
  const hydratedFyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!profileData) return;
    const p = profileData.profile as Record<string, unknown> | null;
    const h = (p?.hra ?? {}) as { basicSalary?: number; hraReceived?: number; rentPaid?: number; isMetro?: boolean };
    setRegime((p?.regime as Regime) ?? "new");
    setGrossIncome(p?.grossIncome != null ? String(p.grossIncome) : "");
    setNpsEmployer(p?.npsEmployer != null ? String(p.npsEmployer) : "");
    setEntries((p?.entries as TaxEntry[]) ?? []);
    setHra({
      basicSalary: h.basicSalary != null ? String(h.basicSalary) : "",
      hraReceived: h.hraReceived != null ? String(h.hraReceived) : "",
      rentPaid: h.rentPaid != null ? String(h.rentPaid) : "",
      isMetro: h.isMetro ?? true,
    });
    setCapitalGains((p?.capitalGains as CapitalGainSale[]) ?? []);
    hydratedFyRef.current = fyKey;
  }, [profileData, fyKey]);

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => taxAPI.save(fyKey, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tax-profile", fyKey] }),
  });

  // ── Debounced autosave to Firestore (after the profile has hydrated) ──
  useEffect(() => {
    if (hydratedFyRef.current !== fyKey) return;
    const t = setTimeout(() => {
      saveMutation.mutate({
        regime,
        grossIncome: parseFloat(grossIncome) || 0,
        npsEmployer: parseFloat(npsEmployer) || 0,
        entries: entries.map((e) => ({ ...e, amount: Number(e.amount) || 0 })),
        hra: {
          basicSalary: parseFloat(hra.basicSalary) || 0,
          hraReceived: parseFloat(hra.hraReceived) || 0,
          rentPaid: parseFloat(hra.rentPaid) || 0,
          isMetro: hra.isMetro,
        },
        capitalGains,
      });
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regime, grossIncome, npsEmployer, entries, hra, capitalGains, fyKey]);

  const addEntry = () => {
    if (!form.description || !form.amount) return;
    setEntries((prev) => [
      ...prev,
      { id: Date.now().toString(36), description: form.description, amount: parseFloat(form.amount) || 0, section: form.section },
    ]);
    setForm({ description: "", amount: "", section: "80C" });
    setShowAdd(false);
  };

  const removeEntry = (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id));

  const addSale = () => {
    const units = parseFloat(saleForm.units) || 0;
    if (!saleForm.asset || !saleForm.buyDate || !saleForm.sellDate || units <= 0) return;
    setCapitalGains((prev) => [
      ...prev,
      {
        id: Date.now().toString(36),
        asset: saleForm.asset,
        assetClass: saleForm.assetClass,
        buyDate: saleForm.buyDate,
        sellDate: saleForm.sellDate,
        units,
        buyPrice: parseFloat(saleForm.buyPrice) || 0,
        sellPrice: parseFloat(saleForm.sellPrice) || 0,
      },
    ]);
    setSaleForm({ asset: "", assetClass: "equity_mf", buyDate: "", sellDate: "", units: "", buyPrice: "", sellPrice: "" });
    setShowAddSale(false);
  };

  const removeSale = (id: string) => setCapitalGains((prev) => prev.filter((s) => s.id !== id));

  // Auto-detect investments for Old Regime 80C (within the selected FY)
  const autoDetected = useMemo(() => {
    const detected: TaxEntry[] = [];
    if (!selectedFY) return detected;
    const investmentTxns = transactions.filter(
      (t) => t.category === "Investment" && t.amount < 0 && isInFinancialYear(t.date, selectedFY)
    );
    const totalInvested = investmentTxns.reduce((s, t) => s + Math.abs(t.amount), 0);
    if (totalInvested > 0) {
      detected.push({ id: "auto-investment", description: "Investments (auto-detected)", amount: totalInvested, section: "80C" });
    }
    return detected;
  }, [transactions, selectedFY]);

  const allEntries = useMemo(() => [...entries, ...autoDetected], [entries, autoDetected]);

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

  // HRA exemption (Old Regime)
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

  const gross = parseFloat(grossIncome) || 0;
  const npsEmp = parseFloat(npsEmployer) || 0;

  // Section deductions, each capped at its own limit (old regime).
  const sectionDeductions = useMemo(() => {
    let total = 0;
    (Object.keys(OLD_SECTIONS) as OldSectionKey[]).forEach((key) => {
      const sec = OLD_SECTIONS[key];
      const used = sectionSummary[key]?.total || 0;
      total += sec.limit > 0 ? Math.min(used, sec.limit) : 0;
    });
    return total;
  }, [sectionSummary]);

  // ── Single source of truth: the taxRegime util computes both regimes. ──
  // Per-section caps are applied above and passed via `deductionOther` so the
  // util doesn't re-cap them; HRA + employer NPS go through their own fields.
  const comparison = useMemo(
    () =>
      compareRegimes({
        grossIncome: gross,
        deductionOther: sectionDeductions,
        hraExemption: hraExemption?.exempt || 0,
        employerNps80CCD2: npsEmp,
      }),
    [gross, sectionDeductions, hraExemption, npsEmp]
  );

  const newCalc = comparison.newRegime;
  const oldCalc = comparison.oldRegime;
  const activeCalc = regime === "new" ? newCalc : oldCalc;
  const betterRegime = comparison.recommended;
  const savings = comparison.savings;

  // ── Capital gains (FIFO) for the selected FY ──
  const capitalGainsResult = useMemo(() => {
    if (!selectedFY) return null;
    const rows: CapitalGainRow[] = [];
    for (const sale of capitalGains) {
      const lots = [{ date: sale.buyDate, units: sale.units, pricePerUnit: sale.buyPrice }];
      const r = applyFifoRedemption(sale.asset, sale.assetClass, lots, {
        date: sale.sellDate,
        units: sale.units,
        pricePerUnit: sale.sellPrice,
      });
      rows.push(...r);
    }
    const inFy = rows.filter((r) => isInFinancialYear(r.soldOn, selectedFY));
    if (inFy.length === 0) return null;
    return rollupFy(inFy);
  }, [capitalGains, selectedFY]);

  const inputClass = "w-full rounded-lg px-3 py-2 text-sm border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40";

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header + FY + Regime Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Income Tax Calculator</h1>
          <p className="text-sm text-muted-foreground">{selectedFY?.label} · New Regime (default) or Old Regime</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={fyKey}
            onChange={(e) => setFyKey(e.target.value)}
            className="h-9 px-3 rounded-lg border border-input bg-card text-sm font-medium text-foreground"
            aria-label="Financial year"
          >
            {recentFYs.map((fy) => (
              <option key={fy.fyKey} value={fy.fyKey}>{fy.fyKey.replace("FY", "FY ")}</option>
            ))}
          </select>
          <ExportBar elementId="tax-report" filename={`tax-${fyKey}-${regime}-regime`} title={`Tax Calculation ${selectedFY?.fyKey}`} />
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
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">NPS Employer Contribution (₹/year) <span className="text-muted-foreground/60">— 80CCD(2)</span></label>
                <Input type="number" value={npsEmployer} onChange={(e) => setNpsEmployer(e.target.value)} placeholder="0" className="text-lg font-semibold" />
              </div>
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
                    <p className="text-[11px] font-medium text-muted-foreground uppercase">Total Tax</p>
                    <p className="text-xl font-bold text-danger">{fmt(activeCalc.totalTax)}</p>
                    {activeCalc.rebate87A > 0 && <p className="text-[10px] text-success">87A rebate: -{fmt(activeCalc.rebate87A)}</p>}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-3">
                  Effective rate {activeCalc.effectiveRate.toFixed(1)}% · includes 4% cess{activeCalc.surcharge > 0 ? " + surcharge" : ""}
                </p>
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
                    New: {fmt(newCalc.totalTax)} · Old: {fmt(oldCalc.totalTax)}
                  </p>
                </div>
                <Badge variant={betterRegime === regime ? "success" : "warning"}>
                  {betterRegime === regime ? "You're on the better regime" : `Switch to ${betterRegime === "new" ? "New" : "Old"} Regime`}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Slab breakdown (active regime) */}
        {gross > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{regime === "new" ? "New" : "Old"} Regime — Tax Slab Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm py-2 border-b border-border font-medium">
                  <span className="text-foreground">Total Deductions</span>
                  <span className="text-success">-{fmt(activeCalc.totalDeductions)}</span>
                </div>
                <div className="flex justify-between text-sm py-2 border-b border-border font-medium">
                  <span className="text-foreground">Taxable Income</span>
                  <span className="text-foreground">{fmt(activeCalc.taxableIncome)}</span>
                </div>
                {activeCalc.slabBreakdown.map((row, i) => (
                  <div key={i} className="flex justify-between text-xs py-1.5 text-muted-foreground">
                    <span>{row.slab} @ {row.rate}</span>
                    <span className="text-foreground font-medium">{fmt(row.tax)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm pt-2 border-t border-border font-medium">
                  <span>Tax before rebate</span>
                  <span>{fmt(activeCalc.taxBeforeRebate)}</span>
                </div>
                {activeCalc.rebate87A > 0 && (
                  <div className="flex justify-between text-sm text-success">
                    <span>Section 87A Rebate</span>
                    <span>-{fmt(activeCalc.rebate87A)}</span>
                  </div>
                )}
                {activeCalc.surcharge > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Surcharge</span>
                    <span>+{fmt(activeCalc.surcharge)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Health &amp; Education Cess (4%)</span>
                  <span>+{fmt(activeCalc.cess)}</span>
                </div>
                <div className="flex justify-between text-base pt-2 border-t border-border font-bold">
                  <span>Total Tax</span>
                  <span className="text-danger">{fmt(activeCalc.totalTax)}</span>
                </div>
              </div>
              {regime === "new" && (
                <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    <strong>New Regime:</strong> Limited deductions — only Standard Deduction (₹75K) and NPS Employer 80CCD(2) up to 14% of salary. Section 87A rebate of ₹60,000 for taxable income ≤ ₹12L (effectively zero tax up to ~₹12.75L gross).
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* OLD REGIME — Deductions + HRA */}
        {regime === "old" && (
          <>
            <div className="flex justify-end">
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Deduction
              </button>
            </div>

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
          </>
        )}

        {/* CAPITAL GAINS (FIFO) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-brand" />
                <CardTitle>Capital Gains — {selectedFY?.fyKey}</CardTitle>
              </div>
              <button
                onClick={() => setShowAddSale(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-medium hover:bg-brand/90 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Sale
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {!capitalGainsResult ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No asset sales recorded for this financial year. Add a sale to compute STCG/LTCG via FIFO.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-muted/40">
                    <p className="text-[10px] uppercase text-muted-foreground">STCG (Equity)</p>
                    <p className="text-sm font-bold text-foreground">{fmt(capitalGainsResult.stcgEquity)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/40">
                    <p className="text-[10px] uppercase text-muted-foreground">LTCG (Equity)</p>
                    <p className="text-sm font-bold text-foreground">{fmt(capitalGainsResult.ltcgEquity)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/40">
                    <p className="text-[10px] uppercase text-muted-foreground">STCG (Debt/Gold)</p>
                    <p className="text-sm font-bold text-foreground">{fmt(capitalGainsResult.stcgDebtGold)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/40">
                    <p className="text-[10px] uppercase text-muted-foreground">LTCG (Debt/Gold)</p>
                    <p className="text-sm font-bold text-foreground">{fmt(capitalGainsResult.ltcgDebtGold)}</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {capitalGains
                    .filter((s) => selectedFY && isInFinancialYear(s.sellDate, selectedFY))
                    .map((s) => {
                      const gain = (s.sellPrice - s.buyPrice) * s.units;
                      return (
                        <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/40">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{s.asset}</p>
                            <p className="text-[10px] text-muted-foreground">{ASSET_CLASS_LABELS[s.assetClass]} · {s.buyDate} → {s.sellDate}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={cn("text-xs font-semibold", gain >= 0 ? "text-success" : "text-danger")}>{fmt(gain)}</span>
                            <button onClick={() => removeSale(s.id)} className="text-muted-foreground hover:text-danger transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-sm font-medium text-foreground">Estimated capital-gains tax</span>
                  <span className="text-base font-bold text-danger">{fmt(capitalGainsResult.estimatedTax.total)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  LTCG equity uses the ₹1.25L annual exemption @ 12.5%. STCG equity @ 20%. STCG on debt/gold is taxed at your slab rate (add it to income above).
                </p>
              </div>
            )}
          </CardContent>
        </Card>

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
      </div>

      {/* Add Deduction Modal (Old Regime) */}
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
                  className={inputClass}
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

      {/* Add Capital-Gain Sale Modal */}
      {showAddSale && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowAddSale(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md mx-4 rounded-2xl bg-card border border-border shadow-2xl p-6">
            <h3 className="text-lg font-bold text-foreground mb-4">Record Asset Sale</h3>
            <div className="space-y-3">
              <Input value={saleForm.asset} onChange={(e) => setSaleForm({ ...saleForm, asset: e.target.value })} placeholder="Asset name (e.g. Nifty 50 Index Fund)" />
              <select
                value={saleForm.assetClass}
                onChange={(e) => setSaleForm({ ...saleForm, assetClass: e.target.value as AssetClass })}
                className={inputClass}
              >
                {(Object.entries(ASSET_CLASS_LABELS) as [AssetClass, string][]).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">Buy date</label>
                  <Input type="date" value={saleForm.buyDate} onChange={(e) => setSaleForm({ ...saleForm, buyDate: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">Sell date</label>
                  <Input type="date" value={saleForm.sellDate} onChange={(e) => setSaleForm({ ...saleForm, sellDate: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">Units</label>
                  <Input type="number" value={saleForm.units} onChange={(e) => setSaleForm({ ...saleForm, units: e.target.value })} placeholder="100" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">Buy price</label>
                  <Input type="number" value={saleForm.buyPrice} onChange={(e) => setSaleForm({ ...saleForm, buyPrice: e.target.value })} placeholder="0" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">Sell price</label>
                  <Input type="number" value={saleForm.sellPrice} onChange={(e) => setSaleForm({ ...saleForm, sellPrice: e.target.value })} placeholder="0" />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowAddSale(false)} className="flex-1 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted">Cancel</button>
                <button onClick={addSale} className="flex-1 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90">Add Sale</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
