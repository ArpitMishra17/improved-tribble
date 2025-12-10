import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Tour Launcher", () => {
  test("tour launcher is hidden for unauthenticated users", async ({ page }) => {
    // Visit a public page without logging in
    await page.goto("/jobs");
    await page.waitForLoadState("networkidle");

    // The tour launcher should NOT be visible
    const tourLauncher = page.locator('button[aria-label="Open help guide"]');
    await expect(tourLauncher).not.toBeVisible();
  });

  test("tour launcher appears for authenticated admin user", async ({ page }) => {
    // Login as admin using helper
    await loginAs(page, "admin");

    // Navigate to a page where the launcher should appear
    await page.goto("/jobs");
    await page.waitForLoadState("networkidle");

    // The tour launcher button should be visible
    const tourLauncher = page.locator('button[aria-label="Open help guide"]');
    await expect(tourLauncher).toBeVisible({ timeout: 10000 });

    // Click the tour launcher to open the dropdown
    await tourLauncher.click();

    // Verify the dropdown menu appears with tour options
    const dropdownContent = page.locator('text=Help & Tours');
    await expect(dropdownContent).toBeVisible();

    // Verify "Full Platform Tour" option exists
    const fullTourOption = page.locator('text=Full Platform Tour');
    await expect(fullTourOption).toBeVisible();
  });

  test("tour launcher appears for authenticated recruiter user", async ({ page }) => {
    // Login as recruiter using helper
    await loginAs(page, "recruiter");

    // Navigate to a page where the launcher should appear
    await page.goto("/jobs");
    await page.waitForLoadState("networkidle");

    // The tour launcher button should be visible
    const tourLauncher = page.locator('button[aria-label="Open help guide"]');
    await expect(tourLauncher).toBeVisible({ timeout: 10000 });
  });

  test("recruiter dashboard shows pipeline checklist", async ({ page }) => {
    await loginAs(page, "recruiter");
    await page.goto("/recruiter-dashboard");

    const checklistCard = page.getByTestId("pipeline-checklist-card");
    await expect(checklistCard).toBeVisible({ timeout: 10000 });

    // Checklist should either have actions or the empty-state hero
    const rows = checklistCard.getByTestId("pipeline-action-row");
    const rowCount = await rows.count();
    if (rowCount === 0) {
      await expect(checklistCard.getByText("AI-Powered Actions")).toBeVisible();
    } else {
      await expect(rows.first()).toBeVisible();
    }
  });
});
