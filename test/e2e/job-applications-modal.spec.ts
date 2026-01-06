import { test, expect } from "@playwright/test";
import { loginAs, getPipelineJobId } from "./helpers";

test.describe("Job applications detail modal", () => {
  test("opens modal from kanban card with resume preview tab", async ({ page }) => {
    await loginAs(page, "recruiter");
    const jobId = await getPipelineJobId(page);
    if (!jobId) test.skip(true, "No pipeline job fixture available");

    await page.goto(`/jobs/${jobId}/applications`);

    // Click first card
    const card = page.getByTestId("kanban-card").first().or(page.locator("[data-testid='application-card']").first());
    if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "No application cards visible in kanban");
    }
    await card.click();

    // Modal should open (detail modal)
    const modal = page.getByRole("dialog").filter({ hasText: /Resume Preview|Details/i }).first();
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Resume preview tab or pane should be present
    const resumeTab = modal.getByText(/Resume Preview/i).first();
    if (await resumeTab.isVisible().catch(() => false)) {
      await resumeTab.click();
    }
    // Expect iframe/object container
    const iframe = modal.locator("iframe, object").first();
    await expect(iframe).toBeVisible({ timeout: 5000 });
  });
});

