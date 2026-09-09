"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, onSnapshot, writeBatch } from "firebase/firestore";
import { useAuth } from "@/providers/AuthProvider";
import { getFinancialCycle } from "@/utils/financialMonth";
import { setCurrencyFormat, setCurrencyRate } from "@/utils/format";
import { useLocalCollection, useLocalDoc } from "@/hooks/useLocalData";
import { syncEngine } from "@/lib/sync-engine";
import { announceMutation, onMutation } from "@/lib/mutation-events";

/** Local rows store timestamps as epoch millis; legacy rows may still be ISO. */
function toMillis(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (value && typeof value === "object") {
    const ts = value as FirestoreTimestampLike;
    if (typeof ts.toMillis === "function") return ts.toMillis();
    if (typeof ts.seconds === "number") return ts.seconds * 1000;
  }
  return 0;
}

interface Category {
  id: string;
  name: string;
  color: string;
  classification?: "discretionary" | "essential" | "investment";
}

interface Account {
  id: string;
  account_name: string;
  type: string;
  balance?: number;
  liability?: number;
  credit_limit?: number;
  shared_limit_with?: string;
  billing_cycle_start_day?: number;
  due_days_after?: number;
  reward_rate?: number;
  point_value?: number;
  reward_points_balance?: number;
}

interface FirestoreTimestampLike {
  seconds?: number;
  toMillis?: () => number;
}

interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: string;
  category: string;
  account_id: string;
  description?: string;
  notes?: string;
  payment_type?: string;
  createdAt?: string | FirestoreTimestampLike;
  cycleKey?: string;
  is_recurring?: boolean;
  recurring_frequency?: string;
}

interface RecurringItem {
  id: string;
  description: string;
  category: string;
  amount: number;
  frequency: "weekly" | "monthly" | "yearly";
  next_date: string;
  status: "active" | "paused" | "stopped";
  account_id?: string | null;
  payment_type?: string | null;
  type?: string;
  last_executed?: string | null;
  createdAt?: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface Goal {
  id: string;
  goal_name: string;
  target_amount: number;
  current_amount?: number;
  deadline: string;
  description?: string;
  linked_funds?: string[];
  createdAt?: string | FirestoreTimestampLike;
}

interface Investment {
  id: string;
  name: string;
  investment_type?: string;
  buy_price: number;
  current_price: number;
  quantity: number;
  sip_amount?: number;
  scheme_code?: string;
  fund_house?: string;
  linked_goal_id?: string | null;
  account_id?: string | null;
  _source?: string;
}

interface Sip {
  id: string;
  investment_id?: string | null;
  scheme_code: string;
  fund_name: string;
  fund_house?: string | null;
  amount: number;
  frequency: "weekly" | "monthly" | "yearly";
  day_of_month?: number;
  next_date: string;
  account_id: string;
  linked_goal_id?: string | null;
  status: "active" | "paused" | "stopped";
  last_executed?: string | null;
  installments_done?: number;
  total_invested?: number;
  total_units?: number;
}

interface Aggregate {
  totalSpent: number;
  totalIncome: number;
  totalInvestmentSpend?: number;
  categoryBreakdown: Record<string, number>;
  transactionCount?: number;
}

interface DataContextType {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  creditCards: Account[];
  recurring: RecurringItem[];
  notifications: Notification[];
  goals: Goal[];
  investments: Investment[];
  sips: Sip[];
  cycleStartDay: number;
  monthlySalary: number;
  currency: string;
  onboardingComplete: boolean | null;
  currentAggregate: Aggregate;
  dataReady: boolean;
  getCategoryById: (id: string) => Category | null;
  getCategoryByName: (name: string) => Category | null;
  /** Register interest in a lazily-loaded dataset; returns an unregister fn. */
  registerDataset: (name: DatasetName) => () => void;
}

/** Datasets that are only subscribed to when a mounted view asks for them. */
export type DatasetName = "investments" | "goals" | "sips";

const DEFAULT_CATEGORIES = [
  { name: "Investment", type: "expense" as const, color: "#0080ff", classification: "investment" as const },
  { name: "Rent", type: "expense" as const, color: "#f59e0b" },
  { name: "Home", type: "expense" as const, color: "#8b5cf6" },
  { name: "Food", type: "expense" as const, color: "#ef4444" },
  { name: "Travel", type: "expense" as const, color: "#3b82f6" },
  { name: "Petrol", type: "expense" as const, color: "#f97316" },
  { name: "Entertainment", type: "expense" as const, color: "#ec4899" },
  { name: "Shopping", type: "expense" as const, color: "#14b8a6" },
  { name: "Bills", type: "expense" as const, color: "#64748b" },
  { name: "Utilities", type: "expense" as const, color: "#eab308" },
  { name: "Subscription", type: "expense" as const, color: "#06b6d4" },
  { name: "Lending", type: "expense" as const, color: "#84cc16" },
  { name: "Gifts", type: "expense" as const, color: "#f43f5e" },
  { name: "Income", type: "income" as const, color: "#10b981" },
  { name: "Other", type: "expense" as const, color: "#94a3b8" },
];

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [cycleStartDay, setCycleStartDay] = useState(25);
  const [monthlySalary, setMonthlySalary] = useState(0);
  const [currency, setCurrency] = useState("INR");
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [firstSyncDone, setFirstSyncDone] = useState(false);

