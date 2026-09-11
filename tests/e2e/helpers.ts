import { expect, type Page } from "@playwright/test";

/**
 * The first-visit card sits over the whole room, so every spec that clicks
 * something in the room has to get past it first. It mounts with the play
 * screen, which is one fetch away from the click that deals the board, so
 * this waits for it rather than sampling a page that hasn't switched yet.
 */
export async function dismissOnboarding(page: Page) {
  const dismiss = page.getByRole("button", { name: "Let’s play" });
  await dismiss.click({ timeout: 10_000 }).catch(() => {
    // Already dismissed for this browser profile — nothing to clear.
  });
  await expect(dismiss).toHaveCount(0);
}

/** Forces the bundled fixture board so specs don't depend on the archive. */
export async function routeFixtureEpisodes(page: Page) {
  await page.route("**/api/episodes?mode=random*", async (route) => {
    const response = await page.request.get(
      new URL("/api/episodes?mode=random&fixture=1", route.request().url()).toString(),
    );
    await route.fulfill({
      status: response.status(),
      contentType: "application/json",
      body: await response.text(),
    });
  });
}

/** New Game deals a board straight from the landing page. */
export async function startFixtureGame(page: Page) {
  await routeFixtureEpisodes(page);
  await page.goto("/");
  await page.getByTestId("new-game").click();
  await expect(page.getByTestId("board")).toBeVisible({ timeout: 30_000 });
  await dismissOnboarding(page);
}

/**
 * Chat is off unless asked for, so a spec that exercises it turns it on the
 * way a player would.
 */
export async function enableChat(page: Page) {
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Chat").check();
  await page.keyboard.press("Escape");
  await expect(page.getByPlaceholder("Message")).toBeVisible();
}
