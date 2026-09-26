import { expect, test, type Browser, type Page } from "@playwright/test";
import { startFixtureGame } from "./helpers";

/**
 * The clue panel is where a game is actually played: it has to take keyboard
 * input, take dictation, and hold its shape around a wordy clue.
 */
test.describe("Clue controls", () => {
  test("plays a whole clue from the keyboard alone", async ({ page }) => {
    await openClue(page);

    // Space rings in — no pointer involved.
    await page.keyboard.press("Space");
    await expect(page.getByTestId("buzzer")).toHaveText("IN!", { timeout: 15_000 });

    // Focus lands in the answer field, so it can be typed and sent with Enter.
    await expect(page.getByLabel("What is…")).toBeFocused();

    const buzzerCentre = () =>
      page.evaluate(() => {
        const box = document
          .querySelector('[data-testid="buzzer"]')
          ?.getBoundingClientRect();
        return box ? box.left + box.width / 2 : null;
      });
    const before = await buzzerCentre();

    await page.keyboard.type("four");

    // The buzzer is the one control that must not move under your thumb:
    // the answer field appearing and filling may not shift it, which is why
    // the field is mounted in the clock's housing rather than on a line of
    // its own.
    expect(before).not.toBeNull();
    expect(Math.abs((await buzzerCentre())! - before!)).toBeLessThan(2);

    // Enter sends it — and with the only player who rang in answered, the
    // answer comes up at once rather than when the clock runs out. Y scores
    // it, and the board comes back.
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("correct-response")).toBeVisible();
    await page.keyboard.press("y");
    // The seat id is per browser, so match the score display by its prefix.
    await expect(page.locator('[data-testid^="score-"]').first()).not.toHaveText("$0", {
      timeout: 10_000,
    });
  });

  test("? opens the shortcut list and Esc closes it", async ({ page }) => {
    await openClue(page);

    await page.keyboard.press("?");
    await expect(page.getByText("Ring in — early costs you a lockout")).toBeVisible();
    await expect(page.getByText("Answer by voice")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByText("Ring in — early costs you a lockout")).toBeHidden();
  });

  test("dictation fills the answer and sends it", async ({ page }) => {
    // Stand in for the browser's speech recognition, which needs a real
    // microphone and a network round trip.
    await page.addInitScript(() => {
      class FakeRecognition extends EventTarget {
        continuous = false;
        interimResults = false;
        lang = "en-US";
        onresult: ((event: unknown) => void) | null = null;
        onerror: (() => void) | null = null;
        onend: (() => void) | null = null;
        onstart: (() => void) | null = null;
        start() {
          this.onstart?.();
          setTimeout(() => {
            this.onresult?.({
              resultIndex: 0,
              results: {
                length: 1,
                0: { isFinal: true, length: 1, 0: { transcript: "what is four", confidence: 1 } },
              },
            });
            this.onend?.();
          }, 60);
        }
        stop() {
          this.onend?.();
        }
        abort() {
          this.onend?.();
        }
      }
      (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition =
        FakeRecognition;
    });

    await openClue(page);
    await page.keyboard.press("Space");
    await expect(page.getByTestId("buzzer")).toHaveText("IN!", { timeout: 15_000 });

    await page.getByTestId("mic-toggle").click();

    // The transcript is submitted as-is, not a stale copy of the field.
    // Dictation sends the answer, and the answer comes up on its own.
    await expect(page.getByTestId("correct-response")).toBeVisible({ timeout: 10_000 });
    // The judge panel shows what was actually heard, not a stale field value.
    await expect(page.getByText("what is four").first()).toBeVisible();
  });

  test("the buzzer waits for the voice, not for a guess", async ({ page }) => {
    // A deliberately slow stand-in for speech synthesis: cues queue, and each
    // one takes far longer than the engine's per-character estimate.
    await page.addInitScript(() => {
      const spoken: { text: string; startedAt: number; endedAt?: number }[] = [];
      (window as unknown as { __spoken: typeof spoken }).__spoken = spoken;
      const queue: { utterance: Record<string, () => void> & { text: string } }[] = [];
      let speaking:
        | { utterance: Record<string, () => void> & { text: string }; timer: number; entry: { endedAt?: number } }
        | null = null;

      function drain() {
        if (speaking) return;
        const next = queue.shift();
        if (!next) return;
        const entry: { text: string; startedAt: number; endedAt?: number } = {
          text: next.utterance.text,
          startedAt: Date.now(),
        };
        spoken.push(entry);
        // ~28ms a character: slower than the room's estimate, on purpose.
        const timer = window.setTimeout(
          () => {
            speaking = null;
            entry.endedAt = Date.now();
            next.utterance.onend?.();
            drain();
          },
          Math.max(400, next.utterance.text.length * 28),
        );
        speaking = { utterance: next.utterance, timer, entry };
        next.utterance.onstart?.();
      }

      // `speechSynthesis` is a read-only accessor on window: a plain
      // assignment is silently dropped and the real (voiceless) engine keeps
      // answering, so the stand-in has to be defined over it.
      Object.defineProperty(window, "speechSynthesis", {
        configurable: true,
        value: {
          speak: (utterance: Record<string, () => void> & { text: string }) => {
            queue.push({ utterance });
            drain();
          },
          // Like the real API: cancel stops what is being said as well as
          // what is waiting, and the stopped utterance still ends.
          cancel: () => {
            queue.length = 0;
            const current = speaking;
            speaking = null;
            if (!current) return;
            window.clearTimeout(current.timer);
            current.entry.endedAt = Date.now();
            current.utterance.onend?.();
          },
          getVoices: () => [],
          addEventListener: () => {},
          speaking: false,
          pending: false,
          paused: false,
        },
      });
    });

    await openClue(page, { keepPacing: true });

    // While the clue is being read the buzzer is shut, however long it runs.
    await expect(page.getByTestId("buzzer")).toBeDisabled();
    await expect(page.getByText("Reading…")).toBeVisible();

    // It opens once the voice has actually finished the clue.
    await expect(page.getByTestId("buzzer")).toBeEnabled({ timeout: 30_000 });

    const timing = await page.evaluate(() => {
      const spoken = (window as unknown as {
        __spoken: { text: string; startedAt: number; endedAt?: number }[];
      }).__spoken;
      const clue = spoken.find((entry) => entry.text.includes("Two plus two"));
      return {
        spokeTheClue: Boolean(clue),
        finished: Boolean(clue?.endedAt),
        // How long the room actually held the buzzer past its own estimate.
        heldPastEstimateMs: clue ? (clue.endedAt ?? 0) - clue.startedAt : 0,
      };
    });

    // The clue really was read aloud, and the buzzer waited for it to finish
    // rather than opening on the 200ms estimate the room was given.
    expect(timing.spokeTheClue).toBe(true);
    expect(timing.finished).toBe(true);
    expect(timing.heldPastEstimateMs).toBeGreaterThan(300);
  });

  test("a long clue has the panel to itself; the clock and buzzer are below it", async ({
    page,
  }) => {
    await openClue(page, { long: true });

    const layout = await page.evaluate(() => {
      const rect = (selector: string) =>
        document.querySelector(selector)?.getBoundingClientRect() ?? null;
      const text = rect('[data-testid="clue-text"]');
      const lights = rect('[role="progressbar"]');
      const buzzer = rect('[data-testid="buzzer"]');
      const stage = rect('[data-testid="clue-stage"]');
      const board = rect('[data-testid="board"]');
      const reveal =
        [...document.querySelectorAll("button")]
          .find((node) => node.textContent?.trim() === "Reveal")
          ?.getBoundingClientRect() ?? null;
      const hits = (a: DOMRect | null, b: DOMRect | null) =>
        !!a && !!b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      return {
        overText: hits(text, lights),
        insidePanel:
          !!text && !!stage && text.top >= stage.top - 1 && text.bottom <= stage.bottom + 1,
        buzzerVisible: !!buzzer && buzzer.height > 0,
        // The clue is on the board; the clock and everything anyone presses
        // is under it. Nothing shares a rectangle with the clue any more, so
        // no clue can crowd them however long it runs.
        buzzerBelowBoard: !!buzzer && !!board && buzzer.top >= board.bottom,
        lightsBelowBoard: !!lights && !!board && lights.top >= board.bottom,
        revealBelowBoard: !!reveal && !!board && reveal.top >= board.bottom,
      };
    });

    expect(layout).toEqual({
      overText: false,
      insidePanel: true,
      buzzerVisible: true,
      buzzerBelowBoard: true,
      lightsBelowBoard: true,
      revealBelowBoard: true,
    });
  });

  test("Space on a focused button presses the button, not the buzzer", async ({ page }) => {
    await openClue(page);

    await page.getByRole("button", { name: "Settings" }).focus();
    await page.keyboard.press("Space");
    // The settings panel opened, and nobody rang in.
    await expect(page.getByLabel("Chat")).toBeVisible();
    await expect(page.getByTestId("buzzer")).toHaveText("BUZZ");
    await page.keyboard.press("Escape");
  });

  test("a clue takes focus and is read out; the board gets focus back", async ({ page }) => {
    await openClue(page);

    // Focus moved from the square into the clue, and the live region said it.
    await expect(page.getByTestId("clue-region")).toBeFocused({ timeout: 5_000 }).catch(async () => {
      // Once the buzzer opens it takes focus from the clue — also on the surface.
      await expect(page.getByTestId("buzzer")).toBeFocused();
    });
    await expect(page.getByTestId("clue-region")).toHaveAttribute("aria-label", /\$200/);
    await expect(page.getByTestId("game-announcer")).toContainText(/Buzzers open|Two plus two/);
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuetext", /seconds left to ring in/);

    // Ring in: the buzzer autofocused, so Space rings in from where focus is.
    await page.keyboard.press("Space");
    await expect(page.getByTestId("game-announcer")).toContainText("You buzzed in");
    await page.keyboard.type("four");
    await page.keyboard.press("Enter");

    // The host skips the rest; focus comes back to the board, not the page.
    await expect(page.getByTestId("next-clue")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("next-clue").click();
    await expect(page.getByTestId("clue-stage")).toBeHidden();
    const focused = await page.evaluate(() =>
      Boolean(document.activeElement?.closest('[data-testid="board"]')),
    );
    expect(focused).toBe(true);
  });

  test("the host can overrule the AI judge", async ({ page }) => {
    await openClue(page);
    const selfId = await page.evaluate(
      () => (window as unknown as { __game: { getState: () => { selfId: () => string } } }).__game.getState().selfId(),
    );

    await page.keyboard.press("Space");
    await expect(page.getByTestId("buzzer")).toHaveText("IN!", { timeout: 15_000 });
    await page.keyboard.type("a wrong guess");
    await page.keyboard.press("Enter");

    // The AI rules it wrong; the bench stays up with the ruling, in words.
    const override = page.getByTestId("judge-override");
    await expect(override).toContainText("RULED INCORRECT", { timeout: 15_000 });
    await expect(page.getByTestId(`score-${selfId}`)).toHaveText("-$200");

    // Reverse it: the score swings to the right answer's value.
    await override.getByRole("button", { name: "Mark correct" }).click();
    await expect(page.getByTestId(`score-${selfId}`)).toHaveText("$200", { timeout: 10_000 });
    await expect(page.getByTestId("judge-override")).toContainText("RULED CORRECT");
  });

  test("a Daily Double wager out of range is refused with a message", async ({ page }) => {
    await openClue(page, {
      clues: [
        {
          id: "dd-1",
          round: "jeopardy",
          category: "MATH",
          value: 200,
          clue: "Two plus two.",
          correctResponse: "Four",
          dailyDouble: true,
        },
      ],
    });

    const wager = page.getByLabel("Wager", { exact: true });
    await expect(wager).toBeVisible({ timeout: 10_000 });
    await wager.fill("99999");
    await wager.press("Enter");
    // A one-clue board's house maximum is its one $200 clue.
    await expect(page.locator("#wager-error")).toHaveText("Maximum wager is $200.");
    await expect(wager).toHaveAttribute("aria-invalid", "true");

    // A wager in range goes through, and only the Daily Double player answers.
    await wager.fill("150");
    await wager.press("Enter");
    await expect(page.getByTestId("clue-stage")).toContainText("DAILY DOUBLE · $150", { timeout: 10_000 });
  });

  test("Restart asks first", async ({ page }) => {
    await openClue(page);
    await page.getByRole("button", { name: "Restart" }).click();
    const dialog = page.getByRole("dialog", { name: "Restart the game?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Keep playing" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("clue-stage")).toBeVisible();
  });
});

/**
 * On a phone the buzzer is the whole game: it has to be on screen, thumb
 * sized, and take the press on the way down.
 */
test.describe("Phone buzzer", () => {
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    test(`is on screen and thumb-sized at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
      const page = await phonePage(browser, viewport);
      await openClue(page);

      const layout = await page.evaluate(() => {
        const buzzer = document.querySelector('[data-testid="buzzer"]');
        const text = document.querySelector('[data-testid="clue-text"]');
        const b = buzzer?.getBoundingClientRect();
        const t = text?.getBoundingClientRect();
        return {
          buzzerTop: b?.top ?? -1,
          buzzerBottom: b?.bottom ?? -1,
          buzzerHeight: b?.height ?? 0,
          textTop: t?.top ?? -1,
          touchAction: buzzer ? getComputedStyle(buzzer).touchAction : "",
          viewportHeight: window.innerHeight,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        };
      });
      expect(layout.buzzerTop).toBeGreaterThanOrEqual(0);
      expect(layout.buzzerBottom).toBeLessThanOrEqual(layout.viewportHeight);
      expect(layout.buzzerHeight).toBeGreaterThanOrEqual(44);
      expect(layout.textTop, JSON.stringify(layout)).toBeGreaterThanOrEqual(0);
      expect(layout.textTop).toBeLessThan(layout.viewportHeight);
      expect(layout.touchAction).toBe("manipulation");
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);

      await page.getByTestId("buzzer").tap();
      await expect(page.getByTestId("buzzer")).toHaveText("IN!", { timeout: 10_000 });
      await page.context().close();
    });
  }
});

async function phonePage(browser: Browser, viewport: { width: number; height: number }) {
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
  return context.newPage();
}

/** Starts a solo game on the fixture board and opens the first clue. */
async function openClue(
  page: Page,
  options: { long?: boolean; keepPacing?: boolean; clues?: unknown[] } = {},
) {
  await startFixtureGame(page);

  // Give the buzzer room so the test isn't racing the show's pacing, and swap
  // in a wordy clue when the layout is what's under test.
  await page.evaluate(([long, keepPacing, customClues]) => {
    const store = (window as unknown as { __game: { getState: () => Record<string, never> } })
      .__game.getState() as unknown as {
      runtime: { sendCommand: (id: string, command: unknown) => void };
      lobby: { hostId: string };
      setPreference: (key: string, value: unknown) => void;
    };
    if (keepPacing) {
      // Sound is off by default, and a silent table paces itself from the
      // engine's estimate. This spec is about the voice, so switch it on.
      store.setPreference("soundEnabled", true);
    }
    store.runtime.sendCommand(store.lobby.hostId, {
      type: "update-settings",
      settings: keepPacing
        ? // Leave the readout estimate short, so only the voice can be what
          // holds the buzzer shut.
          { buzzWindowMs: 120_000, autoAdvanceMs: 0, roundIntroMs: 0, buzzUnlockDelayMs: 200, readoutPerCharMs: 0 }
        : { buzzWindowMs: 120_000, autoAdvanceMs: 0, roundIntroMs: 0 },
    });
    if (long || customClues) {
      store.runtime.sendCommand(store.lobby.hostId, {
        type: "load-game",
        clues: customClues ?? [
          {
            id: "long-1",
            round: "jeopardy",
            category: "LITERATURE",
            value: 200,
            clue:
              "In a 1922 letter to his publisher this author described the novel he was " +
              "finishing as an epic of two races, and of the cycle of the human body, set " +
              "in a single day in a city he had not lived in for eighteen years, adding " +
              "that he had put in so many enigmas and puzzles that it would keep the " +
              "professors busy for centuries arguing over what he meant.",
            correctResponse: "James Joyce",
          },
        ],
      });
      store.runtime.sendCommand(store.lobby.hostId, { type: "start-game" });
      store.runtime.sendCommand(store.lobby.hostId, {
        type: "update-settings",
        settings: { buzzWindowMs: 120_000, autoAdvanceMs: 0, roundIntroMs: 0 },
      });
    }
  }, [Boolean(options.long), Boolean(options.keepPacing), options.clues ?? null] as const);

  await page.getByRole("button", { name: /\$200/ }).first().click({ timeout: 20_000 });
  await expect(page.getByTestId("clue-stage")).toBeVisible();
  if (options.keepPacing || options.clues) return;
  if (options.long) {
    // The layout is what's under test; the clue only has to be on screen, and
    // a wordy one is read for far longer than a spec should sit waiting.
    await expect(page.getByTestId("clue-text")).toBeVisible();
    return;
  }
  // Wait out the readout so the buzzer is live.
  await expect(page.getByTestId("buzzer")).toBeEnabled({ timeout: 20_000 });
}
