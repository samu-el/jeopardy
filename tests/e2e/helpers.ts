import type { Page } from "@playwright/test";

/**
 * The first-visit card sits over the whole room, so every spec that clicks
 * something in the toolbar has to get past it first.
 */
export async function dismissOnboarding(page: Page) {
  const dismiss = page.getByRole("button", { name: "Let’s play" });
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
  }
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

/** New room → dismiss onboarding → load the fixture board. */
export async function openRoomWithFixture(page: Page) {
  await routeFixtureEpisodes(page);
  await page.goto("/");
  await page.getByRole("button", { name: "New room" }).click();
  await dismissOnboarding(page);
  await page.getByRole("button", { name: "New game" }).click();
  await page.getByRole("button", { name: "Shuffle" }).click();
}