  // Lazily-replicated datasets: views call useDataset(name) to opt in. The rows
  // are already local, so this now only gates work, not a Firestore listener.
  const datasetRefs = useRef<Record<string, number>>({});
  const [activeDatasets, setActiveDatasets] = useState<Record<string, boolean>>(
    {}
  );
  const registerDataset = useCallback((name: DatasetName) => {
    const refs = datasetRefs.current;
    refs[name] = (refs[name] ?? 0) + 1;
    if (refs[name] === 1) setActiveDatasets((s) => ({ ...s, [name]: true }));
    return () => {
      refs[name] = Math.max(0, (refs[name] ?? 1) - 1);
      if (refs[name] === 0) setActiveDatasets((s) => ({ ...s, [name]: false }));
    };
  }, []);

  const rawAccounts = useLocalCollection<Account>(uid, "accounts");
  const rawTransactions = useLocalCollection<Transaction>(uid, "transactions");
  const rawCategories = useLocalCollection<Category>(uid, "categories");
  const rawRecurring = useLocalCollection<RecurringItem>(uid, "recurring");
  const rawNotifications = useLocalCollection<Notification>(uid, "notifications");
  const rawInvestments = useLocalCollection<Investment>(
    uid,
    "investments",
    !!activeDatasets.investments
  );
  const rawGoals = useLocalCollection<Goal>(uid, "goals", !!activeDatasets.goals);
  const rawSips = useLocalCollection<Sip>(uid, "sips", !!activeDatasets.sips);

  const accounts = useMemo(() => rawAccounts ?? [], [rawAccounts]);
  const categories = useMemo(() => rawCategories ?? [], [rawCategories]);
  const recurring = useMemo(() => rawRecurring ?? [], [rawRecurring]);
  const investments = useMemo(() => rawInvestments ?? [], [rawInvestments]);
  const goals = useMemo(() => rawGoals ?? [], [rawGoals]);
  const sips = useMemo(() => rawSips ?? [], [rawSips]);

  const transactions = useMemo(() => {
    const rows = rawTransactions ?? [];
    return [...rows].sort((a, b) => {
      const dateCmp = String(b.date ?? "").localeCompare(String(a.date ?? ""));
      if (dateCmp !== 0) return dateCmp;
      return toMillis(b.createdAt) - toMillis(a.createdAt);
    });
  }, [rawTransactions]);

  const notifications = useMemo(() => {
    const rows = rawNotifications ?? [];
    return [...rows]
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
      .slice(0, 50)
      .map((n) => ({
        id: n.id,
        type: n.type || "info",
        title: n.title || "",
        message: n.message || "",
        read: n.read || false,
        createdAt: new Date(toMillis(n.createdAt) || Date.now()).toISOString(),
      })) as Notification[];
  }, [rawNotifications]);

  const dataReady = firstSyncDone;


  // Two Firestore listeners total: the profile doc (drives onboarding and the
  // cycle) and the sync beacon. Every collection is replicated locally instead.
  useEffect(() => {
    if (!uid) {
      setCycleStartDay(25);
      setMonthlySalary(0);
      setCurrency("INR");
      setOnboardingComplete(null);
      setFirstSyncDone(false);
      syncEngine.detach();
      return;
    }

    syncEngine.attach(uid);
    void syncEngine.pull().finally(() => setFirstSyncDone(true));

    const unsubscribes: (() => void)[] = [];

    // Profile (cycleStartDay, monthlySalary, currency, onboardingComplete)
    unsubscribes.push(
      onSnapshot(
        doc(db, `users/${uid}`),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setCycleStartDay(data.cycleStartDay || 25);
            setMonthlySalary(data.monthlySalary || 0);
            setCurrency(data.currency || "INR");
            // Existing users without the field are treated as already onboarded
            setOnboardingComplete(data.onboardingComplete !== false);
          } else {
            // Doc doesn't exist = brand new user, show onboarding
            setOnboardingComplete(false);
          }
        },
        (err) => console.error("profile listener error", err)
      )
    );

