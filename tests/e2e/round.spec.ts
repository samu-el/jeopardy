import { expect, test } from "@playwright/test";
import { dismissOnboarding, routeFixtureEpisodes } from "./helpers";

test.describe("Landing & room", () => {
  test("New Game deals a board and starts the round in one click", async ({ page }) => {
    await routeFixtureEpisodes(page);
    await page.goto("/");

    const newGame = page.getByTestId("new-game");
    await expect(newGame).toHaveText(/New Game/);
    await newGame.click();
    await dismissOnboarding(page);

    // Straight into a live round: a real board, no picker and no Begin step.
    await expect(page.getByTestId("board").getByText("Math")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: /\$200/ }).first()).toBeEnabled({
      timeout: 20_000,
    });
    await expect(page.getByTestId("begin")).toHaveCount(0);
  });
});
