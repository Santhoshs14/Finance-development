"use client";

import { useState, useEffect } from "react";
import { Button, Input, Sheet } from "@/components/ui";
import { inputVariants } from "@/components/ui/Input";
import { Sparkles, Landmark, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { DEFAULT_INVESTMENT_CATEGORIES } from "@/schemas/category";
import { investmentsAPI } from "@/services/api";
import { suggestCategory as suggestCategoryEngine, type CategoryRule } from "@/utils/categorization";
import { loadLearnedRules, learnCategoryRule } from "@/lib/learnedCategories";

const getLocalISODate = () => {
  const tzOffset = new Date().getTimezoneOffset() * 60000;
  return new Date(Date.now() - tzOffset).toISOString().split("T")[0];
};

const defaultForm = {
  date: getLocalISODate(),
  amount: "",
  category: "Food",
  payment_type: "Cash",
  account_id: "",
  to_account_id: "",
  notes: "",
  is_recurring: false,
  recurrence_interval: "monthly",
  linked_investment_id: "",
};

interface Category { id?: string; name: string; color?: string; classification?: string; }
interface Account { id: string; account_name: string; balance?: number; credit_limit?: number; }
interface InvestmentOption { id: string; name: string; investment_type?: string; }
interface TransactionData {
  date: string; amount: number; type: string; category: string; payment_type: string;
  account_id?: string; to_account_id?: string; notes?: string;
  is_recurring?: boolean; recurrence_interval?: string; next_date?: string;
  linked_investment_id?: string;
}

export interface QuickAddTransactionProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TransactionData) => void;
  accounts?: Account[];
  creditCards?: Account[];
  categories?: Category[];
  investments?: InvestmentOption[];
  initialData?: Partial<TransactionData> & { id?: string } | null;
  allowCreditCard?: boolean;
  creditCardOnly?: boolean;
}

