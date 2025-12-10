import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Pipeline Action Checklist", () => {
  test("renders checklist and reanalyze affordances", async ({ page }) => {
    await loginAs(page, "recruiter");
    await page.goto("/recruiter-dashboard");

    const card = page.getByTestId("pipeline-checklist-card");
    await expect(card).toBeVisible();

    // Either show the empty-state hero or action rows
    const actionRows = card.getByTestId("pipeline-action-row");
    const rowCount = await actionRows.count();

    if (rowCount === 0) {
      await expect(card.getByText("AI-Powered Actions")).toBeVisible();
      await expect(card.getByTestId("reanalyze-button")).toBeEnabled();
    } else {
      // Basic expectations when items exist
      await expect(actionRows.first()).toBeVisible();

      // Reanalyze should be disabled until completion threshold or expiry
      const reanalyze = card.getByTestId("reanalyze-button");
      await expect(reanalyze).toBeDisabled();

      // Check at least one checkbox to ensure progress updates
      const firstCheckbox = actionRows.first().getByRole("checkbox");
      await firstCheckbox.check({ force: true });
      // Button may still be disabled if more items remain; just ensure it is present
      await expect(reanalyze).toBeVisible();
    }
  });

  test("shows verification summary after reanalyze when allowed", async ({ page }) => {
    await loginAs(page, "recruiter");
    await page.goto("/recruiter-dashboard");

    const card = page.getByTestId("pipeline-checklist-card");
    await expect(card).toBeVisible();

    const actionRows = card.getByTestId("pipeline-action-row");
    const rowCount = await actionRows.count();

    // If no items, skip reanalyze verification path
    if (rowCount === 0) {
      test.skip(true, "No pipeline actions available in fixtures");
    }

    // Skip if too many items - not practical for E2E testing the full flow
    if (rowCount > 20) {
      test.skip(true, `Too many pipeline actions (${rowCount}) for E2E verification test`);
    }

    // Complete all items to unlock reanalyze (fixtures are small)
    for (let i = 0; i < rowCount; i++) {
      const checkbox = actionRows.nth(i).getByRole("checkbox");
      await checkbox.check({ force: true });
    }

    const reanalyze = card.getByTestId("reanalyze-button");
    await reanalyze.click();

    // Expect a verification summary once reanalyze runs
    const summary = card.getByTestId("verification-summary");
    await expect(summary).toBeVisible({ timeout: 10000 });
  });
});
