import { expect, test, type Page } from "@playwright/test";
import { dismissOnboarding, routeFixtureEpisodes, startFixtureGame } from "./helpers";

interface Snapshot {
  round: string;
  roundIntroEndsAt?: number;
  board: { id: string; revealed: boolean }[];
  currentClue?: {
    kind: string;
    phase: string;
    round: string;
    clue?: string;
    waitingForWager: string[];
    currentJudgePlayerId?: string;
  };
}

type StoreHandle = { __game: { getState: () => Record<string, unknown> } };

/**
 * Drives the room through the dev-only store handle, sending the same
 * intents the buttons send. Clicking through four clues and a Final would
 * make this spec about the clue controls; it is about what the TV shows.
 */
async function send(page: Page, command: Record<string, unknown>) {
  await page.evaluate((cmd) => {
    const store = (window as unknown as StoreHandle).__game.getState() as {
      runtime?: { sendCommand: (id: string, c: unknown) => void };
      selfId: () => string;
    };
    store.runtime?.sendCommand(store.selfId(), cmd);
  }, command);
}

async function snapshot(page: Page): Promise<Snapshot | null> {
  return page.evaluate(() => {
    const state = (window as unknown as StoreHandle).__game.getState().publicState;
    return state ? (JSON.parse(JSON.stringify(state)) as Snapshot) : null;
  });
}

async function selfId(page: Page): Promise<string> {
  return page.evaluate(() =>
    ((window as unknown as StoreHandle).__game.getState().selfId as () => string)(),
  );
}

/** The fixture board's responses, by clue. */
const fixtureAnswers: Record<string, string> = {
  "Two plus two.": "four",
  "Pi to two places.": "3.14",
  "Mix red and blue.": "purple",
  "Color of an emerald.": "green",
};

async function phaseOf(page: Page) {
  return (await snapshot(page))?.currentClue?.phase ?? "none";
}

/**
 * Plays the opening round with everyone right: the host takes three clues
 * and the guest one, so both finish in the black and both play Final.
 */
