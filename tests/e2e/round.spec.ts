import { expect, test } from "@playwright/test";

test.describe("Full round", () => {
  test("lobby → start → pick → bot buzz → AI judge → scores", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Start", exact: true }).click();
    await page.getByRole("button", { name: "Begin", exact: true }).click();

    const firstClue = page.getByRole("button", { name: "$200" }).first();
    await expect(firstClue).toBeVisible();
    await firstClue.click();

    const next = page.getByRole("button", { name: "Next", exact: true });
    await expect(next).toBeVisible({ timeout: 25_000 });
  });
});
