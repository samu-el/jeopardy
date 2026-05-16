import { expect, test } from "@playwright/test";

test.describe("Onboarding", () => {
  test("shows once on first visit, never again after dismissal", async ({ page, context }) => {
    await context.addInitScript(() => {
      try {
        window.localStorage.clear();
      } catch {
        // ignore
      }
    });
    await page.goto("/");
    await page.getByRole("button", { name: "New room" }).click();
    // Onboarding card visible
    await expect(page.getByText("Three steps and")).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: "Let’s play" }).click();
    await expect(page.getByText("Three steps and")).not.toBeVisible();

    // Reload — should not show again
    await page.reload();
    await expect(page.getByText("Three steps and")).not.toBeVisible({ timeout: 3_000 });
  });
});
