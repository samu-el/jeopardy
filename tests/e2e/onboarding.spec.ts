import { expect, test } from "@playwright/test";
import { routeFixtureEpisodes } from "./helpers";

test.describe("Onboarding", () => {
  test("shows once on first visit, never again after dismissal", async ({ page, context }) => {
    await context.addInitScript(() => {
      try {
        window.localStorage.clear();
      } catch {
        // ignore
      }
    });
    await routeFixtureEpisodes(page);
    await page.goto("/");
    await page.getByTestId("new-game").click();

    // The card comes up over the board New Game just dealt.
    await expect(page.getByText("Three steps and")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Let’s play" }).click();
    await expect(page.getByText("Three steps and")).toHaveCount(0);

    // Reload — should not show again
    await page.reload();
    await expect(page.getByText("Three steps and")).toHaveCount(0);
  });
});
