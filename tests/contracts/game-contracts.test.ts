import { describe, expect, it } from "vitest";
import {
  baselineAvatarHostProfiles,
  baselineBotProfiles,
  baselineVoiceProfiles,
  roundNames,
} from "@/lib/foundation/game-contracts";

describe("game contracts", () => {
  it("keeps the complete Jeopardy round lifecycle explicit", () => {
    expect(roundNames).toEqual([
      "lobby",
      "jeopardy",
      "double-jeopardy",
      "triple-jeopardy",
      "final-jeopardy",
      "complete",
    ]);
  });

  it("defines selectable voice readout profiles", () => {
    expect(baselineVoiceProfiles.map((voice) => voice.id)).toEqual([
      "browser-default",
      "studio-neutral",
      "classic-host",
    ]);
  });

  it("models AI bot difficulty through buzz timing and accuracy", () => {
    for (const bot of baselineBotProfiles) {
      expect(bot.minBuzzDelayMs).toBeGreaterThanOrEqual(0);
      expect(bot.maxBuzzDelayMs).toBeGreaterThan(bot.minBuzzDelayMs);
      expect(bot.targetAccuracy).toBeGreaterThan(0);
      expect(bot.targetAccuracy).toBeLessThanOrEqual(1);
      expect(bot.wagerAggression).toBeGreaterThanOrEqual(0);
      expect(bot.wagerAggression).toBeLessThanOrEqual(1);
    }

    expect(baselineBotProfiles.at(-1)?.minBuzzDelayMs).toBeLessThan(
      baselineBotProfiles[0].minBuzzDelayMs,
    );
  });

  it("defines optional avatar AI host profiles without making them mandatory", () => {
    expect(baselineAvatarHostProfiles.length).toBeGreaterThanOrEqual(3);
    expect(baselineAvatarHostProfiles.map((host) => host.defaultMode)).toContain(
      "avatar-and-voice",
    );

    for (const host of baselineAvatarHostProfiles) {
      expect(host.voiceProfileId).toBeTruthy();
      expect(host.description).toContain("host");
    }
  });
});