    // Sync beacon — bumped server-side on every write, so changes made on
    // another device or by a cron job still arrive promptly.
    unsubscribes.push(
      onSnapshot(
        doc(db, `users/${uid}/_sync/state`),
        () => void syncEngine.pull(),
        (err) => console.error("sync beacon error", err)
      )
    );

    // Our own writes are the one signal we can always trust.
    unsubscribes.push(onMutation(() => void syncEngine.pull()));

    const refresh = () => {
      if (document.visibilityState === "visible") void syncEngine.pull();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    unsubscribes.push(() => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    });

    return () => unsubscribes.forEach((u) => u());
  }, [uid]);

  // Seed default categories for a brand-new account, and backfill the
  // classification the savings-rate maths depends on. Runs off the local
  // replica once the first sync has landed.
  useEffect(() => {
    if (!uid || !firstSyncDone || !rawCategories) return;

    if (rawCategories.length === 0) {
      const batch = writeBatch(db);
      DEFAULT_CATEGORIES.forEach((cat) => {
        const slug = cat.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
        batch.set(doc(db, `users/${uid}/categories/${slug}`), {
          ...cat,
          createdAt: new Date().toISOString(),
        });
      });
      batch
        .commit()
        .then(() => announceMutation("categories"))
        .catch((err) => console.error("category seed failed", err));
      return;
    }

    const investCat = rawCategories.find(
      (c) => c.name === "Investment" && !c.classification
    );
    if (investCat) {
      import("firebase/firestore")
        .then(({ updateDoc }) =>
          updateDoc(doc(db, `users/${uid}/categories/${investCat.id}`), {
            classification: "investment",
          })
        )
        .then(() => announceMutation("categories"))
        .catch((err) => console.error("category migration failed", err));
    }
  }, [uid, firstSyncDone, rawCategories]);

  // Investments, goals and SIPs are replicated locally like everything else.
  // useDataset() now only gates which tables a view reads, not any listener.

  // Sync currency format + display conversion rate globally. Amounts are
  // stored in INR; for a non-INR display currency we read the latest FX
  // snapshot (written by the fetch-fx cron) and apply it at the display layer.
  useEffect(() => {
    setCurrencyFormat(currency);
    if (currency === "INR") {
      setCurrencyRate(1);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "system/fxRatesLatest"));
        const rates = (snap.data()?.rates ?? {}) as Record<string, number>;
        if (!cancelled) setCurrencyRate(rates[currency] ?? 1);
      } catch {
        if (!cancelled) setCurrencyRate(1);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currency]);

  // Current cycle's aggregate, read from the local replica.
  const currentCycleKey = useMemo(
    () => getFinancialCycle(new Date(), cycleStartDay).cycleKey,
    [cycleStartDay]
  );
  const storedAggregate = useLocalDoc<Aggregate>(uid, "aggregates", currentCycleKey);
  const currentAggregate = useMemo<Aggregate>(
    () =>
      storedAggregate ?? {
        totalSpent: 0,
        totalIncome: 0,
        totalInvestmentSpend: 0,
        categoryBreakdown: {},
      },
    [storedAggregate]
  );

  const getCategoryById = useCallback(
    (id: string) => categories.find((c) => c.id === id) || null,
    [categories]
  );

  const creditCards = useMemo(() => accounts.filter((a) => a.type === "credit"), [accounts]);

  const getCategoryByName = useCallback(
    (name: string) => categories.find((c) => c.name === name) || null,
    [categories]
  );

  const value = useMemo(
    () => ({
      accounts,
      transactions,
      categories,
      creditCards,
      recurring,
      notifications,
      goals,
      investments,
      sips,
      cycleStartDay,
      monthlySalary,
      currency,
      onboardingComplete,
      currentAggregate,
      dataReady,
      getCategoryById,
      getCategoryByName,
      registerDataset,
    }),
    [accounts, transactions, categories, creditCards, recurring, notifications, goals, investments, sips, cycleStartDay, monthlySalary, currency, onboardingComplete, currentAggregate, dataReady, getCategoryById, getCategoryByName, registerDataset]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}

/**
 * Opt a mounted view into a lazily-loaded dataset (e.g. "investments"). The
 * underlying Firestore listener attaches while at least one consumer is
 * mounted and detaches when the last one unmounts — so pages that never use
 * the dataset don't pay for the realtime reads.
 */
export function useDataset(name: DatasetName) {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useDataset must be used within DataProvider");
  const { registerDataset } = ctx;
  useEffect(() => registerDataset(name), [registerDataset, name]);
}
