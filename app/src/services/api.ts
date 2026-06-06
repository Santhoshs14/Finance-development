import { auth } from "@/lib/firebase";

/**
 * Authenticated fetch wrapper.
 * Automatically attaches the Firebase ID token as a Bearer token.
 *
 * Exported so other modules (hooks, custom utilities) can issue
 * authenticated API calls without re-implementing the token plumbing.
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }

  const token = await user.getIdToken();

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  return res;
}

// ─── Transactions ───────────────────────────────────────────────

export const transactionsAPI = {
  async list(params?: {
    cycleKey?: string;
    limit?: number;
    cursor?: string;
    type?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.cycleKey) searchParams.set("cycleKey", params.cycleKey);
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    if (params?.type) searchParams.set("type", params.type);
    const res = await authFetch(`/api/transactions?${searchParams}`);
    return res.json();
  },

  async create(data: Record<string, unknown>) {
    const res = await authFetch("/api/transactions", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async update(id: string, data: Record<string, unknown>) {
    const res = await authFetch(`/api/transactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async delete(id: string) {
    const res = await authFetch(`/api/transactions/${id}`, {
      method: "DELETE",
    });
    return res.json();
  },
};

// ─── Accounts ───────────────────────────────────────────────────

export const accountsAPI = {
  async list() {
    const res = await authFetch("/api/accounts");
    return res.json();
  },

  async create(data: Record<string, unknown>) {
    const res = await authFetch("/api/accounts", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async update(id: string, data: Record<string, unknown>) {
    const res = await authFetch(`/api/accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async delete(id: string) {
    const res = await authFetch(`/api/accounts/${id}`, {
      method: "DELETE",
    });
    return res.json();
  },
};

// ─── Budgets ────────────────────────────────────────────────────

export const budgetsAPI = {
  async list(cycleKey: string) {
    const res = await authFetch(`/api/budgets?cycleKey=${cycleKey}`);
    return res.json();
  },

  async create(cycleKey: string, data: Record<string, unknown>) {
    const res = await authFetch("/api/budgets", {
      method: "POST",
      body: JSON.stringify({ cycleKey, ...data }),
    });
    return res.json();
  },

  async delete(cycleKey: string, budgetId: string) {
    const res = await authFetch(`/api/budgets/${budgetId}?cycleKey=${cycleKey}`, {
      method: "DELETE",
    });
    return res.json();
  },
};

// ─── Categories ─────────────────────────────────────────────────

export const categoriesAPI = {
  async list() {
    const res = await authFetch("/api/categories");
    return res.json();
  },

  async create(data: Record<string, unknown>) {
    const res = await authFetch("/api/categories", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async delete(id: string) {
    const res = await authFetch(`/api/categories/${id}`, {
      method: "DELETE",
    });
    return res.json();
  },

  async update(id: string, data: Record<string, unknown>) {
    const res = await authFetch(`/api/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return res.json();
  },
};

// ─── Goals ──────────────────────────────────────────────────────

export const goalsAPI = {
  async list() {
    const res = await authFetch("/api/goals");
    return res.json();
  },

  async create(data: Record<string, unknown>) {
    const res = await authFetch("/api/goals", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async update(id: string, data: Record<string, unknown>) {
    const res = await authFetch(`/api/goals/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async delete(id: string) {
    const res = await authFetch(`/api/goals/${id}`, {
      method: "DELETE",
    });
    return res.json();
  },
};

// ─── Investments ────────────────────────────────────────────────

export const investmentsAPI = {
  async list() {
    const res = await authFetch("/api/investments");
    return res.json();
  },

  async create(data: Record<string, unknown>) {
    const res = await authFetch("/api/investments", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async update(id: string, data: Record<string, unknown>) {
    const res = await authFetch(`/api/investments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async delete(id: string) {
    const res = await authFetch(`/api/investments/${id}`, {
      method: "DELETE",
    });
    return res.json();
  },
};

// ─── Lending ────────────────────────────────────────────────────

export const lendingAPI = {
  async list() {
    const res = await authFetch("/api/lending");
    return res.json();
  },

  async create(data: Record<string, unknown>) {
    const res = await authFetch("/api/lending", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async update(id: string, data: Record<string, unknown>) {
    const res = await authFetch(`/api/lending/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async delete(id: string) {
    const res = await authFetch(`/api/lending/${id}`, {
      method: "DELETE",
    });
    return res.json();
  },

  async repay(id: string, amount: number) {
    const res = await authFetch(`/api/lending/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ repayAmount: amount }),
    });
    return res.json();
  },
};

// ─── Profile ────────────────────────────────────────────────────

export const profileAPI = {
  async get() {
    const res = await authFetch("/api/profile");
    return res.json();
  },

  async update(data: Record<string, unknown>) {
    const res = await authFetch("/api/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async delete() {
    const res = await authFetch("/api/profile", {
      method: "DELETE",
    });
    return res.json();
  },
};

// ─── Aggregates ─────────────────────────────────────────────────

export const aggregatesAPI = {
  async get(cycleKey: string) {
    const res = await authFetch(`/api/aggregates?cycleKey=${cycleKey}`);
    return res.json();
  },
};

// ─── Recurring ──────────────────────────────────────────────────

export const recurringAPI = {
  async list() {
    const res = await authFetch("/api/recurring");
    return res.json();
  },

  async create(data: Record<string, unknown>) {
    const res = await authFetch("/api/recurring", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async update(id: string, data: Record<string, unknown>) {
    const res = await authFetch(`/api/recurring/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async delete(id: string) {
    const res = await authFetch(`/api/recurring/${id}`, {
      method: "DELETE",
    });
    return res.json();
  },
};

// ─── EMIs ───────────────────────────────────────────────────────

export const emisAPI = {
  async list() {
    const res = await authFetch("/api/emis");
    return res.json();
  },

  async create(data: Record<string, unknown>) {
    const res = await authFetch("/api/emis", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async update(id: string, data: Record<string, unknown>) {
    const res = await authFetch(`/api/emis/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async delete(id: string) {
    const res = await authFetch(`/api/emis/${id}`, {
      method: "DELETE",
    });
    return res.json();
  },
};

// ─── Notifications ──────────────────────────────────────────────

export const notificationsAPI = {
  async list() {
    const res = await authFetch("/api/notifications");
    return res.json();
  },

  async markRead(ids: string[]) {
    const res = await authFetch("/api/notifications", {
      method: "PATCH",
      body: JSON.stringify({ ids }),
    });
    return res.json();
  },

  async markAllRead() {
    const res = await authFetch("/api/notifications", {
      method: "PATCH",
      body: JSON.stringify({ markAllRead: true }),
    });
    return res.json();
  },

  async clearAll() {
    const res = await authFetch("/api/notifications", {
      method: "DELETE",
      body: JSON.stringify({ clearAll: true }),
    });
    return res.json();
  },

  async delete(ids: string[]) {
    const res = await authFetch("/api/notifications", {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    return res.json();
  },
};

// ─── Import ─────────────────────────────────────────────────────

export const importAPI = {
  async uploadExcel(formData: FormData) {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    const token = await user.getIdToken();

    const res = await fetch("/api/import", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData, // Let browser set Content-Type with boundary
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || `Import failed: ${res.status}`);
    }
    return res.json();
  },

  async uploadBatch(transactions: Record<string, unknown>[]) {
    const res = await authFetch("/api/import/batch", {
      method: "POST",
      body: JSON.stringify({ transactions }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || `Batch import failed: ${res.status}`);
    }
    return res.json();
  },
};

// ─── Splits ─────────────────────────────────────────────────────

export const splitsAPI = {
  async list() {
    const res = await authFetch("/api/splits");
    return res.json();
  },

  async create(data: Record<string, unknown>) {
    const res = await authFetch("/api/splits", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async update(id: string, data: Record<string, unknown>) {
    const res = await authFetch(`/api/splits/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async settle(id: string, settlement: { from: string; to: string; amount: number }) {
    const res = await authFetch(`/api/splits/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ settle: settlement }),
    });
    return res.json();
  },

  async delete(id: string) {
    const res = await authFetch(`/api/splits/${id}`, {
      method: "DELETE",
    });
    return res.json();
  },
};

// ─── Net Worth Snapshots ────────────────────────────────────────

export const netWorthAPI = {
  async getSnapshots(limit = 12) {
    const res = await authFetch(`/api/net-worth/snapshots?limit=${limit}`);
    return res.json();
  },

  async saveSnapshot(data: {
    month: string;
    accounts: number;
    investments: number;
    cc_outstanding: number;
    lent: number;
    borrowed: number;
    net_worth: number;
  }) {
    const res = await authFetch("/api/net-worth/snapshots", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.json();
  },
};

// ─── Credit Cards ───────────────────────────────────────────────

export const creditCardsAPI = {
  async list() {
    const res = await authFetch("/api/credit-cards");
    return res.json();
  },

  async create(data: Record<string, unknown>) {
    const res = await authFetch("/api/credit-cards", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async update(id: string, data: Record<string, unknown>) {
    const res = await authFetch(`/api/credit-cards/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async delete(id: string) {
    const res = await authFetch(`/api/credit-cards/${id}`, {
      method: "DELETE",
    });
    return res.json();
  },

  async payBill(data: Record<string, unknown>) {
    const res = await authFetch(`/api/credit-cards/pay`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.json();
  },
};

// ─── Budget Snapshots ───────────────────────────────────────────

export const budgetSnapshotsAPI = {
  async get(cycleKey: string) {
    const res = await authFetch(`/api/budgets/snapshot?cycle=${cycleKey}`);
    const json = await res.json();
    return json.budgets || {};
  },

  async set(cycleKey: string, categoryId: string, limit: number) {
    const res = await authFetch(`/api/budgets/snapshot`, {
      method: "POST",
      body: JSON.stringify({ cycleKey, categoryId, limit }),
    });
    return res.json();
  },
};
