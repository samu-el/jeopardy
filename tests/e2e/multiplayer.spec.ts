import { expect, test, type Browser, type Page } from "@playwright/test";
import { dismissOnboarding, enableChat, routeFixtureEpisodes } from "./helpers";

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
      await enableChat(room.guest);
      await enableChat(room.host);
      await room.guest.getByPlaceholder("Message").fill("hello from the guest");
      await room.guest.getByPlaceholder("Message").press("Enter");

      await expect(room.host.getByText("hello from the guest")).toBeVisible();
    } finally {
      await room.close();
    }
  });

  test("a name typed on the way in is the name the room uses", async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    try {
      await routeFixtureEpisodes(host);
      await host.goto("/");
      await host.getByTestId("new-game").click();
      await dismissOnboarding(host);
      const code = await revealRoomCode(host);

      // Typing a code used to join on the spot, with nowhere to say who you
      // were — the room called you "Player 4B2" and the chat agreed.
      await guest.goto("/");
      await guest.getByLabel("Room code").fill(code);
      await guest.getByRole("button", { name: "Join" }).click();

      // The field is filled in with the name the room would give you, so it
      // is not a surprise if you leave it alone.
      const nameField = guest.getByLabel("Your name");
      await expect(nameField).toHaveValue(/^Player [A-Z0-9]{3}$/);

      await nameField.fill("Zelda");
      await guest.getByRole("button", { name: "Join" }).click();
      await dismissOnboarding(guest);

      // On the lecterns, in the arrival notice, and on anything they say.
      await expect(host.getByText("Zelda", { exact: true })).toBeVisible();

      await enableChat(guest);
      await enableChat(host);
      await expect(host.getByText("Zelda joined")).toBeVisible();

      await guest.getByPlaceholder("Message").fill("hello");
      await guest.getByPlaceholder("Message").press("Enter");
      await expect(host.getByText("hello")).toBeVisible();
      await expect(host.getByText("Player", { exact: true })).toHaveCount(0);
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test("the last person in the room can still run the board", async ({ browser }) => {
    const room = await openSharedRoom(browser);
    const { guest } = room;
    try {
      // The host holds the chair, so the guest cannot open a clue yet.
      await expect(
        guest.getByRole("button", { name: /\$200/ }).first(),
      ).toBeDisabled();

      // The host walks away. Nobody is left to hand the chair over, so the
      // room has to do it — otherwise the guest is sitting at a board they
      // cannot touch.
      await room.closeHost();

      const tile = guest.getByRole("button", { name: /\$200/ }).first();
      await expect(tile).toBeEnabled({ timeout: 30_000 });
      await tile.click();
      await expect(guest.getByTestId("clue-stage")).toBeVisible();
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
  /** Closes the host's browser, leaving the guest alone in the room. */
  closeHost: () => Promise<void>;
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
  // The code opens the join card, the same one an invite link opens, so
  // there is exactly one place you are asked who you are.
  await guest.getByRole("button", { name: "Join" }).click();
  await expect(guest.getByLabel("Your name")).toBeVisible();
  await guest.getByRole("button", { name: "Join" }).click();
  await dismissOnboarding(guest);
  await expect(guest.getByTestId(/^podium-/)).toHaveCount(2);

  let hostOpen = true;
  return {
    host,
    guest,
    code,
    closeHost: async () => {
      if (!hostOpen) return;
      hostOpen = false;
      await hostContext.close();
    },
    close: async () => {
      if (hostOpen) await hostContext.close();
      await guestContext.close();
    },
  };
}
