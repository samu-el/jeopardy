import { expect, test } from "@playwright/test";
import { dismissOnboarding, routeFixtureEpisodes } from "./helpers";

/**
 * The television case: a display shows the board to the room while the people
 * playing hold their own devices. The display must take no seat, and it must
 * follow the same room the players are in.
 */
test.describe("Display mode", () => {
  test("a display shows the board and the join code without taking a seat", async ({
    browser,
  }) => {
    const playerContext = await browser.newContext();
    // A television is a landscape screen across a room, not a laptop.
    const displayContext = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const player = await playerContext.newPage();
    const display = await displayContext.newPage();

    try {
      await routeFixtureEpisodes(player);
      await player.goto("/");
      await player.getByTestId("new-game").click();
      await expect(player.getByTestId("board")).toBeVisible({ timeout: 30_000 });
      await dismissOnboarding(player);

      const chip = player.getByTestId("room-code");
      await expect(chip).toBeVisible({ timeout: 20_000 });
      await player.getByTestId("reveal-room-code").click();
      const code = ((await chip.textContent()) ?? "").trim();
      expect(code).toMatch(/^[A-Z0-9]{4}$/);

      // The display link connects on its own: nobody types a name on a TV.
      await display.goto(`/?room=${code}&display=1`);
      await expect(display.getByTestId("display-view")).toBeVisible({ timeout: 30_000 });

      // The code is plain here on purpose — the room needs to read it.
      await expect(display.getByTestId("display-room-code")).toHaveText(code, {
        timeout: 20_000,
      });
      // And a QR so a phone joins without typing anything at all.
      await expect(display.getByTestId("display-qr")).toBeVisible();

      // The same board the player is looking at.
      await expect(display.getByTestId("board").getByText("Math")).toBeVisible({
        timeout: 20_000,
      });

      // A display is a spectator: it must not appear as a contestant, on
      // either screen, or it would be sitting in a seat and owed a buzzer.
      await expect(player.getByTestId(/^podium-/)).toHaveCount(1);
      await expect(display.getByText("Display", { exact: true })).toHaveCount(0);
    } finally {
      await playerContext.close();
      await displayContext.close();
    }
  });

  test("the clue the player opens goes up on the display", async ({ browser }) => {
    const playerContext = await browser.newContext();
    const displayContext = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const player = await playerContext.newPage();
    const display = await displayContext.newPage();

    try {
      await routeFixtureEpisodes(player);
      await player.goto("/");
      await player.getByTestId("new-game").click();
      await expect(player.getByTestId("board")).toBeVisible({ timeout: 30_000 });
      await dismissOnboarding(player);
      await player.getByTestId("reveal-room-code").click();
      const code = ((await player.getByTestId("room-code").textContent()) ?? "").trim();

      await display.goto(`/?room=${code}&display=1`);
      await expect(display.getByTestId("display-view")).toBeVisible({ timeout: 30_000 });
      await expect(display.getByTestId("board")).toBeVisible({ timeout: 20_000 });

      await player.getByRole("button", { name: /\$200/ }).first().click({ timeout: 20_000 });

      // The clue takes the whole screen, read from the room's own state.
      await expect(display.getByTestId("display-clue")).toBeVisible({ timeout: 20_000 });
      await expect(display.getByTestId("display-clue")).toContainText("Two plus two", {
        ignoreCase: true,
      });
    } finally {
      await playerContext.close();
      await displayContext.close();
    }
  });
});
