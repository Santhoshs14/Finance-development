"use client";

import { useState, useMemo, useEffect } from "react";
import { useData } from "@/providers/DataProvider";
import { useAuth } from "@/providers/AuthProvider";
import { budgetSnapshotsAPI, profileAPI, categoriesAPI } from "@/services/api";
import { getCycleDayInfo, getRecentFinancialMonths } from "@/utils/financialMonth";
import { fmt } from "@/utils/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Progress, Input } from "@/components/ui";
import {
  ChevronLeft, ChevronRight, Pencil, Check, X, Plus,
  AlertTriangle, ShieldCheck, TrendingUp, Target,
} from "lucide-react";
import toast from "react-hot-toast";
import { SkeletonCard } from "@/components/SkeletonLoader";

const SKIP_CATS = new Set(["Transfer", "Credit Card Payment", "Income"]);
const SKIP_PAYMENTS = new Set(["Credit Card", "Self Transfer", "Transfer"]);

const getBudgetStatus = (pct: number) => {
  if (pct > 100) return { label: "Over Budget", variant: "danger" as const };
  if (pct >= 80) return { label: "At Risk", variant: "warning" as const };
  return { label: "On Track", variant: "success" as const };
};

export default function BudgetsPage() {
  const { user } = useAuth();
  const { categories, transactions, cycleStartDay, dataReady } = useData();

  const [cycleIdx, setCycleIdx] = useState(0);
  const [budgetLimits, setBudgetLimits] = useState<Record<string, number>>({});
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [salary, setSalary] = useState(0);
  const [editingSalary, setEditingSalary] = useState(false);
  const [salaryInput, setSalaryInput] = useState("");
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [addCatName, setAddCatName] = useState("");
  const [addCatLimit, setAddCatLimit] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#6366f1");
  const [newCatLimit, setNewCatLimit] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  const recentCycles = useMemo(() => getRecentFinancialMonths(8, new Date(), cycleStartDay), [cycleStartDay]);
  const currentCycle = recentCycles[cycleIdx];
  const cycleInfo = useMemo(() => getCycleDayInfo(new Date(), cycleStartDay), [cycleStartDay]);
  const isCurrentCycle = cycleIdx === 0;

  // Load salary from profile
  useEffect(() => {
    if (!user) return;
    profileAPI.get().then((p) => { if (p?.monthlySalary) setSalary(p.monthlySalary); }).catch(() => {});
  }, [user]);

  // Load budget snapshots for the cycle
  useEffect(() => {
    if (!user || !currentCycle) return;
    budgetSnapshotsAPI.get(currentCycle.cycleKey).then((data) => {
      if (data && typeof data === "object") setBudgetLimits(data as Record<string, number>);
      else setBudgetLimits({});
    }).catch(() => setBudgetLimits({}));
  }, [user, currentCycle]);

  // Compute spending per category for the cycle
  const categorySpending = useMemo(() => {
    if (!currentCycle) return {};
    const map: Record<string, number> = {};
    transactions.forEach((t) => {
      if (t.date < currentCycle.startDate || t.date > currentCycle.endDate) return;
      if (t.amount >= 0) return;
      if (SKIP_CATS.has(t.category) || SKIP_PAYMENTS.has(t.payment_type || "")) return;
      map[t.category] = (map[t.category] || 0) + Math.abs(t.amount);
    });
    return map;
  }, [transactions, currentCycle]);

  const totalSpent = Object.values(categorySpending).reduce((s, v) => s + v, 0);
  const totalBudget = Object.values(budgetLimits).reduce((s, v) => s + v, 0);
  const overallPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  // Build budget card data
  const budgetCards = useMemo(() => {
    const allCats = new Set([...Object.keys(budgetLimits), ...Object.keys(categorySpending)]);
    return Array.from(allCats)
      .filter((cat) => !SKIP_CATS.has(cat))
      .map((cat) => {
        const limit = budgetLimits[cat] || 0;
        const spent = categorySpending[cat] || 0;
        const pct = limit > 0 ? (spent / limit) * 100 : (spent > 0 ? 100 : 0);
        const remaining = Math.max(0, limit - spent);
        const daysLeft = cycleInfo.totalDays - cycleInfo.daysElapsed;
        const dailyAllowance = daysLeft > 0 && limit > 0 ? remaining / daysLeft : 0;
        const projected = cycleInfo.daysElapsed > 3 && isCurrentCycle
          ? (spent / cycleInfo.daysElapsed) * cycleInfo.totalDays
          : undefined;
        const color = categories.find((c) => c.name === cat)?.color || "#94a3b8";
        return { cat, limit, spent, pct, remaining, dailyAllowance, projected, color };
      })
      .sort((a, b) => b.spent - a.spent);
  }, [budgetLimits, categorySpending, categories, cycleInfo, isCurrentCycle]);

  // Unbudgeted categories (have spending but no limit set)
  const unbudgeted = budgetCards.filter((b) => b.limit === 0 && b.spent > 0);

  // Categories available to add budget (not already budgeted, not skipped)
  const availableCategories = useMemo(() => {
    return categories
      .filter((c) => !SKIP_CATS.has(c.name) && !(budgetLimits[c.name] > 0))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, budgetLimits]);

  const handleAddBudget = async () => {
    if (!addCatName) { toast.error("Please select a category"); return; }
    const val = parseFloat(addCatLimit);
    if (isNaN(val) || val <= 0) { toast.error("Enter a valid amount"); return; }
    try {
      await budgetSnapshotsAPI.set(currentCycle.cycleKey, addCatName, val);
      setBudgetLimits((prev) => ({ ...prev, [addCatName]: val }));
      toast.success(`Budget set for ${addCatName}`);
      setShowAddBudget(false);
      setAddCatName("");
      setAddCatLimit("");
    } catch { toast.error("Failed to save budget"); }
  };

  const handleCreateCategory = async () => {
    const name = newCatName.trim();
    if (!name) { toast.error("Enter a category name"); return; }
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Category already exists"); return;
    }
    const limitVal = parseFloat(newCatLimit);
    if (isNaN(limitVal) || limitVal <= 0) { toast.error("Enter a valid budget limit"); return; }
    setCreatingCategory(true);
    try {
      await categoriesAPI.create({ name, color: newCatColor });
      await budgetSnapshotsAPI.set(currentCycle.cycleKey, name, limitVal);
      setBudgetLimits((prev) => ({ ...prev, [name]: limitVal }));
      toast.success(`Category "${name}" created with budget!`);
      setShowNewCategory(false);
      setShowAddBudget(false);
      setNewCatName("");
      setNewCatColor("#6366f1");
      setNewCatLimit("");
    } catch { toast.error("Failed to create category"); }
    setCreatingCategory(false);
  };

  const handleSaveBudget = async (catId: string) => {
    const val = parseFloat(editValue);
    if (isNaN(val) || val < 0) { toast.error("Invalid amount"); return; }
    try {
      await budgetSnapshotsAPI.set(currentCycle.cycleKey, catId, val);
      setBudgetLimits((prev) => ({ ...prev, [catId]: val }));
      toast.success("Budget saved");
    } catch { toast.error("Failed to save"); }
    setEditingCatId(null);
  };

  const handleSaveSalary = async () => {
    const val = parseFloat(salaryInput);
    if (isNaN(val) || val <= 0) { toast.error("Invalid salary"); return; }
    try {
      await profileAPI.update({ monthlySalary: val });
      setSalary(val);
      setEditingSalary(false);
      toast.success("Salary updated");
    } catch { toast.error("Failed to update"); }
  };

  if (!dataReady) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><SkeletonCard lines={2} /><SkeletonCard lines={2} /><SkeletonCard lines={2} /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><SkeletonCard lines={4} /><SkeletonCard lines={4} /><SkeletonCard lines={4} /><SkeletonCard lines={4} /></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{currentCycle?.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAddBudget(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Budget
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => setCycleIdx(Math.min(cycleIdx + 1, recentCycles.length - 1))} disabled={cycleIdx >= recentCycles.length - 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-foreground min-w-[100px] text-center">{currentCycle?.label}</span>
          <Button variant="outline" size="icon-sm" onClick={() => setCycleIdx(Math.max(cycleIdx - 1, 0))} disabled={cycleIdx === 0}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Overview Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {/* Salary */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase">Monthly Salary</span>
              {!editingSalary ? (
                <button onClick={() => { setEditingSalary(true); setSalaryInput(String(salary)); }} className="text-muted-foreground hover:text-foreground">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              ) : (
                <div className="flex gap-1">
                  <button onClick={handleSaveSalary} className="text-success"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setEditingSalary(false)} className="text-danger"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
            {editingSalary ? (
              <Input value={salaryInput} onChange={(e) => setSalaryInput(e.target.value)} className="h-7 text-sm" autoFocus />
            ) : (
              <p className="text-lg font-bold text-foreground">{fmt(salary)}</p>
            )}
          </CardContent>
        </Card>

        {/* Total Budget */}
        <Card>
          <CardContent className="p-4">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">Total Budget</span>
            <p className="text-lg font-bold text-foreground mt-1">{fmt(totalBudget)}</p>
            <p className="text-[10px] text-muted-foreground">{salary > 0 ? `${((totalBudget / salary) * 100).toFixed(0)}% of salary` : ""}</p>
          </CardContent>
        </Card>

        {/* Total Spent */}
        <Card>
          <CardContent className="p-4">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">Total Spent</span>
            <p className={cn("text-lg font-bold mt-1", overallPct > 100 ? "text-danger" : "text-foreground")}>{fmt(totalSpent)}</p>
            <Progress value={Math.min(overallPct, 100)} className="mt-2 h-1.5" indicatorClassName={overallPct > 100 ? "bg-danger" : overallPct > 80 ? "bg-warning" : "bg-success"} />
          </CardContent>
        </Card>

        {/* Overall Status */}
        <Card>
          <CardContent className="p-4">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">Status</span>
            <div className="flex items-center gap-2 mt-2">
              {overallPct > 100 ? <AlertTriangle className="w-5 h-5 text-danger" /> : <ShieldCheck className="w-5 h-5 text-success" />}
              <div>
                <p className="text-sm font-bold text-foreground">{overallPct.toFixed(0)}% used</p>
                <p className="text-[10px] text-muted-foreground">{fmt(Math.max(0, totalBudget - totalSpent))} remaining</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {budgetCards.filter((b) => b.limit > 0).length === 0 && unbudgeted.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Target className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-sm font-semibold text-foreground mb-1">No budgets set yet</p>
              <p className="text-xs text-muted-foreground mb-4 text-center max-w-xs">
                Set monthly spending limits for your categories to stay on track.
              </p>
              <Button size="sm" onClick={() => setShowAddBudget(true)}>
                <Plus className="w-4 h-4 mr-1.5" /> Add Your First Budget
              </Button>
            </CardContent>
          </Card>
        ) : (
          budgetCards.filter((b) => b.limit > 0).map((b) => {
          const status = getBudgetStatus(b.pct);
          const isEditing = editingCatId === b.cat;
          return (
            <Card key={b.cat} className="group">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: b.color }} />
                    <span className="text-sm font-semibold text-foreground">{b.cat}</span>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>

                {/* Progress */}
                <div className="mb-3">
                  <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                    <span>{fmt(b.spent)} spent</span>
                    <span>{fmt(b.limit)} limit</span>
                  </div>
                  <Progress
                    value={Math.min(b.pct, 100)}
                    className="h-2"
                    indicatorClassName={b.pct > 100 ? "bg-danger" : b.pct > 80 ? "bg-warning" : "bg-success"}
                  />
                  <p className="text-right text-[10px] text-muted-foreground mt-0.5">{b.pct.toFixed(0)}%</p>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-md bg-muted/50 p-2">
                    <span className="text-muted-foreground">Remaining</span>
                    <p className="font-semibold text-foreground">{fmt(b.remaining)}</p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <span className="text-muted-foreground">Daily Left</span>
                    <p className="font-semibold text-foreground">{fmt(b.dailyAllowance)}</p>
                  </div>
                </div>

                {/* Projected (only current cycle, after day 3) */}
                {b.projected !== undefined && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                    <TrendingUp className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Projected: </span>
                    <span className={cn("font-semibold", b.projected > b.limit ? "text-danger" : "text-success")}>
                      {fmt(b.projected)}
                    </span>
                  </div>
                )}

                {/* Edit limit */}
                <div className="mt-3 pt-3 border-t border-border">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-7 text-sm flex-1"
                        placeholder="New limit"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") handleSaveBudget(b.cat); if (e.key === "Escape") setEditingCatId(null); }}
                      />
                      <button onClick={() => handleSaveBudget(b.cat)} className="text-success"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditingCatId(null)} className="text-danger"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingCatId(b.cat); setEditValue(String(b.limit)); }}
                      className="text-[11px] text-brand hover:underline flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Pencil className="w-3 h-3" /> Edit limit
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })
        )}
      </div>

      {/* Unbudgeted Spending */}
      {unbudgeted.length > 0 && (
        <Card className="border-warning/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="w-4 h-4" /> Unbudgeted Spending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">These categories have spending but no budget set.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {unbudgeted.map((b) => (
                <div key={b.cat} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                    <span className="text-sm font-medium text-foreground">{b.cat}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{fmt(b.spent)}</span>
                    <button
                      onClick={() => { setEditingCatId(b.cat); setEditValue(""); }}
                      className="text-brand hover:text-brand/80"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit modal for unbudgeted items */}
      {editingCatId && !budgetCards.find((b) => b.cat === editingCatId && b.limit > 0) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setEditingCatId(null)}>
          <Card className="w-[320px]" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Set Budget for {editingCatId}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Monthly limit (₹)"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveBudget(editingCatId); }}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setEditingCatId(null)}>Cancel</Button>
                <Button size="sm" onClick={() => handleSaveBudget(editingCatId)}>Save</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Budget Modal */}
      {showAddBudget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setShowAddBudget(false); setShowNewCategory(false); }}>
          <Card className="w-[400px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-brand" /> {showNewCategory ? "Create New Category" : "Add Category Budget"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {showNewCategory ? (
                <>
                  <div>
                    <label className="block text-[13px] font-medium text-muted-foreground mb-1.5">Category Name</label>
                    <Input
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="e.g. Groceries, Medical, Education"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-muted-foreground mb-1.5">Color</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={newCatColor}
                        onChange={(e) => setNewCatColor(e.target.value)}
                        className="w-9 h-9 rounded-lg border border-input cursor-pointer"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#84cc16"].map((c) => (
                          <button
                            key={c}
                            onClick={() => setNewCatColor(c)}
                            className={cn("w-6 h-6 rounded-full border-2 transition-transform", newCatColor === c ? "border-foreground scale-110" : "border-transparent")}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-muted-foreground mb-1.5">Monthly Budget Limit (₹)</label>
                    <Input
                      type="number"
                      min="1"
                      step="100"
                      value={newCatLimit}
                      onChange={(e) => setNewCatLimit(e.target.value)}
                      placeholder="e.g. 5000"
                      onKeyDown={(e) => { if (e.key === "Enter") handleCreateCategory(); }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    This category will be available globally across all months and in transaction forms.
                  </p>
                  <div className="flex gap-2 justify-end pt-1">
                    <Button variant="outline" size="sm" onClick={() => setShowNewCategory(false)}>Back</Button>
                    <Button size="sm" onClick={handleCreateCategory} disabled={creatingCategory || !newCatName.trim() || !newCatLimit}>
                      {creatingCategory ? "Creating..." : "Create & Set Budget"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {availableCategories.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">All categories already have budgets set.</p>
                  ) : (
                    <>
                      <div>
                        <label className="block text-[13px] font-medium text-muted-foreground mb-1.5">Category</label>
                        <select
                          value={addCatName}
                          onChange={(e) => setAddCatName(e.target.value)}
                          className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                        >
                          <option value="">— Select category —</option>
                          {availableCategories.map((c) => (
                            <option key={c.id || c.name} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[13px] font-medium text-muted-foreground mb-1.5">Monthly Limit (₹)</label>
                        <Input
                          type="number"
                          min="1"
                          step="100"
                          value={addCatLimit}
                          onChange={(e) => setAddCatLimit(e.target.value)}
                          placeholder="e.g. 5000"
                          onKeyDown={(e) => { if (e.key === "Enter") handleAddBudget(); }}
                          autoFocus={!!addCatName}
                        />
                      </div>
                      {salary > 0 && addCatLimit && parseFloat(addCatLimit) > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          {((parseFloat(addCatLimit) / salary) * 100).toFixed(1)}% of monthly salary
                        </p>
                      )}
                    </>
                  )}
                  <div className="border-t border-border pt-3">
                    <button
                      onClick={() => setShowNewCategory(true)}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-brand/40 text-sm font-medium text-brand hover:bg-brand/5 transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Create New Category
                    </button>
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    <Button variant="outline" size="sm" onClick={() => { setShowAddBudget(false); setAddCatName(""); setAddCatLimit(""); }}>Cancel</Button>
                    {availableCategories.length > 0 && (
                      <Button size="sm" onClick={handleAddBudget} disabled={!addCatName || !addCatLimit}>Set Budget</Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
