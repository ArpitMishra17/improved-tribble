import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Applications resume review", () => {
  test("opens review modal with resume preview and actions", async ({ page }) => {
    await loginAs(page, "recruiter");
    await page.goto("/applications");

    // Click first Review button
    const reviewButtons = page.getByRole("button", { name: /review/i });
    const hasButtons = await reviewButtons.count();
    if (hasButtons === 0) {
      test.skip(true, "No applications available to review");
    }
    await reviewButtons.first().click();

    // Modal should open
    const modal = page.getByTestId("resume-review-modal");
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Resume preview frame present
    await expect(modal.getByTestId("resume-preview-frame")).toBeVisible();

    // Action buttons should be present
    await expect(modal.getByRole("button", { name: /Move to Screening/i })).toBeVisible();
    await expect(modal.getByRole("button", { name: /Reject/i })).toBeVisible();
  });
});
