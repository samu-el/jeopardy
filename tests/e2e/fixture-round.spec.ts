import { expect, test } from "@playwright/test";

// Uses the fixture endpoint (?fixture=1 / NODE_ENV=test) so this test does
// not depend on the GitHub-hosted archive being reachable.
test.describe("Fixture round", () => {
  test("solo round flow: New room → board → pick → judge to next clue", async ({ page }) => {
    // Intercept the random endpoint to force the fixture board regardless of env
    await page.route("**/api/episodes?mode=random*", async (route) => {
      const response = await page.request.get(
        new URL("/api/episodes?mode=random&fixture=1", route.request().url())
          .toString(),
      );
      const body = await response.text();
      await route.fulfill({
        status: response.status(),
        contentType: "application/json",
        body,
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "New room" }).click();

    // Empty board is visible until an episode is loaded
    await expect(page.getByRole("button", { name: "Begin" })).toBeDisabled();

    // Open the picker and shuffle
    await page.getByRole("button", { name: "New game" }).click();
    await page.getByRole("button", { name: "Shuffle" }).click();

    // Begin should enable once an episode is loaded
    await expect(page.getByRole("button", { name: "Begin" })).toBeEnabled({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Begin" }).click();

    // The fixture has $200 clues — pick the first one
    await page.getByRole("button", { name: "$200" }).first().click();
    // The clue text from the fixture should now be visible
    await expect(page.getByText("Two plus two.")).toBeVisible({ timeout: 10_000 });
  });
});
