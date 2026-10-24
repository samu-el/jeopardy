#!/usr/bin/env node
// Layout audit: plays a whole game at seven screen sizes (six from 1440 to 360 wide, and a 1920x1080 television)
// and reports page overflow, content poking out of its viewport or clipping container, spilling text,
// overlapping controls, misaligned control rows and top-level blocks that do not share the page's left edge.
//
//   AUDIT_BASE_URL=http://127.0.0.1:3000 bun run audit:layout [options]
//
// Start the app with `bun run dev` (the dev build exposes the store handle the audit drives the room with) and
// the rooms Worker with `bun run rooms:dev`, the app pointing at it through NEXT_PUBLIC_ROOMS_URL. Every board
// is the same archive episode (AUDIT_EPISODE, default 9644), so two runs show the same clues. Chromium comes
// from PLAYWRIGHT_CHROMIUM (an executable path) or Playwright's own browser cache.
//
// A view is a screen in one state: `landing`, `board`, `clue-answering`, `guest-board`, `tv-final-clue`, ...
// The host, a guest and a television play one game together at each size, so every state is seen from all
// three seats.
//
// Options:
//   --routes a,b       only views whose name starts with one of these
//   --viewports a,b    only these viewports (desktop, laptop, tablet-land, tablet, phone, phone-sm, tv)
//   --shots <dir>      save a full-page screenshot per view and viewport
//   --json <file>      write every finding as JSON
//   --concurrency n    viewports in parallel (default 1; each one is three browsers)
//   --until <view>     end the game at this view (a quick look at the early screens)
//
// Exits 1 when anything is flagged.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";

import { chromium } from "playwright-core";

import { analyzeLayout, collectLayout } from "./detect.mjs";

const { values: opts } = parseArgs({
  options: {
    routes: { type: "string" },
    viewports: { type: "string" },
    shots: { type: "string" },
    json: { type: "string" },
    concurrency: { type: "string", default: "1" },
    until: { type: "string" },
  },
});

const BASE = (process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const EPISODE = process.env.AUDIT_EPISODE ?? "9644";

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  laptop: { width: 1280, height: 800 },
  "tablet-land": { width: 1024, height: 768 },
  tablet: { width: 768, height: 1024 },
  phone: { width: 390, height: 844 },
  "phone-sm": { width: 360, height: 740 },
  tv: { width: 1920, height: 1080 },
};

const wanted = opts.routes ? opts.routes.split(",") : null;
const selected = (name) => !wanted || wanted.some((w) => name.startsWith(w));

/** Pacing slow enough to look at each state, with nothing judged or advanced behind the audit's back. */
const SLOW = {
  buzzWindowMs: 120_000,
  answerTimeoutMs: 120_000,
  wagerTimeoutMs: 120_000,
  finalTimeoutMs: 120_000,
  autoAdvanceMs: 0,
  roundIntroMs: 4_000,
  aiJudgeEnabled: false,
};

/** The archive episode as the room's clue list, Daily Doubles where the show had them. */
async function episodeClues() {
  const res = await fetch(`${BASE}/api/episodes/${EPISODE}`);
  if (!res.ok) throw new Error(`episode ${EPISODE}: HTTP ${res.status}`);
  const { episode } = await res.json();
  const rounds = [
    ["jeopardy", episode.jeopardy ?? []],
    ["double-jeopardy", episode.double ?? []],
    ["final-jeopardy", episode.final ?? []],
  ];
  return rounds.flatMap(([round, list]) =>
    [...list]
      .sort((a, b) => a.x - b.x || a.y - b.y)
      .map((c, k) => ({
        id: `${round}-${c.x}-${c.y}-${k}`,
        round,
        category: c.cat,
        value: c.val,
        clue: c.q,
        correctResponse: c.a,
        ...(c.dd ? { dailyDouble: true } : {}),
      })),
  );
}

// Driving the room ------------------------------------------------------------------------------------------

async function send(page, command) {
  await page.evaluate((cmd) => {
    const store = window.__game.getState();
    store.runtime?.sendCommand(store.selfId(), cmd);
  }, command);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const s = window.__game.getState().publicState;
    return s ? JSON.parse(JSON.stringify(s)) : null;
  });
}