export default function QuickAddTransaction({ isOpen, onClose, onSubmit, accounts = [], creditCards = [], categories = [], investments = [], initialData = null, allowCreditCard = false, creditCardOnly = false }: QuickAddTransactionProps) {
  const [form, setForm] = useState(defaultForm);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [learnedRules, setLearnedRules] = useState<CategoryRule[]>([]);
  const [creatingNewInvestment, setCreatingNewInvestment] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newInvForm, setNewInvForm] = useState({
    name: "",
    investment_type: "Mutual Fund",
  });

  const INVESTMENT_TYPES = ["Mutual Fund", "Equity", "Gold", "Bond", "FD", "PPF", "NPS", "ELSS", "ETF", "Other"];

  useEffect(() => {
    const defaultPaymentType = creditCardOnly ? "Credit Card" : "Cash";
    if (initialData) {
      setForm({
        date: initialData.date || defaultForm.date,
        amount: String(Math.abs(initialData.amount || 0)) || "",
        category: initialData.category || "Food",
        payment_type: initialData.payment_type || defaultPaymentType,
        account_id: initialData.account_id || "",
        to_account_id: initialData.to_account_id || "",
        notes: initialData.notes || "",
        is_recurring: initialData.is_recurring || false,
        recurrence_interval: initialData.recurrence_interval || "monthly",
        linked_investment_id: initialData.linked_investment_id || "",
      });
    } else {
      setForm({ ...defaultForm, payment_type: defaultPaymentType });
    }
    setSuggestion(null);
    setCreatingNewInvestment(false);
    setNewInvForm({ name: "", investment_type: "Mutual Fund" });
  }, [initialData, isOpen, creditCardOnly]);

  useEffect(() => {
    setLearnedRules(loadLearnedRules());
  }, []);

  const handleNotesChange = (val: string) => {
    setForm((prev) => ({ ...prev, notes: val }));
    const result = suggestCategoryEngine(val, learnedRules, categories.map((c) => c.name));
    const suggested = result?.category ?? null;
    if (suggested && suggested !== form.category) setSuggestion(suggested);
    else setSuggestion(null);
  };

  const handlePaymentTypeChange = (newType: string) => {
    setForm((prev) => ({
      ...prev, payment_type: newType, account_id: "", to_account_id: "",
      category: newType === "Self Transfer" ? "Transfer" : prev.category,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentToday = getLocalISODate();
    if (form.date > currentToday) { toast.error("Future dates are not allowed."); return; }
    const rawAmount = parseFloat(form.amount);
    if (isNaN(rawAmount) || rawAmount <= 0) { toast.error("Amount must be positive."); return; }

    // Validate new investment fields if creating one
    if (creatingNewInvestment && !newInvForm.name.trim()) {
      toast.error("Investment name is required.");
      return;
    }

    setSubmitting(true);

    try {
      let linkedInvestmentId = form.linked_investment_id;

      // Create new investment entry first if requested
      if (creatingNewInvestment && newInvForm.name.trim()) {
        const investmentPayload = {
          name: newInvForm.name.trim(),
          investment_type: newInvForm.investment_type,
          buy_price: rawAmount,
          current_price: rawAmount,
          quantity: 1,
          needs_allocation: true,
          account_id: form.account_id || null,
        };
        const created = await investmentsAPI.create(investmentPayload);
        linkedInvestmentId = created.id;
        toast.success(`Investment "${newInvForm.name}" created!`);
      }

      const signedAmount = form.category === "Income" ? Math.abs(rawAmount) : -Math.abs(rawAmount);
      const txnType = form.category === "Income" ? "income" : "expense";
      const submitData: TransactionData = { ...form, amount: signedAmount, type: txnType };

      // Set linked investment ID (from existing selection or newly created)
      if (linkedInvestmentId) {
        submitData.linked_investment_id = linkedInvestmentId;
      } else {
        delete submitData.linked_investment_id;
      }

      if (submitData.is_recurring) {
        const d = new Date(submitData.date);
        if (submitData.recurrence_interval === "monthly") d.setMonth(d.getMonth() + 1);
        else if (submitData.recurrence_interval === "weekly") d.setDate(d.getDate() + 7);
        else if (submitData.recurrence_interval === "yearly") d.setFullYear(d.getFullYear() + 1);
        submitData.next_date = d.toISOString().split("T")[0];
      }

      if (form.notes.trim()) {
        setLearnedRules(learnCategoryRule(form.notes, form.category));
      }

      onSubmit(submitData);
      setForm(defaultForm);
      setSuggestion(null);
      setCreatingNewInvestment(false);
      setNewInvForm({ name: "", investment_type: "Mutual Fund" });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create investment");
    } finally {
      setSubmitting(false);
    }
  };

  const isEdit = !!initialData;
  const isTransfer = form.payment_type === "Self Transfer";
  const bankAccounts = accounts.filter((a) => a.credit_limit == null && !creditCards.some((c) => c.id === a.id));
  const showCreditCardSelector = !isTransfer && (form.payment_type === "Credit Card" || creditCardOnly) && creditCards.length > 0;
  const showAccountSelector = !isTransfer && (form.payment_type === "Debit Card" || form.payment_type === "UPI") && bankAccounts.length > 0;

  // Check if the selected category is a productive/investment category
  const selectedCategory = categories.find((c) => c.name === form.category);
  const isInvestmentCategory = DEFAULT_INVESTMENT_CATEGORIES.has(form.category) || selectedCategory?.classification === "investment";

  const selectClass = cn(inputVariants(), "[&>option]:bg-card [&>option]:text-foreground");

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={isEdit ? "Edit Transaction" : "Add Transaction"}
      footer={
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" form="quick-add-transaction" className="flex-1" disabled={submitting}>
            {submitting ? "Saving..." : isEdit ? "Save Changes" : creatingNewInvestment ? "Add & Create Investment" : "Add Transaction"}
          </Button>
        </div>
      }
    >
        <form id="quick-add-transaction" onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-center gap-1 rounded-2xl bg-muted/60 px-4 py-3 focus-within:ring-2 focus-within:ring-brand/40">
            <label htmlFor="quick-add-amount" className="sr-only">Amount (₹)</label>
            <span aria-hidden className="font-rounded text-title2 text-muted-foreground">₹</span>
            <input
              id="quick-add-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              required
              placeholder="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full min-w-0 bg-transparent text-center font-rounded text-[34px] font-semibold tabular-nums text-foreground outline-none placeholder:text-muted-foreground/50 focus-visible:shadow-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-muted-foreground mb-1">Date</label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} max={getLocalISODate()} required />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-muted-foreground mb-1">Category</label>
              {isTransfer ? (
                <div className="h-11 px-3 rounded-[14px] bg-muted text-muted-foreground text-sm flex items-center md:h-9 md:rounded-[10px]">Transfer</div>
              ) : (
                <select value={form.category} onChange={(e) => { setForm({ ...form, category: e.target.value }); setSuggestion(null); }} className={selectClass}>
                  {categories.length > 0 ? categories.map((c) => <option key={c.id || c.name} value={c.name}>{c.name}</option>) : ["Food", "Income", "Other"].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-muted-foreground mb-1">Payment Method</label>
            {creditCardOnly ? (
              <div className="h-11 px-3 rounded-[14px] bg-muted text-muted-foreground text-sm flex items-center gap-1.5 md:h-9 md:rounded-[10px]">💳 Credit Card</div>
            ) : (
              <select value={form.payment_type} onChange={(e) => handlePaymentTypeChange(e.target.value)} className={selectClass}>
                <option value="Cash">💵 Cash</option>
                {allowCreditCard && <option value="Credit Card">💳 Credit Card</option>}
                <option value="Debit Card">🏦 Debit Card</option>
                <option value="UPI">📱 UPI</option>
                <option value="Self Transfer">🔄 Self Transfer</option>
              </select>
            )}
          </div>

          {showCreditCardSelector && (
            <div>
              <label className="block text-[13px] font-medium text-muted-foreground mb-1">Credit Card</label>
              <select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} className={selectClass} required>
                <option value="">— Select credit card —</option>
                {creditCards.map((c) => <option key={c.id} value={c.id}>{c.account_name}</option>)}
              </select>
            </div>
          )}

          {showAccountSelector && (
            <div>
              <label className="block text-[13px] font-medium text-muted-foreground mb-1">{form.payment_type === "UPI" ? "UPI Linked Account" : "Bank Account"}</label>
              <select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} className={selectClass}>
                <option value="">— Select account —</option>
                {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.account_name} (₹{(a.balance || 0).toLocaleString("en-IN")})</option>)}
              </select>
            </div>
          )}

          {isTransfer && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-medium text-muted-foreground mb-1">From Account</label>
                <select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} className={selectClass} required>
                  <option value="">— Select source —</option>
                  {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}
                  {creditCards.map((c) => <option key={c.id} value={c.id}>{c.account_name} (CC)</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-muted-foreground mb-1">To Account</label>
                <select value={form.to_account_id} onChange={(e) => setForm({ ...form, to_account_id: e.target.value })} className={selectClass} required>
                  <option value="">— Select destination —</option>
                  {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}
                  {creditCards.map((c) => <option key={c.id} value={c.id}>{c.account_name} (CC)</option>)}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[13px] font-medium text-muted-foreground mb-1">Notes</label>
            <Input type="text" value={form.notes} onChange={(e) => handleNotesChange(e.target.value)} placeholder="Description (e.g. Swiggy order, Uber ride...)" />
            {suggestion && (
              <div className="mt-1.5 flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-accent flex-shrink-0" />
                <span className="text-[11px] text-muted-foreground">Suggested:</span>
                <button type="button" onClick={() => { setForm((p) => ({ ...p, category: suggestion })); setSuggestion(null); }} className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-accent/10 border border-accent/30 text-accent cursor-pointer hover:bg-accent/20 transition-colors">
                  ✨ {suggestion}
                </button>
              </div>
            )}
          </div>

          {/* Investment Linking — shown when category is productive/investment */}
          {isInvestmentCategory && (
            <div className="p-4 rounded-2xl border border-success/30 bg-success/[0.08]">
              <div className="flex items-center gap-2 mb-2">
                <Landmark className="w-4 h-4 text-success" />
                <span className="text-[13px] font-medium text-success">Productive Spending</span>
              </div>
              <p className="text-[11px] text-success/80 mb-3">
                This counts toward your savings rate. Link or create an investment to track it in your portfolio.
              </p>

              {!creatingNewInvestment ? (
                <>
                  <label className="block text-[12px] font-medium text-success mb-1">Link to Investment</label>
                  <select
                    value={form.linked_investment_id}
                    onChange={(e) => setForm({ ...form, linked_investment_id: e.target.value })}
                    className={selectClass}
                  >
                    <option value="">— Don&apos;t link —</option>
                    {investments.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.name} {inv.investment_type ? `(${inv.investment_type})` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => { setCreatingNewInvestment(true); setForm({ ...form, linked_investment_id: "" }); }}
                    className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-success transition-opacity hover:opacity-80"
                  >
                    <Plus className="w-3.5 h-3.5" /> Create new investment & link
                  </button>
                </>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[12px] font-medium text-success">New Investment Details</label>
                    <button
                      type="button"
                      onClick={() => setCreatingNewInvestment(false)}
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Name (e.g. Nifty 50 SIP, HDFC Equity)"
                    value={newInvForm.name}
                    onChange={(e) => setNewInvForm({ ...newInvForm, name: e.target.value })}
                    className={cn(inputVariants(), "border-success/40 bg-card")}
                  />
                  <select
                    value={newInvForm.investment_type}
                    onChange={(e) => setNewInvForm({ ...newInvForm, investment_type: e.target.value })}
                    className={cn(selectClass, "border-success/40 bg-card")}
                  >
                    {INVESTMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <p className="text-[10px] text-success/70">
                    Amount (₹{form.amount || "0"}) will be recorded. Enter NAV & units later in Portfolio.
                  </p>
                </div>
              )}
            </div>
          )}

          {!isEdit && (
            <div className="p-4 rounded-2xl bg-muted/50">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.is_recurring} onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })} className="w-5 h-5 rounded accent-brand" />
                <span className="text-sm font-medium text-foreground">Recurring transaction</span>
              </label>
              {form.is_recurring && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Frequency</label>
                  <select value={form.recurrence_interval} onChange={(e) => setForm({ ...form, recurrence_interval: e.target.value })} className={selectClass}>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </form>
    </Sheet>
  );
}
