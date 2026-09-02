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

      // Starting the game belongs to the host alone.
      await expect(room.guest.getByRole("button", { name: "Begin" })).toHaveCount(0);
      await expect(room.guest.getByText("Waiting for the host")).toBeVisible();
      await expect(room.host.getByRole("button", { name: "Begin" })).toBeVisible();
    } finally {
      await room.close();
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

      await host.getByRole("button", { name: "New game" }).click();
      await host.getByRole("button", { name: "Shuffle" }).click();
      await expect(host.getByRole("button", { name: "Begin" })).toBeEnabled();
      await host.getByRole("button", { name: "Begin" }).click();

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
async function openSharedRoom(browser: Browser): Promise<SharedRoom> {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await routeFixtureEpisodes(host);
  await host.goto("/");
  await host.getByRole("button", { name: "New room" }).click();
  await dismissOnboarding(host);
  await host.getByRole("button", { name: "Invite players" }).click();

  const codeChip = host.getByRole("button", { name: /Copy invite link/ });
  await expect(codeChip).toBeVisible();
  const code = ((await codeChip.textContent()) ?? "").trim();
  expect(code).toMatch(/^[A-Z0-9]{4}$/);

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
