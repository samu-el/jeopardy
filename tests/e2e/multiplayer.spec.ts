import { expect, test, type Browser, type Page } from "@playwright/test";
import { dismissOnboarding, routeFixtureEpisodes } from "./helpers";

/**
 * Two real browser contexts against one server-side room. These cover the
 * things solo play can't: a second person taking a seat, the board arriving
 * from the server, and a buzz travelling between clients.
 */
test.describe("Shared room", () => {
  test("a guest joins by code and both sides see the same roster", async ({ browser }) => {
    const room = await openSharedRoom(browser);
    try {
      await expect(room.host.getByTestId(/^podium-/)).toHaveCount(2);
      await expect(room.guest.getByTestId(/^podium-/)).toHaveCount(2);

      // The board is live for both the moment the room opens — no Begin step.
      await expect(room.host.getByTestId("board")).toBeVisible();
      await expect(room.guest.getByTestId("board")).toBeVisible();
      // Picking still belongs to whoever holds the board, not to any guest.
      await expect(room.guest.getByTestId("begin")).toHaveCount(0);
    } finally {
      await room.close();
    }
  });

  test("a guest joins through the invite link and plays on the same board", async ({
    browser,
  }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    try {
      await routeFixtureEpisodes(host);
      await host.goto("/");
      await host.getByTestId("new-game").click();
      await dismissOnboarding(host);
      // No invite step: every board is a room, the code is just masked.
      const code = await revealRoomCode(host);

      // Exactly the link the invite strip copies to the clipboard.
      await guest.goto(`/?room=${code}`);
      await expect(guest.getByRole("dialog", { name: "Join room" })).toBeVisible();
      await guest.getByLabel("Your name").fill("Guest");
      await guest.getByRole("button", { name: "Join" }).click();
      await dismissOnboarding(guest);

      // Seated in the host's room, under the name they typed.
      await expect(guest.getByTestId(/^podium-/)).toHaveCount(2);
      await expect(host.getByText("Guest", { exact: true })).toBeVisible();

      // And playing the host's board, not one of their own.
      await setBuzzWindow(host, "20 seconds — relaxed");
      await host.getByRole("button", { name: /\$200/ }).first().click();

      const buzzer = guest.getByTestId("buzzer");
      await expect(buzzer).toBeEnabled();
      await buzzer.click();
      await expect(host.getByText(/Guest rang in/)).toBeVisible();
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test("chat from one player reaches the other", async ({ browser }) => {
    const room = await openSharedRoom(browser);
    try {
      await room.guest.getByPlaceholder("Message").fill("hello from the guest");
      await room.guest.getByPlaceholder("Message").press("Enter");

      await expect(room.host.getByText("hello from the guest")).toBeVisible();
    } finally {
      await room.close();
    }
  });

  test("the host deals a board and the guest rings in on it", async ({ browser }) => {
    const room = await openSharedRoom(browser);
    const { host, guest } = room;
    try {
      // A cold dev server can eat most of the show's six-second window, so
      // play this one at the relaxed pace the settings panel offers.
      await setBuzzWindow(host, "20 seconds — relaxed");

      // The guest's board comes from the server — it has no game state of its own.
      await expect(guest.getByTestId("board").getByText("Math")).toBeVisible();

      await host.getByRole("button", { name: /\$200/ }).first().click();
      await expect(guest.getByTestId("clue-stage")).toBeVisible();
      await expect(
        guest.getByTestId("clue-stage").getByText("Two plus two."),
      ).toBeVisible();

      // Ring in from the guest; the host's screen names the player who did.
      const buzzer = guest.getByTestId("buzzer");
      await expect(buzzer).toBeEnabled();
      await buzzer.click();
      await expect(buzzer).toHaveText("IN!");
      await expect(host.getByText(/rang in/)).toBeVisible();
    } finally {
      await room.close();
    }
  });
});

/** Picks a buzz window from the settings panel, as the host would. */
async function setBuzzWindow(page: Page, option: string) {
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Buzz window").click();
  await page.getByRole("option", { name: option }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
}

interface SharedRoom {
  host: Page;
  guest: Page;
  code: string;
  close: () => Promise<void>;
}

/** Host opens a room; a guest joins it with the code from the invite strip. */
/**
 * The code is masked until asked for, so every spec that needs it reveals it
 * the way a player would.
 */
async function revealRoomCode(page: Page): Promise<string> {
  const chip = page.getByTestId("room-code");
  await expect(chip).toBeVisible({ timeout: 20_000 });
  // Masked to start with — that is the point of the reveal control.
  expect(((await chip.textContent()) ?? "").trim()).toMatch(/^•+$/);
  await page.getByTestId("reveal-room-code").click();
  const code = ((await chip.textContent()) ?? "").trim();
  expect(code).toMatch(/^[A-Z0-9]{4}$/);
  return code;
}

async function openSharedRoom(browser: Browser): Promise<SharedRoom> {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  // Deal a board first, then open a room to play it in.
  await routeFixtureEpisodes(host);
  await host.goto("/");
  await host.getByTestId("new-game").click();
  await dismissOnboarding(host);
  const code = await revealRoomCode(host);

  await guest.goto("/");
  await guest.getByLabel("Room code").fill(code);
  await guest.getByRole("button", { name: "Join" }).click();
  await dismissOnboarding(guest);
  await expect(guest.getByTestId(/^podium-/)).toHaveCount(2);

  return {
    host,
    guest,
    code,
    close: async () => {
      await hostContext.close();
      await guestContext.close();
    },
  };
}