async function playOutRound(host: Page, guest: Page) {
  for (let index = 0; index < 12; index += 1) {
    await expect
      .poll(
        async () => {
          const s = await snapshot(host);
          return Boolean(s && (!s.roundIntroEndsAt || s.roundIntroEndsAt < Date.now()));
        },
        { timeout: 20_000 },
      )
      .toBe(true);
    const s = (await snapshot(host))!;
    if (s.round !== "jeopardy") return;
    const next = s.board.find((clue) => !clue.revealed);
    if (!next) return;
    await send(host, { type: "pick-clue", clueId: next.id });
    await expect.poll(() => phaseOf(host)).not.toBe("none");

    let answerer = index === 1 ? guest : host;
    if ((await snapshot(host))!.currentClue!.kind === "daily-double") {
      // The picker owns a Daily Double: stake the minimum and answer it.
      answerer = host;
      await send(host, { type: "submit-wager", amount: 5 });
      await expect.poll(() => phaseOf(host), { timeout: 20_000 }).toBe("answering");
    } else {
      // The phase in a snapshot is as of that snapshot, and the readout ends
      // without one, so ring in until the room takes it.
      await expect
        .poll(
          async () => {
            if ((await phaseOf(host)) === "answering") return true;
            await send(answerer, { type: "buzz" });
            await host.waitForTimeout(350);
            return (await phaseOf(host)) === "answering";
          },
          { timeout: 20_000, intervals: [100] },
        )
        .toBe(true);
    }
    const text = (await snapshot(host))!.currentClue!.clue ?? "";
    await send(answerer, { type: "submit-answer", answer: fixtureAnswers[text] ?? "" });
    await expect.poll(() => phaseOf(host), { timeout: 20_000 }).toMatch(/judging|resolved/);
    // The judge may already have ruled; if not, rule it right.
    for (let i = 0; i < 3 && (await phaseOf(host)) === "judging"; i += 1) {
      const target = (await snapshot(host))?.currentClue?.currentJudgePlayerId;
      if (target) await send(host, { type: "judge-answer", targetPlayerId: target, correct: true });
      await host.waitForTimeout(300);
    }
    await send(host, { type: "skip" });
    await expect
      .poll(async () => {
        const c = (await snapshot(host))?.currentClue;
        return !c || c.kind === "final";
      })
      .toBe(true);
  }
}

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
      // And the television carries no lectern at all — not even the
      // players' — because it is there to show the board.
      await expect(display.getByTestId(/^podium-/)).toHaveCount(0);

      // The join panel goes away completely — QR, code and URL — and the
      // board keeps playing without it.
      await display.getByTestId("hide-join-panel").click();
      await expect(display.getByTestId("display-join")).toHaveCount(0);
      await expect(display.getByTestId("display-qr")).toHaveCount(0);
      await expect(display.getByTestId("display-room-code")).toHaveCount(0);
      await expect(display.getByTestId("board")).toBeVisible();

      // Hidden stays hidden across a reload, so a TV set up once stays set up.
      await display.reload();
      await expect(display.getByTestId("display-view")).toBeVisible({ timeout: 30_000 });
      await expect(display.getByTestId("display-qr")).toHaveCount(0);

      // And it can be brought back without hunting for the URL again.
      await display.getByTestId("show-join-panel").click();
      await expect(display.getByTestId("display-qr")).toBeVisible();
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

      // The clue fills the television, stripped to the question itself.
      await expect(display.getByTestId("tv-clue")).toBeVisible({ timeout: 20_000 });
      await expect(display.getByTestId("tv-clue-text")).toContainText("Two plus two", {
        ignoreCase: true,
      });
    } finally {
      await playerContext.close();
      await displayContext.close();
    }
  });

  test("the television runs the board: tile, answer, board", async ({ page }) => {
    await startFixtureGame(page);

    // TV mode is this tab, not a second one: the client keeps its seat and
    // its host chair, which is what makes the screen able to run the game.
    await page.getByTestId("open-display").click();
    await expect(page.getByTestId("display-view")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("board")).toBeVisible();
    // The board and nothing else: no lecterns, no names, no scores.
    await expect(page.getByTestId(/^podium-/)).toHaveCount(0);

    // One: a tile opens the clue full frame.
    await page.getByRole("button", { name: /\$200/ }).first().click({ timeout: 30_000 });
    await expect(page.getByTestId("tv-clue")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("tv-clue-text")).toContainText("Two plus two", {
      ignoreCase: true,
    });
    // Nothing else is on the clue — no buzzer, no timer, no judging.
    await expect(page.getByTestId("buzzer")).toHaveCount(0);

    // Two: the answer.
    await page.getByTestId("tv-clue").click();
    await expect(page.getByTestId("tv-answer")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("tv-answer")).toContainText("four", {
      ignoreCase: true,
    });

    // Three: back to the board, with that clue spent.
    await page.getByTestId("tv-clue").click();
    await expect(page.getByTestId("tv-clue")).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByTestId("board")).toBeVisible();

    // And out again, to the room this tab still belongs to.
    await page.getByTestId("exit-display").click();
    await expect(page.getByTestId("display-view")).toHaveCount(0);
    await expect(page.getByTestId("open-display")).toBeVisible();
  });

  test("a display pointed at a closed room says so, with no QR for it", async ({ page }) => {
    await page.goto("/?room=QQQQ&display=1");
    await expect(page.getByTestId("display-view")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("display-room-unavailable")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("display-room-unavailable")).toContainText("QQQQ");
    await expect(page.getByTestId("display-connecting")).toHaveCount(0);
    await expect(page.getByTestId("display-qr")).toHaveCount(0);
    await expect(page.getByTestId("display-join")).toHaveCount(0);
  });

  test("Final Jeopardy and the results play out on the television", async ({ browser }) => {
    test.setTimeout(180_000);
    const hostContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const displayContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    const display = await displayContext.newPage();

    try {
      await startFixtureGame(host);
      await host.getByTestId("reveal-room-code").click();
      const code = ((await host.getByTestId("room-code").textContent()) ?? "").trim();

      await guest.goto(`/?room=${code}`);
      await guest.getByLabel("Your name").fill("Guest");
      await guest.getByRole("button", { name: "Join" }).click();
      await dismissOnboarding(guest);
      await expect(host.getByText("Guest", { exact: true })).toBeVisible({ timeout: 20_000 });

      await display.goto(`/?room=${code}&display=1`);
      await expect(display.getByTestId("board")).toBeVisible({ timeout: 30_000 });

      // The join panel has a strip of its own: it never sits on a tile.
      const panel = await display.getByTestId("display-join").boundingBox();
      const board = await display.getByTestId("board").boundingBox();
      expect(panel && board).toBeTruthy();
      expect(panel!.y).toBeGreaterThanOrEqual(board!.y + board!.height - 1);

      // A television is not a person in the room.
      await expect(host.getByText(/^2 in room$/i)).toBeVisible();

      await playOutRound(host, guest);

      // Final, while the room wagers: Final copy, the category, no "$0",
      // no Daily Double.
      await expect
        .poll(async () => (await snapshot(host))?.currentClue?.round, { timeout: 30_000 })
        .toBe("final-jeopardy");
      const tvClue = display.getByTestId("tv-clue");
      await expect(tvClue).toBeVisible({ timeout: 20_000 });
      await expect(display.getByTestId("tv-final-headline")).toHaveText(/final jeopardy/i);
      await expect(display.getByTestId("tv-clue-header")).toHaveText(/programming/i);
      await expect(tvClue).not.toContainText(/daily double/i);
      await expect(tvClue).not.toContainText("$0");
      await expect(display.getByTestId("tv-waiting")).toContainText(/wagering/i);
      // A landscape frame, not a 1x1 portrait card.
      const frame = await tvClue.boundingBox();
      expect(frame!.width).toBeGreaterThan(frame!.height * 1.3);

      await send(host, { type: "submit-wager", amount: 100 });
      await send(guest, { type: "submit-wager", amount: 100 });
      await expect(display.getByTestId("tv-clue-text")).toContainText(/gopher/i, {
        timeout: 20_000,
      });
      await expect(display.getByTestId("tv-final-countdown")).toBeVisible();

      await send(host, { type: "submit-answer", answer: "Go" });
      await send(guest, { type: "submit-answer", answer: "Python" });
      await send(host, { type: "reveal-answer" });

      // Each contestant's response goes up on the television.
      const guestId = await selfId(guest);
      await expect(display.getByTestId("tv-final-reveal")).toBeVisible({ timeout: 20_000 });
      await expect(display.getByTestId("tv-answer")).toContainText(/go/i);
      await expect(display.getByTestId(/^tv-final-row-/)).toHaveCount(2);

      // Rule both by hand if the judge hasn't already, then close Final.
      for (let i = 0; i < 2; i += 1) {
        const judge = (await snapshot(host))?.currentClue?.currentJudgePlayerId;
        if (!judge) break;
        await send(host, { type: "judge-answer", targetPlayerId: judge, correct: judge !== guestId });
        await expect
          .poll(async () => (await snapshot(host))?.currentClue?.currentJudgePlayerId)
          .not.toBe(judge);
      }
      await expect(display.getByTestId(`tv-final-answer-${guestId}`)).toHaveText(/python/i);
      await expect(tvClue).toHaveAttribute("data-phase", "done", { timeout: 20_000 });
      await send(host, { type: "skip" });

      // The television ends on the results, not an empty board.
      await expect(display.getByTestId("tv-results")).toBeVisible({ timeout: 20_000 });
      await expect(display.getByTestId("board")).toHaveCount(0);
      await expect(display.getByTestId("tv-results-winner")).not.toContainText(/display/i);
      await expect(display.getByTestId("tv-results-winner")).toContainText(/wins/i);
      await expect(display.getByTestId(/^tv-podium-/)).toHaveCount(2);
      await expect(display.getByTestId("tv-results-final")).toContainText(/python/i);

      // Host: two contestants listed, no display; distinct next-game actions.
      await expect(host.getByTestId("results")).toBeVisible();
      await expect(host.getByTestId(/^results-row-/)).toHaveCount(2);
      await expect(host.getByTestId("results")).not.toContainText(/display/i);
      await expect(host.getByTestId("results-again")).toBeVisible();
      await expect(host.getByTestId("results-new-game")).toBeVisible();
      await expect(host.getByTestId("results-final")).toContainText(/python/i);
      // Nothing on the results pushes the page sideways, desk or phone.
      for (const page of [host, guest]) {
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      }

      // The More menu's dialogs work from the results screen.
      await host.getByRole("button", { name: "More" }).click();
      await host.getByRole("menuitem", { name: "Replay last game" }).click();
      await expect(host.getByTestId("replay-dialog")).toBeVisible();
      await host.keyboard.press("Escape");

      // A guest has nothing to press: they are told who they are waiting on.
      await expect(guest.getByTestId("results-waiting")).toBeVisible();
      await expect(guest.getByTestId("results-again")).toHaveCount(0);

      // Again is the same board, back to the top, and the TV follows.
      await host.getByTestId("results-again").click();
      await expect(host.getByTestId("results")).toHaveCount(0, { timeout: 20_000 });
      await expect(display.getByTestId("tv-results")).toHaveCount(0, { timeout: 20_000 });
      await expect(display.getByTestId("board")).toBeVisible();
    } finally {
      await hostContext.close();
      await guestContext.close();
      await displayContext.close();
    }
  });
});
