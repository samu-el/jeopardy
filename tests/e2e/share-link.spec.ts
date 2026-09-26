import { expect, test, type Page } from "@playwright/test";

/** Answers the "is this room open?" lookup without a rooms worker behind it. */
async function stubLookup(page: Page, exists: boolean) {
  await page.route("**/room/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ exists }),
    });
  });
}

test.describe("Share link join flow", () => {
  test("?room= URL opens the join card on landing", async ({ page }) => {
    await stubLookup(page, true);
    await page.goto("/?room=r-abcdef");
    await expect(page.getByRole("dialog", { name: "Join room" })).toBeVisible();
    await expect(page.getByText("r-abcdef")).toBeVisible();
    await expect(page.getByLabel("Your name")).toBeVisible();
    await expect(page.getByRole("button", { name: "Join" })).toBeVisible();
  });

  test("Cancel restores the standard landing", async ({ page }) => {
    await stubLookup(page, true);
    await page.goto("/?room=r-test");
    await expect(page.getByText("r-test")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("new-game")).toBeVisible();
  });

  test("a code for no open room says the room isn't open", async ({ page }) => {
    await stubLookup(page, false);
    await page.goto("/?room=QQQQ");
    await page.getByRole("button", { name: "Join" }).click();
    await expect(page.getByText(/isn't open/)).toBeVisible();
    // The spinner stops: Join can be pressed again.
    await expect(page.getByRole("button", { name: "Join" })).toBeEnabled();
  });

  test("an unreachable rooms service is not reported as a closed room", async ({ page }) => {
    await page.route("**/room/**", (route) => route.abort("connectionrefused"));
    await page.goto("/?room=QQQQ");
    await page.getByRole("button", { name: "Join" }).click();
    await expect(page.getByText(/Can't reach the game server/)).toBeVisible();
    await expect(page.getByText(/isn't open/)).toHaveCount(0);
  });
});
