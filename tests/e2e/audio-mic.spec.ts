import { expect, test, type Page } from "@playwright/test";
import { startFixtureGame } from "./helpers";

/**
 * Voice answers and the host's voice: the mic says what went wrong, Stop
 * never sends a half-spoken answer, and muting silences the host at once.
 */

type Store = {
  getState: () => {
    runtime: { sendCommand: (id: string, command: unknown) => void };
    lobby: { hostId: string };
    setPreference: (key: string, value: unknown) => void;
  };
};

async function openLiveClue(page: Page, settings: Record<string, unknown> = {}) {
  await startFixtureGame(page);
  await page.evaluate((extra) => {
    const store = (window as unknown as { __game: Store }).__game.getState();
    store.runtime.sendCommand(store.lobby.hostId, {
      type: "update-settings",
      settings: { buzzWindowMs: 120_000, autoAdvanceMs: 0, roundIntroMs: 0, ...extra },
    });
  }, settings);
  await page.getByRole("button", { name: /\$200/ }).first().click({ timeout: 20_000 });
  await expect(page.getByTestId("clue-stage")).toBeVisible();
}

/** A stand-in recogniser: `mode` decides what the "microphone" does. */
function fakeRecognition(page: Page, mode: "interim-then-wait" | "denied") {
  return page.addInitScript((behaviour) => {
    class FakeRecognition extends EventTarget {
      continuous = false;
      interimResults = false;
      lang = "en-US";
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onstart: (() => void) | null = null;
      start() {
        this.onstart?.();
        if (behaviour === "denied") {
          setTimeout(() => {
            this.onerror?.({ error: "not-allowed" });
            this.onend?.();
          }, 30);
          return;
        }
        setTimeout(() => {
          this.onresult?.({
            resultIndex: 0,
            results: {
              length: 1,
              0: { isFinal: false, length: 1, 0: { transcript: "what is jup", confidence: 0.5 } },
            },
          });
        }, 30);
      }
      stop() {
        // A real recogniser delivers its final result on stop().
        this.onresult?.({
          resultIndex: 0,
          results: {
            length: 1,
            0: { isFinal: true, length: 1, 0: { transcript: "what is jup", confidence: 0.5 } },
          },
        });
        this.onend?.();
      }
      abort() {
        this.onerror?.({ error: "aborted" });
        this.onend?.();
      }
    }
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
  }, mode);
}

test.describe("Mic answers", () => {
  test("Stop listening keeps the words for review instead of sending them", async ({ page }) => {
    await fakeRecognition(page, "interim-then-wait");
    await openLiveClue(page);
    await expect(page.getByTestId("buzzer")).toBeEnabled({ timeout: 20_000 });
    await page.keyboard.press("Space");
    await expect(page.getByTestId("buzzer")).toHaveText("IN!", { timeout: 15_000 });

    await page.getByTestId("mic-toggle").click();
    await expect(page.getByTestId("mic-status")).toHaveText(/Listening/);
    await expect(page.getByLabel("What is…")).toHaveValue("what is jup");

    await page.getByRole("button", { name: "Stop listening" }).click();
    await expect(page.getByTestId("mic-status")).toHaveText(/Check your answer/);
    await expect(page.getByLabel("What is…")).toHaveValue("what is jup");
    await page.waitForTimeout(500);
    await expect(page.getByTestId("correct-response")).toHaveCount(0);
  });

  test("a blocked microphone says so and disables the mic", async ({ page }) => {
    await fakeRecognition(page, "denied");
    await openLiveClue(page);
    await expect(page.getByTestId("buzzer")).toBeEnabled({ timeout: 20_000 });
    await page.keyboard.press("Space");
    await expect(page.getByTestId("buzzer")).toHaveText("IN!", { timeout: 15_000 });

    await page.getByTestId("mic-toggle").click();
    await expect(page.getByTestId("mic-status")).toHaveText(/Microphone blocked/);
    await expect(page.getByRole("status").filter({ hasText: /Microphone blocked/ })).toHaveCount(1);
    await expect(page.getByTestId("mic-toggle")).toBeDisabled();
  });
});

