import { expect, test } from "@playwright/test";
import { dismissOnboarding, routeFixtureEpisodes, startFixtureGame } from "./helpers";

test.describe("Onboarding", () => {
  test("shows once on first visit, never again after dismissal", async ({ page, context }) => {
    await context.addInitScript(() => {
      try {
        window.localStorage.clear();
      } catch {
        // ignore
      }
    });
    await routeFixtureEpisodes(page);
    await page.goto("/");
    await page.getByTestId("new-game").click();

    // The card comes up over the board New Game just dealt.
    await expect(page.getByText("Three steps and")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Let’s play" }).click();
    await expect(page.getByText("Three steps and")).toHaveCount(0);

    // Reload — should not show again
    await page.reload();
    await expect(page.getByText("Three steps and")).toHaveCount(0);
  });

  test("is a named dialog that takes focus and closes on Escape", async ({ page }) => {
    await routeFixtureEpisodes(page);
    await page.goto("/");
    await page.getByTestId("new-game").click();
    const dialog = page.getByRole("dialog", { name: /Three steps/ });
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Let’s play" })).toBeFocused();
    // Tab stays inside the card rather than wandering onto the board behind it.
    await page.keyboard.press("Tab");
    const inside = await dialog.evaluate((node) => node.contains(document.activeElement));
    expect(inside).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("speaks to touch screens about tapping, not Space", async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    try {
      await routeFixtureEpisodes(page);
      await page.goto("/");
      await page.getByTestId("new-game").click();
      const dialog = page.getByRole("dialog", { name: /Three steps/ });
      await expect(dialog).toContainText("Tap the buzzer", { timeout: 30_000 });
      await expect(dialog).not.toContainText("Press Space");
    } finally {
      await context.close();
    }
  });
});

test.describe("Landing", () => {
  test("has one h1 and asks for a name before New Game", async ({ page }) => {
    await routeFixtureEpisodes(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);

    await page.getByLabel("Player name").fill("Ada Lovelace");
    await page.getByTestId("new-game").click();
    await dismissOnboarding(page);
    await expect(page.getByTestId("board")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Ada Lovelace", { exact: false }).first()).toBeVisible();
  });

  test("the room code box takes a pasted invite link and only whole codes", async ({ page }) => {
    await page.goto("/");
    const code = page.getByLabel("Room code");
    const join = page.getByRole("button", { name: "Join" });
    await code.fill("AB");
    await expect(join).toBeDisabled();
    await code.fill("http://localhost:3000/?room=zz9z");
    await expect(code).toHaveValue("ZZ9Z");
    await expect(join).toBeEnabled();
    await code.press("Enter");

    // The join card: focus on the name, Enter submits, Escape cancels.
    const card = page.getByRole("dialog", { name: "Join room" });
    await expect(card).toBeVisible();
    await expect(card.getByLabel("Your name")).toBeFocused();
    await card.getByLabel("Your name").press("Enter");
    await expect(card.getByRole("alert")).toBeVisible({ timeout: 20_000 });
    await card.getByLabel("Your name").press("Escape");
    await expect(card).toHaveCount(0);
    // The failed join's message went with the card.
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  });

  test("changing the game mid-game asks before replacing the board", async ({ page }) => {
    await startFixtureGame(page);
    await page.getByTestId("change-game").click();
    const picker = page.getByRole("dialog", { name: "Change game" });
    await expect(picker).toBeVisible();
    await expect(picker.getByRole("tab")).toHaveCount(3);

    await picker.getByRole("button", { name: "Shuffle", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: /Replace the board/ });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Keep playing" }).click();
    await expect(confirm).toHaveCount(0);

    await picker.getByRole("button", { name: "Shuffle", exact: true }).click();
    const dealt = page.waitForResponse(/mode=random/);
    await confirm.getByRole("button", { name: "Replace and play" }).click();
    await dealt;
    // Every dialog is gone once the new board is dealt, not just hidden behind the confirm.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("board")).toBeVisible();
  });
});
