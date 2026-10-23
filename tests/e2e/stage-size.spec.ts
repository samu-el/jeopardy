import { expect, test, type Browser, type Page } from "@playwright/test";
import { dismissOnboarding, routeFixtureEpisodes } from "./helpers";

/**
 * The stage (board, clue, round title card, Daily Double and Final) is one
 * box on a given screen. Moving from one to the next must never change its
 * size or place, on a player's screen or on the television.
 */

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

type StoreHandle = { __game: { getState: () => Record<string, unknown> } };

interface ClueSnapshot {
  clueId: string;
  phase: string;
  dailyDouble: boolean;
  clue?: string;
  currentJudgePlayerId?: string;
}

const clues = [
  { id: "j1", round: "jeopardy", category: "MATH", value: 200, clue: "Two plus two.", correctResponse: "Four" },
  {
    id: "j2",
    round: "jeopardy",
    category: "MATH",
    value: 400,
    clue: "Three plus three.",
    correctResponse: "Six",
    dailyDouble: true,
  },
  { id: "d1", round: "double-jeopardy", category: "SKY", value: 400, clue: "Sky color.", correctResponse: "Blue" },
  { id: "f1", round: "final-jeopardy", category: "PLANETS", value: 0, clue: "The red planet.", correctResponse: "Mars" },
];

const slow = {
  buzzWindowMs: 120_000,
  answerTimeoutMs: 120_000,
  wagerTimeoutMs: 120_000,
  finalTimeoutMs: 120_000,
  autoAdvanceMs: 0,
  roundIntroMs: 5_000,
  aiJudgeEnabled: false,
};

async function send(page: Page, command: Record<string, unknown>) {
  await page.evaluate((cmd) => {
    const store = (window as unknown as StoreHandle).__game.getState() as {
      runtime?: { sendCommand: (id: string, c: unknown) => void };
      selfId: () => string;
    };
    store.runtime?.sendCommand(store.selfId(), cmd);
  }, command);
}

async function room(page: Page) {
  return page.evaluate(() => {
    const state = (window as unknown as StoreHandle).__game.getState().publicState as
      | { round: string; currentClue?: ClueSnapshot }
      | null;
    return state ? (JSON.parse(JSON.stringify(state)) as { round: string; currentClue?: ClueSnapshot }) : null;
  });
}

const phaseOf = async (page: Page) => (await room(page))?.currentClue?.phase ?? "none";

/**
 * Records the stage's box on every frame the page paints, so a size that
 * shows for a single frame between two states is caught too. The lobby is
 * skipped: it has a Begin key in the toolbar and no game on the stage.
 */
