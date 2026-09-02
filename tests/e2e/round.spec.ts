import { expect, test } from "@playwright/test";

test.describe("Landing & room", () => {
  test("landing → new room → empty board has disabled Begin", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "New room" })).toBeVisible();
    await page.getByRole("button", { name: "New room" }).click();
    // Land on the room screen — toolbar (New game button) is visible and Begin
    // is disabled until an episode is loaded.
    await expect(page.getByRole("button", { name: "New game" })).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByTestId("begin")).toBeDisabled();
  });
});
