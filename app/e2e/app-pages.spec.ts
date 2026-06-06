import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Protected app pages — only runnable when DEV_AUTH_BYPASS=true is set
 * on the server, which lets Playwright skip the Google sign-in dance.
 */
const skipUnlessBypass = process.env.DEV_AUTH_BYPASS !== "true";

test.describe("Authenticated app pages (DEV_AUTH_BYPASS only)", () => {
  test.skip(skipUnlessBypass, "DEV_AUTH_BYPASS not enabled");

  test("dashboard loads", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Page either shows app shell or the onboarding gate; both are valid.
    const text = await page.locator("body").textContent();
    expect(text?.length ?? 0).toBeGreaterThan(100);
  });

  test("dashboard a11y", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const critical = results.violations.filter(
      (v) => v.impact === "critical"
    );
    expect(critical).toHaveLength(0);
  });

  test("settings page renders", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/settings/);
  });

  test("money import page renders", async ({ page }) => {
    await page.goto("/money/import");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/Import bank statement/i)).toBeVisible();
  });
});