const selfId = (page) => page.evaluate(() => window.__game.getState().selfId());

async function until(fn, timeout = 20_000, step = 250) {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out: ${fn.toString().replace(/\s+/g, " ").slice(0, 120)}`);
    await new Promise((r) => setTimeout(r, step));
  }
}

const phaseOf = async (page) => (await snapshot(page))?.currentClue?.phase ?? "none";
const introOver = async (page) => {
  const s = await snapshot(page);
  return Boolean(s && (!s.roundIntroEndsAt || s.roundIntroEndsAt < Date.now()));
};

async function routeEpisode(page) {
  await page.route("**/api/episodes?mode=random*", async (route) => {
    const res = await page.request.get(`${BASE}/api/episodes/${EPISODE}`);
    await route.fulfill({ status: res.status(), contentType: "application/json", body: await res.text() });
  });
}

async function dismissOnboarding(page) {
  const button = page.getByRole("button", { name: "Let’s play" });
  await button.click({ timeout: 10_000 }).catch(() => {});
  await button.waitFor({ state: "detached", timeout: 10_000 }).catch(() => {});
}

/** Ring in as `who` until the room hands them the clue. */
async function ringIn(host, who) {
  await until(async () => {
    if ((await phaseOf(host)) === "answering") return true;
    await send(who, { type: "buzz" });
    await host.waitForTimeout(300);
    return (await phaseOf(host)) === "answering";
  });
}

/** A Daily Double after the wager: the clue is read, then the player who found it rings in to answer. */
async function ddAnswering(host) {
  await until(
    async () => {
      const phase = await phaseOf(host);
      if (phase === "wager") await send(host, { type: "submit-wager", amount: 5 });
      else if (phase !== "answering") await send(host, { type: "buzz" });
      return phase === "answering";
    },
    45_000,
    500,
  );
}

async function ruleAll(host, correctFor) {
  for (let i = 0; i < 4 && (await phaseOf(host)) === "judging"; i += 1) {
    const target = (await snapshot(host))?.currentClue?.currentJudgePlayerId;
    if (target) await send(host, { type: "judge-answer", targetPlayerId: target, correct: correctFor(target) });
    await host.waitForTimeout(300);
  }
}

/** Close the open clue: rule whatever is pending, show the answer and move on. */
async function closeClue(host) {
  const target = (await snapshot(host))?.currentClue?.clueId;
  let last = null;
  await until(
    async () => {
      const clue = (await snapshot(host))?.currentClue;
      last = clue;
      if (!clue || clue.clueId !== target) return true;
      if (clue.phase === "judging" && clue.currentJudgePlayerId) {
        await send(host, { type: "judge-answer", targetPlayerId: clue.currentJudgePlayerId, correct: false });
      } else if (clue.phase === "wager") {
        await send(host, { type: "submit-wager", amount: 5 });
      } else if (clue.phase === "answering") {
        await send(host, { type: "submit-answer", answer: "pass" });
      } else {
        await send(host, { type: "reveal-answer" });
        await send(host, { type: "skip" });
      }
      return false;
    },
    30_000,
    400,
  ).catch((e) => {
    throw new Error(`${e.message} ${JSON.stringify(last).slice(0, 400)}`);
  });
}

/** Clear the rest of a round: open each clue and let the host pass on it. */
async function clearRound(host, round) {
  for (let guard = 0; guard < 40; guard += 1) {
    await until(() => introOver(host));
    const s = await snapshot(host);
    if (s.round !== round) return;
    const next = s.board.find((c) => !c.revealed);
    if (!next) return;
    await send(host, { type: "pick-clue", clueId: next.id });
    await until(async () => (await snapshot(host))?.currentClue);
    await closeClue(host);
  }
}

/** Open the More menu's item, or the toolbar key when it is on the bar at this width. */
async function more(page, name) {
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name }).click();
  await page.waitForTimeout(500);
}

async function changeGame(page) {
  const key = page.getByTestId("change-game");
  if (await key.isVisible().catch(() => false)) await key.click();
  else await more(page, "Change game");
  await page.waitForTimeout(800);
}

async function restart(page) {
  const key = page.getByRole("button", { name: "Restart", exact: true });
  if (await key.isVisible().catch(() => false)) await key.click();
  else await more(page, "Restart");
  await page.waitForTimeout(500);
}

async function closeDialogs(page) {
  for (let i = 0; i < 3; i += 1) {
    if (!(await page.locator('[role="dialog"], [role="menu"], [role="presentation"]').count())) return;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
}

// Measuring -------------------------------------------------------------------------------------------------

/** Measure the page as it stands and keep the result under `name`. */
async function measure(page, name, vpName, results) {
  if (!selected(name)) return;
  try {
    // A tooltip left open by the last click is not part of the screen.
    await page.mouse.move(0, 0).catch(() => {});
    await page.evaluate(() => {
      const active = document.activeElement;
      if (active instanceof HTMLButtonElement) active.blur();
    });
    await page.waitForTimeout(700);
    await page.evaluate(() => document.fonts.ready);
    const snap = await page.evaluate(collectLayout);
    const result = analyzeLayout(snap);
    if (opts.shots) await page.screenshot({ path: `${opts.shots}/${name}-${vpName}.png`, fullPage: true });
    results.push({ route: name, viewport: vpName, ...result });
    const n = result.findings.length;
    process.stdout.write(`${n ? "FLAG" : "ok  "} ${name} ${vpName}${n ? ` (${n})` : ""}\n`);
  } catch (e) {
    const detail = String(e?.message ?? e).split("\n")[0];
    results.push({ route: name, viewport: vpName, findings: [{ kind: "error", label: name, detail }], truncated: [] });
  }
}

async function newContext(browser, vp) {
  const phone = vp.width < 768;
  return browser.newContext({
    viewport: vp,
    deviceScaleFactor: 1,
    colorScheme: "dark",
    reducedMotion: "reduce",
    hasTouch: phone,
    isMobile: phone,
  });
}

// Views that stand alone --------------------------------------------------------------------------------------

/** Answers the "is this room open?" lookup without a room behind it. */
const lookup = (exists) => async (page) =>
  page.route("**/room/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ exists }) }),
  );

const SINGLE = [
  {
    name: "landing-builder",
    async run(page) {
      await page.goto(BASE + "/", { waitUntil: "networkidle" });
      await page.getByTestId("landing-build").click();
      await page.getByRole("dialog", { name: /Build a game/ }).waitFor();
    },
  },
  {
    name: "landing-builder-errors",
    async run(page) {
      await page.goto(BASE + "/", { waitUntil: "networkidle" });
      await page.getByTestId("landing-build").click();
      await page.getByTestId("play-custom-game").click();
      await page.getByTestId("builder-errors").waitFor();
    },
  },
  {
    name: "join-closed",
    async run(page) {
      await lookup(false)(page);
      await page.goto(BASE + "/?room=QQQQ", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Join" }).click();
      await page.getByText(/isn’t open/).waitFor();
    },
  },
  {
    name: "join-unreachable",
    async run(page) {
      await page.route("**/room/**", (route) => route.abort("connectionrefused"));
      await page.goto(BASE + "/?room=QQQQ", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Join" }).click();
      await page.getByText(/Can’t reach the game server/).waitFor();
    },
  },
  {
    name: "shared-game-missing",
    async run(page) {
      await page.goto(BASE + "/?game=zzzzzzzzzz", { waitUntil: "networkidle" });
      await page.getByTestId("shared-game-error").waitFor({ timeout: 20_000 });
    },
  },
  {
    name: "tv-closed",
    async run(page) {
      await page.goto(BASE + "/?room=QQQQ&display=1");
      await page.getByTestId("display-room-unavailable").waitFor({ timeout: 20_000 });
    },
  },
];

async function single(browser, vpName, results) {
  for (const view of SINGLE) {
    if (!selected(view.name)) continue;
    const ctx = await newContext(browser, VIEWPORTS[vpName]);
    const page = await ctx.newPage();
    try {
      await view.run(page);
      await measure(page, view.name, vpName, results);
    } catch (e) {
      const detail = String(e?.message ?? e).split("\n")[0];
      results.push({ route: view.name, viewport: vpName, findings: [{ kind: "error", label: view.name, detail }], truncated: [] });
    }
    await ctx.close().catch(() => {});
  }
}

/** Thrown to end a game early at `--until`. */
const STOP = Symbol("stop");

// The game, from three seats ----------------------------------------------------------------------------------

async function journey(browser, vpName, clues, results) {
  const vp = VIEWPORTS[vpName];
  const hostCtx = await newContext(browser, vp);
  const guestCtx = await newContext(browser, vp);
  const tvCtx = await newContext(browser, vp);
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();
  const tv = await tvCtx.newPage();
  const shot = async (page, name) => {
    await measure(page, name, vpName, results);
    if (name === opts.until) throw STOP;
  };

  try {
    await routeEpisode(host);
    await host.goto(BASE + "/", { waitUntil: "networkidle" });
    await shot(host, "landing");

    await host.getByTestId("new-game").click();
    await host.getByTestId("board").waitFor({ timeout: 30_000 });
    await host.getByRole("button", { name: "Let’s play" }).waitFor({ timeout: 10_000 });
    await shot(host, "onboarding");
    await dismissOnboarding(host);

    await send(host, { type: "update-settings", settings: SLOW });
    await send(host, { type: "load-game", clues });
    await send(host, { type: "start-game" });
    await send(host, { type: "update-settings", settings: SLOW });
    await host.getByTestId("round-intro").waitFor({ timeout: 20_000 });
    await shot(host, "round-intro");
    await until(() => introOver(host));
    await host.getByTestId("round-intro").waitFor({ state: "detached", timeout: 20_000 });

    // The host's own screens while the board waits.
    await host.getByTestId("reveal-room-code").click();
    const code = ((await host.getByTestId("room-code").textContent()) ?? "").trim();
    await shot(host, "board");
    await host.getByRole("button", { name: "Settings" }).click();
    await host.waitForTimeout(500);
    await shot(host, "settings");
    await closeDialogs(host);
    await host.getByRole("button", { name: "More" }).click();
    await host.waitForTimeout(400);
    await shot(host, "more-menu");
    await closeDialogs(host);
    await changeGame(host);
    await shot(host, "picker");
    await closeDialogs(host);
    await more(host, "Build a game");
    await shot(host, "builder");
    await closeDialogs(host);
    await more(host, "Shortcuts");
    await shot(host, "shortcuts");
    await closeDialogs(host);
    await restart(host);
    await shot(host, "restart-confirm");
    await closeDialogs(host);
    await host.getByRole("button", { name: "Leave room", exact: true }).click();
    await host.waitForTimeout(500);
    await shot(host, "leave-confirm");
    await closeDialogs(host);

    // A guest joins from the invite link.
    await guest.goto(`${BASE}/?room=${code}`, { waitUntil: "networkidle" });
    await guest.getByRole("dialog", { name: "Join room" }).waitFor();
    await shot(guest, "guest-join");
    await guest.getByLabel("Your name").fill("Guest");
    await guest.getByRole("button", { name: "Join" }).click();
    await guest.getByTestId("board").waitFor({ timeout: 30_000 });
    await dismissOnboarding(guest);
    await host.getByText("Guest", { exact: true }).first().waitFor({ timeout: 20_000 });
    await shot(guest, "guest-board");
    await more(host, "Players");
    await shot(host, "players");
    await closeDialogs(host);

    // And the television.
    await tv.goto(`${BASE}/?room=${code}&display=1`);
    await tv.getByTestId("board").waitFor({ timeout: 30_000 });
    await shot(tv, "tv-board");
    const guestId = await selfId(guest);

    // A clue through every phase.
    const board = (await snapshot(host)).board;
    const plain = board.find((c) => !c.revealed && !clues.find((x) => x.id === c.id)?.dailyDouble);
    await send(host, { type: "pick-clue", clueId: plain.id });
    await host.getByTestId("clue-stage").waitFor();
    await shot(host, "clue-reading");
    await shot(guest, "guest-clue-reading");
    await shot(tv, "tv-clue");
    await until(async () => (await snapshot(host))?.currentClue?.phase === "buzzing", 30_000).catch(() => {});
    await shot(guest, "guest-clue-buzzing");
    await ringIn(host, guest);
    await shot(guest, "guest-clue-answering");
    await shot(host, "clue-answering-other");
    await send(guest, { type: "submit-answer", answer: "a guess that is wrong" });
    await until(async () => /judging|resolved/.test(await phaseOf(host)));
    await shot(host, "clue-judging");
    await shot(guest, "guest-clue-judging");
    await ruleAll(host, () => false);
    await until(async () => (await phaseOf(host)) !== "judging").catch(() => {});
    await ringIn(host, host).catch(() => {});
    if ((await phaseOf(host)) === "answering") {
      await shot(host, "clue-answering");
      const answer = clues.find((x) => x.id === plain.id)?.correctResponse ?? "";
      await send(host, { type: "submit-answer", answer });
      await until(async () => /judging|resolved/.test(await phaseOf(host)));
      await ruleAll(host, () => true);
    }
    await until(async () => (await phaseOf(host)) === "resolved").catch(() => {});
    await shot(host, "clue-resolved");
    await shot(tv, "tv-clue-resolved");
    await closeClue(host);

    // The transcript and replay have something in them now.
    await more(host, "Transcript");
    await shot(host, "transcript");
    await host.getByRole("button", { name: "Close transcript" }).click();

    // A Daily Double.
    const dd = (await snapshot(host)).board.find(
      (c) => !c.revealed && clues.find((x) => x.id === c.id)?.dailyDouble && c.round === "jeopardy",
    ) ?? (await snapshot(host)).board.find((c) => !c.revealed && clues.find((x) => x.id === c.id)?.dailyDouble);
    if (dd) {
      await send(host, { type: "pick-clue", clueId: dd.id });
      await host.getByTestId("daily-double-splash").waitFor();
      await shot(host, "dd-splash");
      await shot(tv, "tv-dd-splash");
      await host.getByTestId("daily-double-splash").waitFor({ state: "detached", timeout: 10_000 });
      await shot(host, "dd-wager");
      await shot(guest, "guest-dd-wager");
      await shot(tv, "tv-dd-wager");
      await send(host, { type: "submit-wager", amount: 1000 });
      await ddAnswering(host);
      await shot(host, "dd-answering");
      await send(host, { type: "submit-answer", answer: clues.find((x) => x.id === dd.id)?.correctResponse ?? "" });
      await until(async () => /judging|resolved/.test(await phaseOf(host)));
      await ruleAll(host, () => true);
      await closeClue(host);
    }

    await clearRound(host, "jeopardy");

    // Double Jeopardy.
    await until(async () => (await snapshot(host))?.round === "double-jeopardy", 30_000);
    await host.getByTestId("round-intro").waitFor({ timeout: 20_000 }).catch(() => {});
    await shot(host, "dj-intro");
    await shot(tv, "tv-dj-intro");
    await until(() => introOver(host));
    await host.getByTestId("round-intro").waitFor({ state: "detached", timeout: 20_000 }).catch(() => {});
    // The guest takes one so both play Final in the black.
    const dj = (await snapshot(host)).board.find((c) => !c.revealed && !clues.find((x) => x.id === c.id)?.dailyDouble);
    await send(host, { type: "pick-clue", clueId: dj.id });
    await ringIn(host, guest);
    await send(guest, { type: "submit-answer", answer: clues.find((x) => x.id === dj.id)?.correctResponse ?? "" });
    await until(async () => /judging|resolved/.test(await phaseOf(host)));
    await ruleAll(host, () => true);
    await closeClue(host);
    await shot(host, "dj-board");
    await shot(guest, "guest-dj-board");
    await shot(tv, "tv-dj-board");
    await clearRound(host, "double-jeopardy");

    // Final Jeopardy.
    await until(async () => (await snapshot(host))?.currentClue?.round === "final-jeopardy", 30_000);
    await until(() => introOver(host));
    await host.waitForTimeout(800);
    await shot(host, "final-wager");
    await shot(guest, "guest-final-wager");
    await shot(tv, "tv-final-wager");
    await send(host, { type: "submit-wager", amount: 500 });
    await send(guest, { type: "submit-wager", amount: 100 });
    // A wager the room refused (more than that player has) is sent again at the minimum.
    await until(
      async () => {
        const clue = (await snapshot(host))?.currentClue;
        if (clue?.phase !== "wager") return true;
        for (const page of [host, guest]) {
          if (clue.waitingForWager.includes(await selfId(page))) await send(page, { type: "submit-wager", amount: 0 });
        }
        return false;
      },
      20_000,
      1000,
    );
    await tv.getByTestId("tv-clue-text").waitFor({ timeout: 20_000 });
    await shot(host, "final-answer");
    await shot(guest, "guest-final-answer");
    await shot(tv, "tv-final-clue");
    const final = clues.find((c) => c.round === "final-jeopardy");
    await send(host, { type: "submit-answer", answer: final.correctResponse });
    await send(guest, { type: "submit-answer", answer: "no idea" });
    await send(host, { type: "reveal-answer" });
    await tv.getByTestId("tv-final-reveal").waitFor({ timeout: 20_000 });
    await shot(host, "final-reveal");
    await shot(tv, "tv-final-reveal");
    for (let i = 0; i < 3; i += 1) {
      const judge = (await snapshot(host))?.currentClue?.currentJudgePlayerId;
      if (!judge) break;
      await send(host, { type: "judge-answer", targetPlayerId: judge, correct: judge !== guestId });
      await host.waitForTimeout(500);
    }
    await until(async () => (await phaseOf(host)) === "resolved").catch(() => {});
    await shot(host, "final-resolved");
    await send(host, { type: "skip" });

    // Results.
    await host.getByTestId("results").waitFor({ timeout: 20_000 });
    await tv.getByTestId("tv-results").waitFor({ timeout: 20_000 });
    await shot(host, "results");
    await shot(guest, "guest-results");
    await shot(tv, "tv-results");
    await more(host, "Replay last game");
    await host.getByTestId("replay-dialog").waitFor();
    await shot(host, "replay");
    await closeDialogs(host);

    // The host removes the guest, who is told so in the connection banner.
    await more(host, "Players");
    await host.getByRole("button", { name: /^Remove / }).first().click();
    await closeDialogs(host);
    await guest.getByTestId("connection-banner").waitFor({ timeout: 20_000 });
    await shot(guest, "guest-removed");
  } catch (e) {
    if (e === STOP) return;
    const detail = String(e?.message ?? e).split("\n")[0];
    results.push({ route: "journey", viewport: vpName, findings: [{ kind: "error", label: "journey", detail }], truncated: [] });
    process.stdout.write(`ERR  journey ${vpName}: ${detail}\n`);
  } finally {
    for (const ctx of [hostCtx, guestCtx, tvCtx]) await ctx.close().catch(() => {});
  }
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
  const vps = opts.viewports ? opts.viewports.split(",").filter((v) => v in VIEWPORTS) : Object.keys(VIEWPORTS);
  if (opts.shots) mkdirSync(opts.shots, { recursive: true });
  const clues = await episodeClues();

  const results = [];
  const queue = [...vps];
  const workers = Array.from({ length: Number(opts.concurrency) || 1 }, async () => {
    while (queue.length) {
      const vp = /** @type {string} */ (queue.shift());
      await single(browser, vp, results);
      await journey(browser, vp, clues, results);
    }
  });
  await Promise.all(workers);
  await browser.close();

  results.sort((a, b) => a.route.localeCompare(b.route) || a.viewport.localeCompare(b.viewport));
  if (opts.json) {
    mkdirSync(dirname(opts.json), { recursive: true });
    writeFileSync(opts.json, JSON.stringify(results, null, 2));
  }
  const byRoute = new Map();
  for (const r of results) byRoute.set(r.route, (byRoute.get(r.route) ?? 0) + r.findings.length);
  console.log("\nFindings per view:");
  for (const [route, n] of byRoute) console.log(`  ${route.padEnd(24)} ${n}`);
  const total = results.reduce((s, r) => s + r.findings.length, 0);
  for (const r of results) {
    for (const f of r.findings) console.log(`${r.route} ${r.viewport} ${f.kind}: ${f.label} ${f.detail}`);
  }
  console.log(`\n${total} finding(s) across ${results.length} views.`);
  process.exitCode = total ? 1 : 0;
}

await main();
