import { describe, it, expect } from "vitest";
import {
  TAB_ITEMS,
  findActiveNavPath,
  getActiveTab,
  getRouteTitle,
  hasOwnPageTitle,
} from "@/components/nav/nav-config";
import { CALCULATORS } from "@/components/calculators/registry";

describe("getActiveTab", () => {
  it.each([
    ["/", "home"],
    ["/dashboard", "home"],
    ["/money/transactions", "money"],
    ["/money/accounts", "money"],
    ["/lending", "money"],
    ["/spending/budgets", "spend"],
    ["/spending/analytics", "spend"],
    ["/investments", "invest"],
    ["/investments/gold", "invest"],
    ["/wealth", "invest"],
    ["/credit", "more"],
    ["/credit/emis", "more"],
    ["/reports/monthly", "more"],
    ["/calculators/sip", "more"],
    ["/settings", "more"],
    ["/notifications", "more"],
  ])("maps %s to the %s tab", (pathname, tab) => {
    expect(getActiveTab(pathname)).toBe(tab);
  });

  it("maps every tab destination back to its own tab", () => {
    for (const tab of TAB_ITEMS) {
      expect(getActiveTab(tab.href)).toBe(tab.id);
    }
  });
});

describe("findActiveNavPath", () => {
  it("treats / and /dashboard as Home", () => {
    expect(findActiveNavPath("/")).toBe("/");
    expect(findActiveNavPath("/dashboard")).toBe("/");
  });

  it("prefers the longest matching nav path", () => {
    expect(findActiveNavPath("/credit/transactions")).toBe("/credit/transactions");
    expect(findActiveNavPath("/credit")).toBe("/credit");
    expect(findActiveNavPath("/investments/gold/holding-1")).toBe("/investments/gold");
  });

  it("only matches whole path segments", () => {
    expect(findActiveNavPath("/money/transactionsx")).toBeUndefined();
  });

  it("returns undefined for routes outside the nav", () => {
    expect(findActiveNavPath("/settings")).toBeUndefined();
  });

  it("considers extra paths", () => {
    expect(findActiveNavPath("/settings", ["/settings"])).toBe("/settings");
    expect(findActiveNavPath("/notifications/123", ["/notifications"])).toBe("/notifications");
  });
});

describe("getRouteTitle", () => {
  it.each([
    ["/", "Home"],
    ["/dashboard", "Home"],
    ["/money", "Money"],
    ["/notifications", "Notifications"],
    ["/money/transactions", "Transactions"],
    ["/money/bills", "Bills & Subscriptions"],
    ["/investments/other", "Other Investments"],
    ["/reports/health", "Financial Health"],
    ["/money/some-new-page", "Some New Page"],
  ])("titles %s as %s", (pathname, title) => {
    expect(getRouteTitle(pathname)).toBe(title);
  });

  it("uses calculator titles from the registry", () => {
    const [calculator] = CALCULATORS;
    expect(getRouteTitle(`/calculators/${calculator.slug}`)).toBe(calculator.title);
  });
});

describe("hasOwnPageTitle", () => {
  it.each(["/settings", "/calculators", "/calculators/sip", "/reports/monthly", "/money/recurring"])(
    "is true for %s",
    (pathname) => {
      expect(hasOwnPageTitle(pathname)).toBe(true);
    }
  );

  it.each(["/", "/money/transactions", "/investments", "/credit"])("is false for %s", (pathname) => {
    expect(hasOwnPageTitle(pathname)).toBe(false);
  });
});
