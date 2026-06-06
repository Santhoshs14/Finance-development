"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useData } from "@/providers/DataProvider";
import { profileAPI, categoriesAPI, importAPI } from "@/services/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Separator } from "@/components/ui";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  Sun, Moon, Monitor, Calendar, Plus, Trash2, Download, LogOut,
  User, Settings2, Palette, Upload, AlertTriangle, IndianRupee, DollarSign, Euro, RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";

const TABS = [
  { key: "profile", label: "Profile", icon: User },
  { key: "financial", label: "Financial", icon: Settings2 },
  { key: "categories", label: "Categories", icon: Palette },
  { key: "data", label: "Data", icon: Download },
  { key: "danger", label: "Danger Zone", icon: AlertTriangle },
] as const;

type Tab = (typeof TABS)[number]["key"];

const CURRENCIES = [
  { code: "INR", symbol: "₹", label: "Indian Rupee", icon: IndianRupee },
  { code: "USD", symbol: "$", label: "US Dollar", icon: DollarSign },
  { code: "EUR", symbol: "€", label: "Euro", icon: Euro },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <div className="max-w-4xl space-y-5">
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/50 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
              tab === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
      >
        {tab === "profile" && <ProfileTab />}
        {tab === "financial" && <FinancialTab />}
        {tab === "categories" && <CategoriesTab />}
        {tab === "data" && <DataTab />}
        {tab === "danger" && <DangerTab />}
      </motion.div>
    </div>
  );
}

