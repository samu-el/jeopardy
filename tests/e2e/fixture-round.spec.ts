import { expect, test } from "@playwright/test";
import { dismissOnboarding, routeFixtureEpisodes } from "./helpers";

// Uses the fixture endpoint (?fixture=1 / NODE_ENV=test) so this test does
// not depend on the GitHub-hosted archive being reachable.
test.describe("Fixture round", () => {
  test("solo round flow: New room → board → pick → clue → auto-close", async ({ page }) => {
    await routeFixtureEpisodes(page);

    await page.goto("/");
    await page.getByRole("button", { name: "New room" }).click();
    await dismissOnboarding(page);

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

    // The round title card runs before the board goes live.
    await expect(page.getByText("JEOPARDY!", { exact: true })).toBeVisible();

    // The fixture has $200 clues — pick the first one once the board opens.
    await page.getByRole("button", { name: /\$200/ }).first().click({ timeout: 15_000 });
    await expect(page.getByTestId("clue-stage")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("clue-stage").getByText("Two plus two.")).toBeVisible();

    // Nobody rings in: the room reveals the response and returns the board.
    await expect(page.getByTestId("correct-response")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("clue-stage")).toBeHidden({ timeout: 30_000 });
  });
});
