import { expect, test } from "@playwright/test";
import { startFixtureGame } from "./helpers";

// Uses the fixture endpoint (?fixture=1 / NODE_ENV=test) so this test does
// not depend on the GitHub-hosted archive being reachable.
test.describe("Fixture round", () => {
  test("solo round flow: New Game → board → pick → clue → auto-close", async ({ page }) => {
    // One click deals a board and starts the round — no picker, no Begin.
    await startFixtureGame(page);

    // The round title card runs before the board goes live.
    await expect(page.getByTestId("round-intro")).toBeVisible({ timeout: 20_000 });

    // The fixture has $200 clues — pick the first one once the board opens.
    await page.getByRole("button", { name: /\$200/ }).first().click({ timeout: 15_000 });
    await expect(page.getByTestId("clue-stage")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("clue-stage").getByText("Two plus two.")).toBeVisible();

    // Nobody rings in: the room reveals the response and returns the board.
    await expect(page.getByTestId("correct-response")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("clue-stage")).toBeHidden({ timeout: 30_000 });
  });
});