/* ─── Profile Tab ────────────────────────────────────────────── */
function ProfileTab() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [name, setName] = useState(user?.displayName || "");
  const [saving, setSaving] = useState(false);

  const displayName = user?.displayName || user?.email?.split("@")[0] || "User";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await profileAPI.update({ displayName: name.trim() });
      toast.success("Name updated");
    } catch { toast.error("Failed to update name"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand to-accent flex items-center justify-center text-white font-bold text-lg">{initials}</div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">Display Name</p>
              <div className="flex gap-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" placeholder="Your name" />
                <Button size="sm" onClick={handleSaveName} disabled={saving || name.trim() === displayName}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
          <Separator />
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="text-sm font-medium text-foreground">{user?.email}</p>
          </div>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
        <CardContent className="flex gap-2 flex-wrap">
          {([
            { key: "light", icon: Sun, label: "Light" },
            { key: "dark", icon: Moon, label: "Dark" },
            { key: "system", icon: Monitor, label: "System" },
          ] as const).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTheme(key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all",
                theme === key
                  ? "border-brand bg-brand/5 text-brand ring-2 ring-brand/20"
                  : "border-border text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Sign Out */}
      <SignOutButton />
    </div>
  );
}

/* ─── Financial Tab ──────────────────────────────────────────── */
function FinancialTab() {
  const { cycleStartDay, monthlySalary, currency } = useData();
  const [cycleDay, setCycleDay] = useState(cycleStartDay || 25);
  const [salary, setSalary] = useState(String(monthlySalary || ""));
  const [selectedCurrency, setSelectedCurrency] = useState(currency || "INR");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const day = parseInt(String(cycleDay), 10);
    if (isNaN(day) || day < 1 || day > 28) { toast.error("Cycle day must be 1-28"); return; }
    setSaving(true);
    try {
      await profileAPI.update({
        cycleStartDay: day,
        monthlySalary: Number(salary) || 0,
        currency: selectedCurrency,
      });
      toast.success("Financial settings saved");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calendar className="w-4 h-4 text-brand" /> Financial Cycle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Cycle Start Day</p>
            <p className="text-xs text-muted-foreground mb-2">Your monthly financial cycle starts on this day (1–28)</p>
            <Input type="number" min={1} max={28} value={cycleDay} onChange={(e) => setCycleDay(parseInt(e.target.value))} className="w-24" />
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Monthly Salary</p>
            <p className="text-xs text-muted-foreground mb-2">Used to calculate savings rate and budget recommendations</p>
            <div className="relative w-48">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
              <Input type="number" value={salary} onChange={(e) => setSalary(e.target.value)} className="pl-7" placeholder="50000" />
            </div>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Currency</p>
            <p className="text-xs text-muted-foreground mb-2">Display currency for amounts throughout the app</p>
            <div className="flex gap-2 flex-wrap">
              {CURRENCIES.map(({ code, symbol, label, icon: Icon }) => (
                <button
                  key={code}
                  onClick={() => setSelectedCurrency(code)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all",
                    selectedCurrency === code
                      ? "border-brand bg-brand/5 text-brand ring-2 ring-brand/20"
                      : "border-border text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon className="w-4 h-4" /> {symbol} {label}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="mt-2">
            {saving ? "Saving..." : "Save Financial Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Categories Tab ─────────────────────────────────────────── */
function CategoriesTab() {
  const { categories } = useData();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [confirmState, setConfirmState] = useState<{ open: boolean; id?: string; name?: string }>({ open: false });

  const addMutation = useMutation({
    mutationFn: (data: { name: string; color: string }) => categoriesAPI.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["categories"] }); toast.success("Category added"); setNewName(""); },
    onError: () => toast.error("Failed to add category"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoriesAPI.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["categories"] }); toast.success("Category deleted"); },
    onError: () => toast.error("Failed to delete"),
  });

  const PRESET_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#64748b"];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette className="w-4 h-4 text-brand" /> Categories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new */}
          <div className="flex items-end gap-3 pb-4 border-b border-border">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">Name</p>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New category" className="h-9" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Color</p>
              <div className="flex gap-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={cn("w-6 h-6 rounded-full border-2 transition-transform", newColor === c ? "border-foreground scale-125" : "border-transparent")}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => { if (newName.trim()) addMutation.mutate({ name: newName.trim(), color: newColor }); }}
              disabled={!newName.trim()}
              className="gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>

          {/* List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/50">
                <div className="flex items-center gap-2.5">
                  <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: cat.color }} />
                  <span className="text-sm font-medium text-foreground">{cat.name}</span>
                </div>
                <button
                  onClick={() => setConfirmState({ open: true, id: cat.id, name: cat.name })}
                  className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmState.open}
        title={`Delete "${confirmState.name}"?`}
        message="Transactions using this category will keep their label but won't be grouped."
        confirmColor="danger"
        onConfirm={() => { if (confirmState.id) deleteMutation.mutate(confirmState.id); setConfirmState({ open: false }); }}
        onCancel={() => setConfirmState({ open: false })}
      />
    </div>
  );
}

/* ─── Data Tab ───────────────────────────────────────────────── */
type ImportStep = "upload" | "map" | "preview" | "done";
const REQUIRED_FIELDS = ["date", "amount", "category"] as const;
const OPTIONAL_FIELDS = ["notes", "payment_type", "type", "account"] as const;
const _ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS, "skip"] as const;
type MappableField = (typeof _ALL_FIELDS)[number];

function DataTab() {
  const { transactions, accounts, categories: _categories } = useData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  // CSV Import state
  const [step, setStep] = useState<ImportStep>("upload");
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [columnMap, setColumnMap] = useState<Record<number, MappableField>>({});
  const [importResult, setImportResult] = useState<{ success: number; duplicates: number; errors: number } | null>(null);

  const handleExportCSV = () => {
    if (!transactions.length) { toast.error("No transactions to export"); return; }
    const headers = ["Date", "Amount", "Type", "Category", "Notes", "Payment Type"];
    const rows = transactions.map((t) => [t.date, t.amount, t.type, `"${(t.category || "").replace(/"/g, '""')}"`, `"${(t.notes || t.description || "").replace(/"/g, '""')}"`, t.payment_type || ""].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wealthflow_export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported!");
  };

  const parseCSV = (text: string): { headers: string[]; rows: string[][] } => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };
    const parse = (line: string) => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') { inQuotes = !inQuotes; continue; }
        if (char === "," && !inQuotes) { result.push(current.trim()); current = ""; continue; }
        current += char;
      }
      result.push(current.trim());
      return result;
    };
    return { headers: parse(lines[0]), rows: lines.slice(1).map(parse) };
  };

  const handleFileSelect = useCallback(async (file: File) => {
    const validTypes = ["text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error("Please upload an Excel or CSV file");
      return;
    }

    // For CSV, parse client-side for mapping
    if (file.name.endsWith(".csv") || file.type === "text/csv") {
      const text = await file.text();
      const { headers, rows } = parseCSV(text);
      if (headers.length === 0) { toast.error("Empty or invalid CSV"); return; }
      setParsedHeaders(headers);
      setParsedRows(rows);

      // Auto-detect column mapping
      const autoMap: Record<number, MappableField> = {};
      headers.forEach((h, i) => {
        const lower = h.toLowerCase().replace(/[^a-z]/g, "");
        if (lower.includes("date") || lower === "time") autoMap[i] = "date";
        else if (lower.includes("amount") || lower.includes("value") || lower.includes("debit") || lower.includes("credit")) autoMap[i] = "amount";
        else if (lower.includes("category") || lower.includes("cat")) autoMap[i] = "category";
        else if (lower.includes("note") || lower.includes("description") || lower.includes("narration") || lower.includes("remarks") || lower.includes("particular")) autoMap[i] = "notes";
        else if (lower.includes("payment") || lower.includes("mode") || lower.includes("method")) autoMap[i] = "payment_type";
        else if (lower.includes("type")) autoMap[i] = "type";
        else if (lower.includes("account")) autoMap[i] = "account";
        else autoMap[i] = "skip";
      });
      setColumnMap(autoMap);
      setStep("map");
    } else {
      // Excel: direct upload (server handles parsing)
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await importAPI.uploadExcel(formData);
        toast.success(`Imported ${res.count || 0} transactions`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Import failed");
      } finally {
        setUploading(false);
      }
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const canProceedToPreview = useMemo(() => {
    const mapped = Object.values(columnMap);
    return mapped.includes("date") && mapped.includes("amount");
  }, [columnMap]);

  const previewRows = useMemo(() => {
    if (step !== "preview") return [];
    return parsedRows.slice(0, 10).map((row) => {
      const record: Record<string, string> = {};
      Object.entries(columnMap).forEach(([idx, field]) => {
        if (field !== "skip") record[field] = row[parseInt(idx)] || "";
      });
      return record;
    });
  }, [step, parsedRows, columnMap]);

  const handleImport = async () => {
    setUploading(true);
    const existingDates = new Set(transactions.map((t) => `${t.date}_${t.amount}_${t.category}`));
    let success = 0, duplicates = 0, errors = 0;

    const batch: Record<string, unknown>[] = [];
    for (const row of parsedRows) {
      const record: Record<string, string> = {};
      Object.entries(columnMap).forEach(([idx, field]) => {
        if (field !== "skip") record[field] = row[parseInt(idx)] || "";
      });

      // Validate & transform
      const date = record.date;
      const amount = parseFloat(record.amount?.replace(/[^0-9.\-]/g, "") || "0");
      if (!date || isNaN(amount) || amount === 0) { errors++; continue; }

      // Normalize date to YYYY-MM-DD
      let normalizedDate = date;
      const dateFormats = [
        /^(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
        /^(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
        /^(\d{2})-(\d{2})-(\d{4})/, // DD-MM-YYYY
      ];
      if (dateFormats[1].test(date)) {
        const [, d, m, y] = date.match(dateFormats[1])!;
        normalizedDate = `${y}-${m}-${d}`;
      } else if (dateFormats[2].test(date)) {
        const [, d, m, y] = date.match(dateFormats[2])!;
        normalizedDate = `${y}-${m}-${d}`;
      }

      const category = record.category || "Other";
      const key = `${normalizedDate}_${amount}_${category}`;
      if (existingDates.has(key)) { duplicates++; continue; }
      existingDates.add(key);

      batch.push({
        date: normalizedDate,
        amount,
        category,
        notes: record.notes || "",
        payment_type: record.payment_type || "UPI",
        type: amount > 0 ? "income" : "expense",
        account_id: accounts[0]?.id || null,
      });
      success++;
    }

    try {
      // Upload in batches of 50
      for (let i = 0; i < batch.length; i += 50) {
        const chunk = batch.slice(i, i + 50);
        await importAPI.uploadBatch(chunk);
      }
      setImportResult({ success, duplicates, errors });
      setStep("done");
      toast.success(`Imported ${success} transactions`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setUploading(false);
    }
  };

  const resetImport = () => {
    setStep("upload");
    setParsedHeaders([]);
    setParsedRows([]);
    setColumnMap({});
    setImportResult(null);
  };

  return (
    <div className="space-y-5">
      {/* Import */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="w-4 h-4 text-brand" /> Import Data</CardTitle></CardHeader>
        <CardContent>
          {step === "upload" && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                  dragOver ? "border-brand bg-brand/5" : "border-border hover:border-brand/50"
                )}
              >
                <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  {uploading ? "Uploading..." : "Drop CSV/Excel file here or click to browse"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">CSV files get column mapping. Excel files are imported directly.</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }}
              />
            </>
          )}

          {step === "map" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Map Columns</p>
                  <p className="text-xs text-muted-foreground">{parsedRows.length} rows detected. Map columns to fields (date & amount required).</p>
                </div>
                <button onClick={resetImport} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
              </div>
              <div className="space-y-2">
                {parsedHeaders.map((header, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    <span className="text-xs font-medium text-foreground w-32 truncate" title={header}>{header}</span>
                    <span className="text-xs text-muted-foreground truncate w-24" title={parsedRows[0]?.[idx]}>e.g. {parsedRows[0]?.[idx]?.slice(0, 20)}</span>
                    <select
                      value={columnMap[idx] || "skip"}
                      onChange={(e) => setColumnMap({ ...columnMap, [idx]: e.target.value as MappableField })}
                      className="ml-auto h-8 px-2 rounded-md border border-input bg-card text-xs text-foreground"
                    >
                      <option value="skip">Skip</option>
                      <option value="date">Date *</option>
                      <option value="amount">Amount *</option>
                      <option value="category">Category</option>
                      <option value="notes">Notes / Description</option>
                      <option value="payment_type">Payment Method</option>
                      <option value="type">Type (income/expense)</option>
                      <option value="account">Account</option>
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={resetImport}>Back</Button>
                <Button onClick={() => setStep("preview")} disabled={!canProceedToPreview}>Preview Import</Button>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Preview (first 10 rows)</p>
                  <p className="text-xs text-muted-foreground">{parsedRows.length} total rows will be imported</p>
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      {Object.keys(previewRows[0] || {}).map((key) => (
                        <th key={key} className="px-3 py-2 text-left font-medium text-muted-foreground">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-b border-border/50">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-3 py-1.5 text-foreground">{val?.slice(0, 30)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep("map")}>Back</Button>
                <Button onClick={handleImport} disabled={uploading}>
                  {uploading ? "Importing..." : `Import ${parsedRows.length} Rows`}
                </Button>
              </div>
            </div>
          )}

          {step === "done" && importResult && (
            <div className="space-y-3 text-center py-4">
              <div className="w-12 h-12 rounded-full bg-success/10 mx-auto flex items-center justify-center">
                <Download className="w-6 h-6 text-success" />
              </div>
              <p className="text-sm font-semibold text-foreground">Import Complete</p>
              <div className="flex justify-center gap-6 text-xs">
                <span className="text-success font-medium">{importResult.success} imported</span>
                <span className="text-warning font-medium">{importResult.duplicates} duplicates skipped</span>
                {importResult.errors > 0 && <span className="text-danger font-medium">{importResult.errors} errors</span>}
              </div>
              <Button variant="secondary" onClick={resetImport} className="mt-2">Import Another File</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Download className="w-4 h-4 text-brand" /> Export Data</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Button variant="outline" onClick={handleExportCSV} className="gap-2">
              <Download className="w-4 h-4" /> Export Transactions (CSV)
            </Button>
            <p className="text-xs text-muted-foreground mt-1">{transactions.length} transactions will be exported</p>
          </div>
          <Separator />
          <div>
            <Button variant="outline" onClick={async () => {
              try {
                const { auth } = await import("@/lib/firebase");
                const token = await auth.currentUser?.getIdToken();
                if (!token) { toast.error("Not authenticated"); return; }
                const res = await fetch("/api/export", { headers: { Authorization: `Bearer ${token}` } });
                if (!res.ok) throw new Error("Export failed");
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `wealthflow-backup-${new Date().toISOString().split("T")[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Full backup downloaded!");
              } catch { toast.error("Export failed"); }
            }} className="gap-2">
              <Download className="w-4 h-4" /> Download Full Backup (JSON)
            </Button>
            <p className="text-xs text-muted-foreground mt-1">All data: accounts, budgets, goals, investments, and more</p>
          </div>
        </CardContent>
      </Card>

      {/* Recalculate Aggregates */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><RefreshCw className="w-4 h-4 text-brand" /> Recalculate Data</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Recalculates all monthly summaries (savings rate, investment tracking) across your entire history. Use this after category changes or if numbers look off.
          </p>
          <Button
            variant="outline"
            className="gap-2"
            disabled={recalculating}
            onClick={async () => {
              setRecalculating(true);
              try {
                const { auth } = await import("@/lib/firebase");
                const token = await auth.currentUser?.getIdToken();
                if (!token) { toast.error("Not authenticated"); return; }
                const res = await fetch("/api/aggregates/recalculate-all", {
                  method: "POST",
                  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                });
                if (!res.ok) throw new Error("Recalculation failed");
                const data = await res.json();
                toast.success(`Recalculated ${data.cyclesUpdated} months (${data.totalTransactions} transactions)`);
              } catch {
                toast.error("Recalculation failed");
              } finally {
                setRecalculating(false);
              }
            }}
          >
            <RefreshCw className={`w-4 h-4 ${recalculating ? "animate-spin" : ""}`} />
            {recalculating ? "Recalculating..." : "Recalculate All Aggregates"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Danger Zone Tab ────────────────────────────────────────── */
function DangerTab() {
  const { signOut } = useAuth();
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") { toast.error("Type DELETE to confirm"); return; }
    setDeleting(true);
    try {
      await profileAPI.delete();
      toast.success("Account deleted");
      await signOut();
    } catch {
      toast.error("Failed to delete account");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="border-danger/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-danger">
            <AlertTriangle className="w-4 h-4" /> Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            These actions are irreversible. Proceed with extreme caution.
          </p>

          <Separator />

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">Delete Account</p>
              <p className="text-xs text-muted-foreground">
                Permanently deletes your account, all transactions, accounts, categories, investments, goals, and all other data.
              </p>
            </div>

            {!showDelete ? (
              <Button variant="outline" onClick={() => setShowDelete(true)} className="text-danger border-danger/30 hover:bg-danger/5">
                Delete My Account
              </Button>
            ) : (
              <div className="space-y-3 p-4 rounded-xl border border-danger/30 bg-danger/5">
                <p className="text-sm font-medium text-danger">Type DELETE to confirm:</p>
                <Input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="DELETE"
                  className="max-w-xs border-danger/30"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirm !== "DELETE" || deleting}
                    className="bg-danger text-white hover:bg-danger/90"
                  >
                    {deleting ? "Deleting..." : "Permanently Delete Account"}
                  </Button>
                  <Button variant="ghost" onClick={() => { setShowDelete(false); setDeleteConfirm(""); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sign Out */}
      <SignOutButton />
    </div>
  );
}

/* ─── Shared Sign Out ────────────────────────────────────────── */
function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <Button variant="outline" onClick={signOut} className="w-full gap-2 text-danger border-danger/20 hover:bg-danger/5 hover:text-danger">
      <LogOut className="w-4 h-4" /> Sign Out
    </Button>
  );
}
