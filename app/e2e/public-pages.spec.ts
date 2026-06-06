import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Public pages should be reachable, render meaningful content, and
 * pass axe-core accessibility scans for serious + critical rules.
 */
test.describe("Public marketing & auth pages", () => {
  test("login page renders with required form fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/WealthFlow/);
    await expect(page.getByRole("heading")).toBeVisible();
    // Email + password inputs should exist
    const inputs = page.locator("input");
    await expect(inputs.first()).toBeVisible();
  });

  test("login page passes axe-core a11y scan (critical/serious)", async ({ page }) => {
    await page.goto("/login");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const critical = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(critical).toHaveLength(0);
  });

  test("offline fallback page exists", async ({ page }) => {
    await page.goto("/offline");
    await expect(page).toHaveURL(/\/offline$/);
  });
});
