import { expect, test } from "@playwright/test";

test.describe("Full round", () => {
  test("lobby → start → pick → bot buzz → AI judge → scores", async ({ page }) => {
    await page.goto("/");

    // Lobby renders
    await expect(page.getByRole("heading", { name: "You", exact: true })).toBeVisible();

    // Start the game from lobby
    await page.getByRole("button", { name: "Start game" }).click();

    // We're now in the play screen
    await expect(page.getByRole("button", { name: "Begin" })).toBeVisible();
    await page.getByRole("button", { name: "Begin" }).click();

    // Board appears — there will be many $200 buttons
    const firstClue = page.getByRole("button", { name: "$200" }).first();
    await expect(firstClue).toBeVisible();
    await firstClue.click();

    // Wait for buzz unlock + bot to act + auto-judge / next clue button (up to ~22s)
    const nextClue = page.getByRole("button", { name: "Next clue" });
    await expect(nextClue).toBeVisible({ timeout: 25_000 });

    // Scoreboard text exists (any score, $0 or higher)
    const scoreboard = page.locator("text=Scoreboard");
    await expect(scoreboard).toBeVisible();
  });
});
