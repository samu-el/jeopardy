import { expect, test } from "@playwright/test";

test.describe("Share link join flow", () => {
  test("?room= URL opens the join card on landing", async ({ page }) => {
    // Stub the room check so we don't depend on a running socket bridge
    await page.route("**/api/rooms/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "r-abcdef", exists: true }),
      });
    });
    await page.goto("/?room=r-abcdef");
    await expect(page.getByRole("dialog", { name: "Join room" })).toBeVisible();
    await expect(page.getByText("r-abcdef")).toBeVisible();
    await expect(page.getByLabel("Your name")).toBeVisible();
    await expect(page.getByRole("button", { name: "Join" })).toBeVisible();
  });

  test("Cancel restores the standard landing", async ({ page }) => {
    await page.route("**/api/rooms/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "r-test", exists: true }),
      });
    });
    await page.goto("/?room=r-test");
    await expect(page.getByText("r-test")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("new-game")).toBeVisible();
  });
});
