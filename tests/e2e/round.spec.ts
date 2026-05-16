import { expect, test } from "@playwright/test";

test.describe("Landing & room", () => {
  test("landing → new room → empty board shows pick prompt", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "New room" })).toBeVisible();
    await page.getByRole("button", { name: "New room" }).click();
    // We should land on the room screen with the empty board prompt
    await expect(page.getByText(/Pick an episode/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: "Begin" })).toBeDisabled();
  });
});
