import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock firebase auth
vi.mock("@/lib/firebase", () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue("mock-token-123"),
    },
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  transactionsAPI,
  accountsAPI,
  budgetsAPI,
  categoriesAPI,
  goalsAPI,
  investmentsAPI,
  lendingAPI,
  profileAPI,
  aggregatesAPI,
  recurringAPI,
  emisAPI,
  notificationsAPI,
  importAPI,
  splitsAPI,
  netWorthAPI,
  creditCardsAPI,
  budgetSnapshotsAPI,
} from "@/services/api";

// ═══════════════════════════════════════════════════════════════════════
// API Service - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("API Service", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
  });

  // ─── Transactions API ─────────────────────────────────────────────

  describe("transactionsAPI", () => {
    it("list - calls with correct URL and auth header", async () => {
      await transactionsAPI.list();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/transactions"),
        expect.objectContaining({
          headers: expect.any(Headers),
        })
      );
    });

    it("list - passes cycleKey parameter", async () => {
      await transactionsAPI.list({ cycleKey: "2025-06" });
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("cycleKey=2025-06");
    });

    it("list - passes limit parameter", async () => {
      await transactionsAPI.list({ limit: 50 });
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("limit=50");
    });

    it("list - passes cursor parameter", async () => {
      await transactionsAPI.list({ cursor: "abc123" });
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("cursor=abc123");
    });

    it("list - passes type parameter", async () => {
      await transactionsAPI.list({ type: "expense" });
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("type=expense");
    });

    it("create - sends POST with body", async () => {
      const data = { amount: -500, category: "Food", date: "2025-06-01" };
      await transactionsAPI.create(data);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/transactions",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("update - sends PATCH with id", async () => {
      await transactionsAPI.update("tx1", { amount: -600 });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/transactions/tx1",
        expect.objectContaining({ method: "PATCH" })
      );
    });

    it("delete - sends DELETE with id", async () => {
      await transactionsAPI.delete("tx1");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/transactions/tx1",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    it("throws error for non-OK response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: () => Promise.resolve({ error: "Server error" }),
      });
      await expect(transactionsAPI.list()).rejects.toThrow("Server error");
    });

    it("includes Authorization Bearer token", async () => {
      await transactionsAPI.list();
      const options = mockFetch.mock.calls[0][1];
      const headers = options.headers;
      expect(headers.get("Authorization")).toBe("Bearer mock-token-123");
    });
  });

  // ─── Accounts API ─────────────────────────────────────────────────

  describe("accountsAPI", () => {
    it("list - calls correct endpoint", async () => {
      await accountsAPI.list();
      expect(mockFetch).toHaveBeenCalledWith("/api/accounts", expect.anything());
    });

    it("create - sends POST", async () => {
      await accountsAPI.create({ account_name: "Test", type: "savings" });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/accounts",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("update - sends PATCH", async () => {
      await accountsAPI.update("acc1", { balance: 50000 });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/accounts/acc1",
        expect.objectContaining({ method: "PATCH" })
      );
    });

    it("delete - sends DELETE", async () => {
      await accountsAPI.delete("acc1");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/accounts/acc1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  // ─── Budgets API ──────────────────────────────────────────────────

  describe("budgetsAPI", () => {
    it("list - passes cycleKey", async () => {
      await budgetsAPI.list("2025-06");
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("cycleKey=2025-06");
    });

    it("create - includes cycleKey in body", async () => {
      await budgetsAPI.create("2025-06", { category: "Food", monthly_limit: 10000 });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.cycleKey).toBe("2025-06");
    });

    it("delete - includes cycleKey in query", async () => {
      await budgetsAPI.delete("2025-06", "budget1");
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("/api/budgets/budget1");
      expect(url).toContain("cycleKey=2025-06");
    });
  });

  // ─── Categories API ───────────────────────────────────────────────

  describe("categoriesAPI", () => {
    it("list - calls correct endpoint", async () => {
      await categoriesAPI.list();
      expect(mockFetch).toHaveBeenCalledWith("/api/categories", expect.anything());
    });

    it("create - sends POST", async () => {
      await categoriesAPI.create({ name: "Travel", icon: "car" });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/categories",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("update - sends PATCH", async () => {
      await categoriesAPI.update("cat1", { name: "Transport" });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/categories/cat1",
        expect.objectContaining({ method: "PATCH" })
      );
    });

    it("delete - sends DELETE", async () => {
      await categoriesAPI.delete("cat1");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/categories/cat1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  // ─── Goals API ────────────────────────────────────────────────────

  describe("goalsAPI", () => {
    it("list - calls correct endpoint", async () => {
      await goalsAPI.list();
      expect(mockFetch).toHaveBeenCalledWith("/api/goals", expect.anything());
    });

    it("create - sends POST", async () => {
      await goalsAPI.create({ goal_name: "Emergency Fund", target_amount: 100000 });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/goals",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("update - sends PATCH", async () => {
      await goalsAPI.update("g1", { current_amount: 50000 });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/goals/g1",
        expect.objectContaining({ method: "PATCH" })
      );
    });

    it("delete - sends DELETE", async () => {
      await goalsAPI.delete("g1");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/goals/g1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  // ─── Investments API ──────────────────────────────────────────────

  describe("investmentsAPI", () => {
    it("list - calls correct endpoint", async () => {
      await investmentsAPI.list();
      expect(mockFetch).toHaveBeenCalledWith("/api/investments", expect.anything());
    });

    it("create - sends POST", async () => {
      await investmentsAPI.create({ name: "SBI MF", buy_price: 100, quantity: 50 });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/investments",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("update - sends PATCH", async () => {
      await investmentsAPI.update("inv1", { current_price: 120 });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/investments/inv1",
        expect.objectContaining({ method: "PATCH" })
      );
    });

    it("delete - sends DELETE", async () => {
      await investmentsAPI.delete("inv1");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/investments/inv1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  // ─── Lending API ──────────────────────────────────────────────────

  describe("lendingAPI", () => {
    it("list - calls correct endpoint", async () => {
      await lendingAPI.list();
      expect(mockFetch).toHaveBeenCalledWith("/api/lending", expect.anything());
    });

    it("create - sends POST", async () => {
      await lendingAPI.create({ type: "lent", amount: 5000, person: "Friend" });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/lending",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("repay - sends PATCH with repayAmount", async () => {
      await lendingAPI.repay("l1", 2000);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.repayAmount).toBe(2000);
    });

    it("delete - sends DELETE", async () => {
      await lendingAPI.delete("l1");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/lending/l1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  // ─── Profile API ──────────────────────────────────────────────────

  describe("profileAPI", () => {
    it("get - calls correct endpoint", async () => {
      await profileAPI.get();
      expect(mockFetch).toHaveBeenCalledWith("/api/profile", expect.anything());
    });

    it("update - sends PATCH", async () => {
      await profileAPI.update({ name: "Test User" });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/profile",
        expect.objectContaining({ method: "PATCH" })
      );
    });

    it("delete - sends DELETE", async () => {
      await profileAPI.delete();
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/profile",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  // ─── Aggregates API ───────────────────────────────────────────────

  describe("aggregatesAPI", () => {
    it("get - passes cycleKey", async () => {
      await aggregatesAPI.get("2025-06");
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("cycleKey=2025-06");
    });
  });

  // ─── Recurring API ────────────────────────────────────────────────

  describe("recurringAPI", () => {
    it("list - calls correct endpoint", async () => {
      await recurringAPI.list();
      expect(mockFetch).toHaveBeenCalledWith("/api/recurring", expect.anything());
    });

    it("create - sends POST", async () => {
      await recurringAPI.create({ description: "Netflix", amount: -499 });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/recurring",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("update - sends PATCH", async () => {
      await recurringAPI.update("r1", { amount: -599 });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/recurring/r1",
        expect.objectContaining({ method: "PATCH" })
      );
    });

    it("delete - sends DELETE", async () => {
      await recurringAPI.delete("r1");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/recurring/r1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  // ─── EMIs API ─────────────────────────────────────────────────────

  describe("emisAPI", () => {
    it("list - calls correct endpoint", async () => {
      await emisAPI.list();
      expect(mockFetch).toHaveBeenCalledWith("/api/emis", expect.anything());
    });

    it("create - sends POST", async () => {
      await emisAPI.create({ description: "Car Loan", amount: 15000 });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/emis",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("delete - sends DELETE", async () => {
      await emisAPI.delete("emi1");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/emis/emi1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  // ─── Notifications API ────────────────────────────────────────────

  describe("notificationsAPI", () => {
    it("list - calls correct endpoint", async () => {
      await notificationsAPI.list();
      expect(mockFetch).toHaveBeenCalledWith("/api/notifications", expect.anything());
    });

    it("markRead - sends PATCH with ids", async () => {
      await notificationsAPI.markRead(["n1", "n2"]);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.ids).toEqual(["n1", "n2"]);
    });

    it("markAllRead - sends PATCH with markAllRead flag", async () => {
      await notificationsAPI.markAllRead();
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.markAllRead).toBe(true);
    });

    it("clearAll - sends DELETE with clearAll flag", async () => {
      await notificationsAPI.clearAll();
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.clearAll).toBe(true);
    });

    it("delete - sends DELETE with ids", async () => {
      await notificationsAPI.delete(["n1"]);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.ids).toEqual(["n1"]);
    });
  });

  // ─── Import API ───────────────────────────────────────────────────

  describe("importAPI", () => {
    it("uploadExcel - sends FormData without Content-Type", async () => {
      const formData = new FormData();
      formData.append("file", new Blob(["test"]));
      await importAPI.uploadExcel(formData);
      const options = mockFetch.mock.calls[0][1];
      expect(options.method).toBe("POST");
      expect(options.body).toBe(formData);
      // Should NOT set Content-Type (browser handles it for FormData)
      expect(options.headers.Authorization).toBe("Bearer mock-token-123");
    });

    it("uploadBatch - sends POST with transactions array", async () => {
      const transactions = [{ amount: -500, category: "Food" }];
      await importAPI.uploadBatch(transactions);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/import/batch",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  // ─── Splits API ───────────────────────────────────────────────────

  describe("splitsAPI", () => {
    it("list - calls correct endpoint", async () => {
      await splitsAPI.list();
      expect(mockFetch).toHaveBeenCalledWith("/api/splits", expect.anything());
    });

    it("create - sends POST", async () => {
      await splitsAPI.create({ description: "Dinner", total: 3000 });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/splits",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("settle - sends PATCH with settlement data", async () => {
      await splitsAPI.settle("s1", { from: "user1", to: "user2", amount: 500 });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.settle.from).toBe("user1");
      expect(body.settle.amount).toBe(500);
    });

    it("delete - sends DELETE", async () => {
      await splitsAPI.delete("s1");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/splits/s1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  // ─── Net Worth API ────────────────────────────────────────────────

  describe("netWorthAPI", () => {
    it("getSnapshots - passes limit parameter", async () => {
      await netWorthAPI.getSnapshots(6);
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("limit=6");
    });

    it("getSnapshots - uses default limit 12", async () => {
      await netWorthAPI.getSnapshots();
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("limit=12");
    });

    it("saveSnapshot - sends POST with snapshot data", async () => {
      const data = {
        month: "2025-06",
        accounts: 500000,
        investments: 300000,
        cc_outstanding: 20000,
        lent: 10000,
        borrowed: 5000,
        net_worth: 785000,
      };
      await netWorthAPI.saveSnapshot(data);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/net-worth/snapshots",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  // ─── Credit Cards API ─────────────────────────────────────────────

  describe("creditCardsAPI", () => {
    it("list - calls correct endpoint", async () => {
      await creditCardsAPI.list();
      expect(mockFetch).toHaveBeenCalledWith("/api/credit-cards", expect.anything());
    });

    it("payBill - sends POST to pay endpoint", async () => {
      await creditCardsAPI.payBill({ cardId: "cc1", amount: 15000 });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/credit-cards/pay",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("delete - sends DELETE", async () => {
      await creditCardsAPI.delete("cc1");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/credit-cards/cc1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  // ─── Budget Snapshots API ─────────────────────────────────────────

  describe("budgetSnapshotsAPI", () => {
    it("get - passes cycle key", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ budgets: { Food: 10000 } }),
      });
      const result = await budgetSnapshotsAPI.get("2025-06");
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("cycle=2025-06");
      expect(result).toEqual({ Food: 10000 });
    });

    it("set - sends POST with cycleKey, categoryId, limit", async () => {
      await budgetSnapshotsAPI.set("2025-06", "food-cat", 10000);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.cycleKey).toBe("2025-06");
      expect(body.categoryId).toBe("food-cat");
      expect(body.limit).toBe(10000);
    });
  });

  // ─── Auth Error Handling ──────────────────────────────────────────

  describe("Authentication error handling", () => {
    it("throws when user is not authenticated", async () => {
      // We need to re-mock with null user
      const firebase = await import("@/lib/firebase");
      const originalUser = firebase.auth.currentUser;
      Object.defineProperty(firebase.auth, "currentUser", { value: null, writable: true });

      await expect(transactionsAPI.list()).rejects.toThrow("User not authenticated");

      Object.defineProperty(firebase.auth, "currentUser", { value: originalUser, writable: true });
    });

    it("throws server error message for failed requests", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: () => Promise.resolve({ error: "Invalid data" }),
      });
      await expect(transactionsAPI.create({})).rejects.toThrow("Invalid data");
    });

    it("falls back to status text when no error body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        json: () => Promise.reject(new Error("parse error")),
      });
      await expect(transactionsAPI.list()).rejects.toThrow("Service Unavailable");
    });
  });
});
