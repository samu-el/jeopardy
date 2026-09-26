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
      const builder = author.getByRole("dialog", { name: /Build a game/ });
      await expect(builder).toBeVisible();

      await builder.getByLabel("Game title").fill("Kitchen table quiz");

      // Fill the first clue of the first category — enough to be a real game.
      await builder.getByLabel("Category 1 name").first().fill("Sea creatures");
      await builder.getByLabel("Sea creatures $200 clue").fill("It has eight arms.");
      await builder.getByLabel("Sea creatures $200 answer").fill("What is an octopus?");

      await author.getByTestId("publish-game").click();
      // A board this bare gets a question before it's shared.
      await author.getByTestId("confirm-action").click();

      // A share link comes back, and it is a link — not a "saved" toast.
      await expect(author.getByTestId("publish-result")).toBeVisible({ timeout: 30_000 });
      const shown = await author.getByTestId("game-link").inputValue();
      const gameId = shown.split("game=")[1];
      expect(gameId, `expected a game id in "${shown}"`).toBeTruthy();

      // Publishing again updates the same link rather than minting a new one.
      await expect(author.getByTestId("publish-game")).toHaveText(/Update link/);

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
    // No board, no crash — the landing page says the link is dead.
    await expect(page.getByTestId("shared-game-error")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("new-game")).toBeVisible();
    expect(new URL(page.url()).searchParams.has("game")).toBe(false);
  });

  test("the builder opens from the landing page and survives a bad import", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("landing-build").click();
    const builder = page.getByRole("dialog", { name: /Build a game/ });
    await expect(builder).toBeVisible();

    await page.getByTestId("builder-import-input").setInputFiles({
      name: "shape.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"categories":"x","clues":"y"}'),
    });
    await expect(page.getByTestId("import-report")).toContainText("Couldn't import shape.json");
    await expect(builder.getByLabel("Game title")).toBeVisible();

    // An empty board lists what's missing at the top instead of doing nothing.
    await page.getByTestId("play-custom-game").click();
    await expect(page.getByTestId("builder-errors")).toBeVisible();
  });

  test("a CSV imports and plays straight from the landing page", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("landing-build").click();
    await page.getByTestId("builder-import-input").setInputFiles({
      name: "quiz.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        [
          "round,category,value,clue,answer,dd",
          "jeopardy,Rivers,200,It flows through Cairo.,What is the Nile?,",
          "jeopardy,Rivers,400,It flows through Baghdad.,What is the Tigris?,yes",
        ].join("\n"),
      ),
    });
    await expect(page.getByTestId("import-report")).toContainText("Imported quiz.csv");
    await page.getByTestId("play-custom-game").click();
    await page.getByTestId("confirm-action").click();
    await dismissOnboarding(page);
    await expect(page.getByTestId("board").getByText("Rivers")).toBeVisible({ timeout: 30_000 });
  });
});