async function watchStage(page: Page) {
  await page.evaluate(() => {
    const seen: number[][] = [];
    (window as unknown as { __stageFrames: number[][] }).__stageFrames = seen;
    const frame = () => {
      const stage = document.querySelector("[data-stage]");
      if (stage && !document.querySelector('[data-testid="begin"]')) {
        const r = stage.getBoundingClientRect();
        seen.push([r.x + window.scrollX, r.y + window.scrollY, r.width, r.height]);
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

async function paintedFrames(page: Page): Promise<number[][]> {
  return page.evaluate(() => (window as unknown as { __stageFrames: number[][] }).__stageFrames);
}

async function stageBox(page: Page): Promise<Box> {
  const box = await page.locator("[data-stage]").boundingBox();
  expect(box).toBeTruthy();
  const scroll = await page.evaluate(() => [window.scrollX, window.scrollY]);
  return { x: box!.x + scroll[0], y: box!.y + scroll[1], width: box!.width, height: box!.height };
}

function expectSameBox(actual: Box, expected: Box, label: string) {
  for (const key of ["x", "y", "width", "height"] as const) {
    expect(Math.abs(actual[key] - expected[key]), `${label}: ${key} ${actual[key]} vs ${expected[key]}`).toBeLessThanOrEqual(1);
  }
}

async function openRoom(browser: Browser, width: number, height: number) {
  const hostContext = await browser.newContext({ viewport: { width, height } });
  const tvContext = await browser.newContext({ viewport: { width, height } });
  const host = await hostContext.newPage();
  const tv = await tvContext.newPage();

  await routeFixtureEpisodes(host);
  await host.goto("/");
  await host.getByTestId("new-game").click();
  await expect(host.getByTestId("board")).toBeVisible({ timeout: 30_000 });
  await dismissOnboarding(host);
  await host.getByTestId("reveal-room-code").click();
  const code = ((await host.getByTestId("room-code").textContent()) ?? "").trim();
  await tv.goto(`/?room=${code}&display=1`);
  await expect(tv.getByTestId("board")).toBeVisible({ timeout: 30_000 });

  return { host, tv, close: () => Promise.all([hostContext.close(), tvContext.close()]) };
}

for (const [width, height] of [
  [1280, 800],
  [390, 844],
  [844, 390],
] as const) {
  test(`the stage keeps one size through a whole game at ${width}x${height}`, async ({ browser }) => {
    test.setTimeout(180_000);
    const { host, tv, close } = await openRoom(browser, width, height);
    const views = [
      ["host", host],
      ["tv", tv],
    ] as const;

    try {
      await send(host, { type: "update-settings", settings: slow });
      await send(host, { type: "load-game", clues });
      await send(host, { type: "start-game" });
      await send(host, { type: "update-settings", settings: slow });
      for (const [, page] of views) await watchStage(page);

      // The round title card covers the stage, not the page.
      await expect(host.getByTestId("round-intro")).toBeVisible({ timeout: 20_000 });
      await expect(tv.getByTestId("round-intro")).toBeVisible({ timeout: 10_000 });
      const reference = { host: await stageBox(host), tv: await stageBox(tv) };
      const check = async (state: string) => {
        for (const [name, page] of views) expectSameBox(await stageBox(page), reference[name], `${name} ${state}`);
      };
      for (const [name, page] of views) {
        expectSameBox((await page.getByTestId("round-intro").boundingBox())!, await stageBox(page), `${name} title card`);
      }
      for (const [, page] of views) {
        await expect(page.getByTestId("round-intro")).toHaveCount(0, { timeout: 20_000 });
      }
      await check("board");

      // A clue through every phase a player sees.
      await send(host, { type: "pick-clue", clueId: "j1" });
      await expect(host.getByTestId("clue-stage")).toBeVisible();
      await expect(tv.getByTestId("tv-clue")).toBeVisible();
      await check("clue reading");
      await expect
        .poll(
          async () => {
            if ((await phaseOf(host)) !== "answering") await send(host, { type: "buzz" });
            return phaseOf(host);
          },
          { timeout: 30_000, intervals: [250] },
        )
        .toBe("answering");
      await check("answering");
      await send(host, { type: "submit-answer", answer: "four" });
      await expect.poll(() => phaseOf(host)).toMatch(/judging|resolved/);
      await check("judging");
      await expect
        .poll(async () => {
          const target = (await room(host))?.currentClue?.currentJudgePlayerId;
          if (target) await send(host, { type: "judge-answer", targetPlayerId: target, correct: true });
          return phaseOf(host);
        })
        .toBe("resolved");
      await check("ruled");
      await send(host, { type: "skip" });
      await expect(host.getByTestId("clue-stage")).toHaveCount(0);
      await check("board again");

      // The Daily Double: its splash, then the wager.
      await send(host, { type: "pick-clue", clueId: "j2" });
      await expect(host.getByTestId("daily-double-splash")).toBeVisible();
      await check("daily double splash");
      await expect(host.getByTestId("daily-double-splash")).toHaveCount(0, { timeout: 10_000 });
      await check("daily double wager");
      await send(host, { type: "submit-wager", amount: 100 });
      await expect.poll(() => phaseOf(host), { timeout: 20_000 }).toMatch(/reading|answering|buzzing/);
      await check("daily double clue");
      await expect
        .poll(
          async () => {
            if ((await phaseOf(host)) !== "answering") await send(host, { type: "buzz" });
            return phaseOf(host);
          },
          { timeout: 30_000, intervals: [250] },
        )
        .toBe("answering");
      await send(host, { type: "submit-answer", answer: "six" });
      await expect
        .poll(async () => {
          const target = (await room(host))?.currentClue?.currentJudgePlayerId;
          if (target) await send(host, { type: "judge-answer", targetPlayerId: target, correct: true });
          return phaseOf(host);
        })
        .toBe("resolved");
      await send(host, { type: "skip" });

      // Double Jeopardy's title card lands in the same box.
      await expect(host.getByTestId("round-intro")).toBeVisible({ timeout: 20_000 });
      await check("double jeopardy intro");
      await expect(host.getByTestId("round-intro")).toHaveCount(0, { timeout: 20_000 });
      await check("double jeopardy board");
      await send(host, { type: "pick-clue", clueId: "d1" });
      await expect(host.getByTestId("clue-stage")).toBeVisible();
      await check("double jeopardy clue");
      await expect
        .poll(
          async () => {
            if ((await phaseOf(host)) !== "answering") await send(host, { type: "buzz" });
            return phaseOf(host);
          },
          { timeout: 30_000, intervals: [250] },
        )
        .toBe("answering");
      await send(host, { type: "submit-answer", answer: "blue" });
      await expect
        .poll(async () => {
          const target = (await room(host))?.currentClue?.currentJudgePlayerId;
          if (target) await send(host, { type: "judge-answer", targetPlayerId: target, correct: true });
          return phaseOf(host);
        })
        .toBe("resolved");
      await send(host, { type: "skip" });

      // Final: the category while the room wagers, the clue, the reveal.
      await expect.poll(() => phaseOf(host), { timeout: 30_000 }).toBe("wager");
      await expect(host.getByTestId("round-intro")).toHaveCount(0, { timeout: 20_000 });
      await check("final wager");
      await send(host, { type: "submit-wager", amount: 100 });
      await expect(tv.getByTestId("tv-clue-text")).toBeVisible({ timeout: 20_000 });
      await check("final clue");
      await send(host, { type: "submit-answer", answer: "Mars" });
      await send(host, { type: "reveal-answer" });
      await expect(tv.getByTestId("tv-final-reveal")).toBeVisible({ timeout: 20_000 });
      await check("final reveal");

      // And no frame along the way, between any two of those, painted the
      // stage anywhere else.
      for (const [name, page] of views) {
        const frames = await paintedFrames(page);
        expect(frames.length).toBeGreaterThan(10);
        const ref = reference[name];
        const strays = frames.filter(
          ([x, y, w, h]) =>
            Math.abs(x - ref.x) > 1 || Math.abs(y - ref.y) > 1 || Math.abs(w - ref.width) > 1 || Math.abs(h - ref.height) > 1,
        );
        expect(strays, `${name}: frames painted off the stage box`).toEqual([]);
      }
    } finally {
      await close();
    }
  });
}
