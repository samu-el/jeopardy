import { expect, test } from "@playwright/test";
import { dismissOnboarding, routeFixtureEpisodes } from "./helpers";

/**
 * A custom game is only worth building if someone else can play it. This
 * drives the whole path: write clues in the builder, publish them to the
 * Worker, then open the share link in a browser that has never seen them.
 */
test.describe("Custom games", () => {
  test("a published game plays from its share link in another browser", async ({
    browser,
  }) => {
    const authorContext = await browser.newContext();
    const friendContext = await browser.newContext();
    const author = await authorContext.newPage();
    const friend = await friendContext.newPage();

    try {
      await routeFixtureEpisodes(author);
      await author.goto("/");
      await author.getByTestId("new-game").click();
      await expect(author.getByTestId("board")).toBeVisible({ timeout: 30_000 });
      await dismissOnboarding(author);

      // The builder is reachable from the room, not hidden behind a URL.
      await author.getByRole("button", { name: "More" }).click();
      await author.getByTestId("open-builder").click();
      const builder = author.getByRole("dialog");
      await expect(builder).toBeVisible();

      await builder.getByLabel("Title").fill("Kitchen table quiz");

      // Fill the first clue of the first category — enough to be a real game.
      // Category names are placeholder-labelled; "Clue"/"Answer" are labelled.
      await builder.getByPlaceholder("Cat 1").fill("Sea creatures");
      await builder.getByLabel("Clue", { exact: true }).first().fill("It has eight arms.");
      await builder
        .getByLabel("Answer", { exact: true })
        .first()
        .fill("What is an octopus?");

      await author.getByTestId("publish-game").click();

      // A share link comes back, and it is a link — not a "saved" toast.
      const link = author.getByTestId("copy-game-link");
      await expect(link).toBeVisible({ timeout: 30_000 });
      const shown = ((await link.textContent()) ?? "").trim();
      const gameId = shown.split("game=")[1];
      expect(gameId, `expected a game id in "${shown}"`).toBeTruthy();

      // A browser that has never seen this game opens the link and plays it.
      await friend.goto(`/?game=${gameId}`);
      await dismissOnboarding(friend);
      await expect(friend.getByTestId("board").getByText("Sea creatures")).toBeVisible({
        timeout: 30_000,
      });

      await friend.getByRole("button", { name: /\$/ }).first().click({ timeout: 20_000 });
      await expect(friend.getByTestId("clue-stage")).toBeVisible({ timeout: 20_000 });
      await expect(friend.getByTestId("clue-stage")).toContainText("eight arms", {
        ignoreCase: true,
      });
    } finally {
      await authorContext.close();
      await friendContext.close();
    }
  });

  test("a link to a game that was never published says so", async ({ page }) => {
    await page.goto("/?game=zzzzzzzzzz");
    // No board, no crash — the app stays on the landing page.
    await expect(page.getByTestId("new-game")).toBeVisible({ timeout: 20_000 });
  });
});
