"use client";

import { useState, useEffect } from "react";
import { Button, Input } from "@/components/ui";
import { X, Sparkles, Landmark, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { DEFAULT_INVESTMENT_CATEGORIES } from "@/schemas/category";
import { investmentsAPI } from "@/services/api";

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

const KEYWORD_MAP = [
  { keywords: ["swiggy", "zomato", "mcdonalds", "kfc", "pizza", "burger", "food", "restaurant", "cafe", "lunch", "dinner", "breakfast"], category: "Food" },
  { keywords: ["uber", "ola", "rapido", "auto", "cab", "taxi", "metro", "bus", "train", "flight", "petrol", "fuel", "toll"], category: "Travel" },
  { keywords: ["netflix", "prime", "hotstar", "spotify", "youtube", "subscription"], category: "Subscription" },
  { keywords: ["amazon", "flipkart", "myntra", "shop", "buy", "order", "purchase", "clothes"], category: "Shopping" },
  { keywords: ["rent", "landlord", "flat", "apartment"], category: "Rent" },
  { keywords: ["electricity", "water", "bill", "wifi", "internet", "phone", "recharge"], category: "Bills" },
  { keywords: ["movie", "cinema", "concert", "party", "entertainment"], category: "Entertainment" },
  { keywords: ["salary", "income", "bonus", "cashback", "refund", "freelance"], category: "Income" },
  { keywords: ["mutual fund", "sip", "stocks", "invest", "zerodha", "groww"], category: "Investment" },
  { keywords: ["medicine", "doctor", "hospital", "health", "medical"], category: "Utilities" },
  { keywords: ["lend", "loan", "borrow"], category: "Lending" },
  { keywords: ["gift", "present", "wedding", "birthday"], category: "Gifts" },
  { keywords: ["petrol", "fuel", "pump", "gas"], category: "Petrol" },
];

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

function suggestCategory(notes: string, categoriesAvail: Category[]): string | null {
  if (!notes || notes.trim().length < 2) return null;
  const lower = notes.toLowerCase();
  for (const entry of KEYWORD_MAP) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      if (categoriesAvail.some((c) => c.name === entry.category)) return entry.category;
    }
  }
  return null;
}

export default function QuickAddTransaction({ isOpen, onClose, onSubmit, accounts = [], creditCards = [], categories = [], investments = [], initialData = null, allowCreditCard = false, creditCardOnly = false }: QuickAddTransactionProps) {
  const [form, setForm] = useState(defaultForm);
  const [suggestion, setSuggestion] = useState<string | null>(null);
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

  const handleNotesChange = (val: string) => {
    setForm((prev) => ({ ...prev, notes: val }));
    const suggested = suggestCategory(val, categories);
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

  if (!isOpen) return null;

  const isEdit = !!initialData;
  const isTransfer = form.payment_type === "Self Transfer";
  const bankAccounts = accounts.filter((a) => a.credit_limit == null && !creditCards.some((c) => c.id === a.id));
  const showCreditCardSelector = !isTransfer && (form.payment_type === "Credit Card" || creditCardOnly) && creditCards.length > 0;
  const showAccountSelector = !isTransfer && (form.payment_type === "Debit Card" || form.payment_type === "UPI") && bankAccounts.length > 0;

  // Check if the selected category is a productive/investment category
  const selectedCategory = categories.find((c) => c.name === form.category);
  const isInvestmentCategory = DEFAULT_INVESTMENT_CATEGORIES.has(form.category) || selectedCategory?.classification === "investment";

  const selectClass = "w-full h-9 px-3 rounded-lg border border-input bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 [&>option]:bg-card [&>option]:text-foreground";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md mx-4 rounded-2xl bg-card border border-border shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-bold text-foreground">{isEdit ? "Edit Transaction" : "Quick Add Transaction"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-muted-foreground mb-1">Date</label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} max={getLocalISODate()} required />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-muted-foreground mb-1">Amount (₹)</label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" min="0.01" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-muted-foreground mb-1">Category</label>
              {isTransfer ? (
                <div className="h-9 px-3 rounded-lg bg-muted text-muted-foreground text-sm flex items-center">Transfer</div>
              ) : (
                <select value={form.category} onChange={(e) => { setForm({ ...form, category: e.target.value }); setSuggestion(null); }} className={selectClass}>
                  {categories.length > 0 ? categories.map((c) => <option key={c.id || c.name} value={c.name}>{c.name}</option>) : ["Food", "Income", "Other"].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="block text-[13px] font-medium text-muted-foreground mb-1">Payment Method</label>
              {creditCardOnly ? (
                <div className="h-9 px-3 rounded-lg bg-muted text-muted-foreground text-sm flex items-center gap-1.5">💳 Credit Card</div>
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
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2 mb-2">
                <Landmark className="w-4 h-4 text-emerald-500" />
                <span className="text-[13px] font-medium text-emerald-700 dark:text-emerald-400">Productive Spending</span>
              </div>
              <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70 mb-3">
                This counts toward your savings rate. Link or create an investment to track it in your portfolio.
              </p>

              {!creatingNewInvestment ? (
                <>
                  <label className="block text-[12px] font-medium text-emerald-700 dark:text-emerald-400 mb-1">Link to Investment</label>
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
                    className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Create new investment & link
                  </button>
                </>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[12px] font-medium text-emerald-700 dark:text-emerald-400">New Investment Details</label>
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
                    className="w-full h-9 px-3 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-emerald-950/30 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                  <select
                    value={newInvForm.investment_type}
                    onChange={(e) => setNewInvForm({ ...newInvForm, investment_type: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-emerald-950/30 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    {INVESTMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <p className="text-[10px] text-emerald-600/60 dark:text-emerald-400/50">
                    Amount (₹{form.amount || "0"}) will be recorded. Enter NAV & units later in Portfolio.
                  </p>
                </div>
              )}
            </div>
          )}

          {!isEdit && (
            <div className="p-4 rounded-xl border border-border bg-muted/30">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.is_recurring} onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })} className="w-4 h-4 rounded accent-brand" />
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

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? "Saving..." : isEdit ? "Save Changes" : creatingNewInvestment ? "Add & Create Investment" : "Add Transaction"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
