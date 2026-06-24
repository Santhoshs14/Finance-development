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
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  writeBatch,
} from "firebase/firestore";
import { useAuth } from "@/providers/AuthProvider";
import { getFinancialCycle } from "@/utils/financialMonth";
import { setCurrencyFormat, setCurrencyRate } from "@/utils/format";

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
  { name: "Investment", color: "#0080ff", classification: "investment" as const },
  { name: "Rent", color: "#f59e0b" },
  { name: "Home", color: "#8b5cf6" },
  { name: "Food", color: "#ef4444" },
  { name: "Travel", color: "#3b82f6" },
  { name: "Petrol", color: "#f97316" },
  { name: "Entertainment", color: "#ec4899" },
  { name: "Shopping", color: "#14b8a6" },
  { name: "Bills", color: "#64748b" },
  { name: "Utilities", color: "#eab308" },
  { name: "Subscription", color: "#06b6d4" },
  { name: "Lending", color: "#84cc16" },
  { name: "Gifts", color: "#f43f5e" },
  { name: "Income", color: "#10b981" },
  { name: "Other", color: "#94a3b8" },
];

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recurring, setRecurring] = useState<RecurringItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [sips, setSips] = useState<Sip[]>([]);
  const [cycleStartDay, setCycleStartDay] = useState(25);
  const [monthlySalary, setMonthlySalary] = useState(0);
  const [currency, setCurrency] = useState("INR");
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [accountsReady, setAccountsReady] = useState(false);
  const [transactionsReady, setTransactionsReady] = useState(false);
  const [categoriesReady, setCategoriesReady] = useState(false);
  const [recurringReady, setRecurringReady] = useState(false);
  const dataReady = accountsReady && transactionsReady && categoriesReady && recurringReady;
  const [currentAggregate, setCurrentAggregate] = useState<Aggregate>({
    totalSpent: 0,
    totalIncome: 0,
    totalInvestmentSpend: 0,
    categoryBreakdown: {},
  });

  // Lazily-subscribed datasets: views call useDataset(name) to opt in; the
  // listener attaches only while at least one consumer is mounted.
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

  // Subscribe to Firestore
  useEffect(() => {
    const unsubscribes: (() => void)[] = [];

    const cleanup = () => {
      unsubscribes.forEach((u) => u());
    };

    if (!user) {
      setAccounts([]);
      setTransactions([]);
      setCategories([]);
      setRecurring([]);
      setNotifications([]);
      setGoals([]);
      setInvestments([]);
      setSips([]);
      setCycleStartDay(25);
      setMonthlySalary(0);
      setCurrentAggregate({ totalSpent: 0, totalIncome: 0, totalInvestmentSpend: 0, categoryBreakdown: {} });
      setAccountsReady(false);
      setTransactionsReady(false);
      setCategoriesReady(false);
      setRecurringReady(false);
      return cleanup;
    }

    const uid = user.uid;

    // Profile (cycleStartDay, monthlySalary, currency, onboardingComplete)
    unsubscribes.push(
      onSnapshot(doc(db, `users/${uid}`), (snap) => {
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
      })
    );

    // Accounts
    unsubscribes.push(
      onSnapshot(collection(db, `users/${uid}/accounts`), (snap) => {
        setAccounts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Account)));
        setAccountsReady(true);
      })
    );

    // Transactions (latest 500)
    const txQuery = query(
      collection(db, `users/${uid}/transactions`),
      orderBy("date", "desc"),
      limit(500)
    );
    unsubscribes.push(
      onSnapshot(txQuery, (snap) => {
        const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction));
        fetched.sort((a, b) => {
          const dateCmp = b.date.localeCompare(a.date);
          if (dateCmp !== 0) return dateCmp;
          const aTs = typeof a.createdAt === "object" ? a.createdAt : null;
          const bTs = typeof b.createdAt === "object" ? b.createdAt : null;
          const aTime = aTs?.seconds || aTs?.toMillis?.() || 0;
          const bTime = bTs?.seconds || bTs?.toMillis?.() || 0;
          return bTime - aTime;
        });
        setTransactions(fetched);
        setTransactionsReady(true);
      })
    );

    // Categories — seed defaults if empty, migrate classification for existing
    const categoriesRef = collection(db, `users/${uid}/categories`);
    unsubscribes.push(
      onSnapshot(categoriesRef, async (snap) => {
        if (snap.empty) {
          const batch = writeBatch(db);
          DEFAULT_CATEGORIES.forEach((cat) => {
            const slug = cat.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
            const docRef = doc(db, `users/${uid}/categories/${slug}`);
            batch.set(docRef, { ...cat, createdAt: new Date().toISOString() });
          });
          await batch.commit();
        } else {
          const cats = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
          setCategories(cats);

          // One-time migration: ensure "Investment" category has classification set
          const investCat = snap.docs.find((d) => d.data().name === "Investment" && !d.data().classification);
          if (investCat) {
            const { updateDoc } = await import("firebase/firestore");
            await updateDoc(investCat.ref, { classification: "investment" });
          }
        }
        setCategoriesReady(true);
      })
    );

    // Recurring transaction templates
    unsubscribes.push(
      onSnapshot(collection(db, `users/${uid}/recurring`), (snap) => {
        setRecurring(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RecurringItem)));
        setRecurringReady(true);
      })
    );

    // Notifications (last 50, ordered by createdAt desc)
    const notifQuery = query(
      collection(db, `users/${uid}/notifications`),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    unsubscribes.push(
      onSnapshot(notifQuery, (snap) => {
        setNotifications(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              type: data.type || "info",
              title: data.title || "",
              message: data.message || "",
              read: data.read || false,
              createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            } as Notification;
          })
        );
      })
    );

    // Splits, goals, lending, emis, and investments are no longer subscribed
    // here. Those views read from dedicated React Query hooks / API routes
    // (useGoals, useInvestments, splitsAPI, …); keeping always-on listeners for
    // them just burned Firestore reads on every session. Investments is now a
    // lazily-subscribed dataset (see the effect below + useDataset).

    return cleanup;
  }, [user]);

  // Investments — lazily subscribed (only when a mounted view registers it via
  // useDataset("investments")). Legacy `mutualFunds` are intentionally NOT
  // merged here anymore; the API (`listInvestments`) and the one-time
  // migration cron fold them into the canonical `investments` collection.
  useEffect(() => {
    if (!user || !activeDatasets.investments) {
      setInvestments([]);
      return;
    }
    const uid = user.uid;
    const unsub = onSnapshot(
      collection(db, `users/${uid}/investments`),
      (snap) => {
        setInvestments(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as Investment))
        );
      }
    );
    return () => unsub();
  }, [user, activeDatasets.investments]);

  // Goals — lazily subscribed (only when a mounted view registers it via
  // useDataset("goals"), e.g. through the useGoals hook).
  useEffect(() => {
    if (!user || !activeDatasets.goals) {
      setGoals([]);
      return;
    }
    const uid = user.uid;
    const unsub = onSnapshot(collection(db, `users/${uid}/goals`), (snap) => {
      setGoals(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Goal)));
    });
    return () => unsub();
  }, [user, activeDatasets.goals]);

  // SIPs — lazily subscribed (only when a mounted view registers it via
  // useDataset("sips"), e.g. through the useSips hook on the Mutual Funds page).
  useEffect(() => {
    if (!user || !activeDatasets.sips) {
      setSips([]);
      return;
    }
    const uid = user.uid;
    const unsub = onSnapshot(collection(db, `users/${uid}/sips`), (snap) => {
      setSips(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sip)));
    });
    return () => unsub();
  }, [user, activeDatasets.sips]);

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

  // Re-subscribe to aggregates when cycleStartDay changes
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const cycle = getFinancialCycle(new Date(), cycleStartDay);
    const unsub = onSnapshot(
      doc(db, `users/${uid}/aggregates/${cycle.cycleKey}`),
      (snap) => {
        if (snap.exists()) setCurrentAggregate(snap.data() as Aggregate);
        else setCurrentAggregate({ totalSpent: 0, totalIncome: 0, totalInvestmentSpend: 0, categoryBreakdown: {} });
      }
    );
    return () => unsub();
  }, [user, cycleStartDay]);

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