test.describe("Sound effects", () => {
  test("a buzz plays its sting once, not once per state update", async ({ page }) => {
    await page.addInitScript(() => {
      const made: OscillatorNode[] = [];
      (window as unknown as { __oscillators: OscillatorNode[] }).__oscillators = made;
      const original = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function (this: AudioContext) {
        const node = original.call(this);
        made.push(node);
        return node;
      };
    });
    await startFixtureGame(page);
    await page.evaluate(() => {
      (window as unknown as { __game: Store }).__game.getState().setPreference("soundEnabled", true);
    });
    await page.evaluate(() => {
      const store = (window as unknown as { __game: Store }).__game.getState();
      store.runtime.sendCommand(store.lobby.hostId, {
        type: "update-settings",
        settings: { buzzWindowMs: 120_000, autoAdvanceMs: 0, roundIntroMs: 0 },
      });
    });
    await page.getByRole("button", { name: /\$200/ }).first().click({ timeout: 20_000 });
    await expect(page.getByTestId("buzzer")).toBeEnabled({ timeout: 30_000 });
    await page.evaluate(() => {
      (window as unknown as { __oscillators: OscillatorNode[] }).__oscillators.length = 0;
    });
    await page.keyboard.press("Space");
    await expect(page.getByTestId("buzzer")).toHaveText("IN!", { timeout: 15_000 });
    await page.waitForTimeout(800);
    const squares = await page.evaluate(
      () =>
        (window as unknown as { __oscillators: OscillatorNode[] }).__oscillators.filter(
          (node) => node.type === "square",
        ).length,
    );
    // The buzz sting is two square-wave tones.
    expect(squares).toBe(2);
  });
});

test.describe("Host voice", () => {
  test.beforeEach(async ({ page }) => {
    // A fake speech engine that logs what it's asked to do.
    await page.addInitScript(() => {
      const log: { ev: string; text?: string }[] = [];
      (window as unknown as { __speech: typeof log }).__speech = log;
      let current: { text: string; onend?: () => void; onerror?: () => void } | null = null;
      const queue: (typeof current)[] = [];
      let timer: number | undefined;
      const next = () => {
        if (current || queue.length === 0) return;
        current = queue.shift() ?? null;
        const utterance = current as unknown as {
          text: string;
          onstart?: () => void;
          onend?: () => void;
        };
        log.push({ ev: "start", text: utterance.text });
        setTimeout(() => utterance.onstart?.(), 5);
        timer = window.setTimeout(() => {
          log.push({ ev: "end", text: utterance.text });
          current = null;
          utterance.onend?.();
          next();
        }, Math.max(50, utterance.text.length * 40));
      };
      const synth = {
        getVoices: () => [
          { name: "Google US English", lang: "en-US", voiceURI: "g", localService: false, default: true },
        ],
        speak(utterance: { text: string }) {
          log.push({ ev: "speak", text: utterance.text });
          queue.push(utterance as never);
          next();
        },
        cancel() {
          log.push({ ev: "cancel" });
          queue.length = 0;
          if (timer) clearTimeout(timer);
          const was = current;
          current = null;
          (was as unknown as { onerror?: () => void } | null)?.onerror?.();
        },
        addEventListener() {},
        removeEventListener() {},
        pause() {},
        resume() {},
      };
      Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
      (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
        function (this: Record<string, unknown>, text: string) {
          this.text = text;
        };
    });
  });

  test("muting mid-readout stops the voice at once", async ({ page }) => {
    await startFixtureGame(page);
    await page.evaluate(() => {
      (window as unknown as { __game: Store }).__game
        .getState()
        .setPreference("soundEnabled", true);
    });
    await page.evaluate(() => {
      const store = (window as unknown as { __game: Store }).__game.getState();
      store.runtime.sendCommand(store.lobby.hostId, {
        type: "update-settings",
        settings: { buzzWindowMs: 120_000, autoAdvanceMs: 0, roundIntroMs: 0 },
      });
    });
    await page.getByRole("button", { name: /\$200/ }).first().click({ timeout: 20_000 });
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as unknown as { __speech: { ev: string }[] }).__speech.some(
            (entry) => entry.ev === "start",
          ),
        ),
      )
      .toBe(true);
    const before = await page.evaluate(
      () => (window as unknown as { __speech: unknown[] }).__speech.length,
    );
    await page.evaluate(() => {
      (window as unknown as { __game: Store }).__game
        .getState()
        .setPreference("soundEnabled", false);
    });
    await expect
      .poll(() =>
        page.evaluate(
          (from) =>
            (window as unknown as { __speech: { ev: string }[] }).__speech
              .slice(from)
              .some((entry) => entry.ev === "cancel"),
          before,
        ),
      )
      .toBe(true);
  });
});
