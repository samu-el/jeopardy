import { describe, expect, it } from "vitest";
import {
  baselineAvatarHostProfiles,
  baselineBotProfiles,
  baselineVoiceProfiles,
} from "@/lib/ai/profiles";

describe("house profiles", () => {
  it("orders bots from slowest and least accurate to fastest and sharpest", () => {
    const first = baselineBotProfiles[0];
    const last = baselineBotProfiles.at(-1)!;
    expect(last.minBuzzDelayMs).toBeLessThan(first.minBuzzDelayMs);
    expect(last.targetAccuracy).toBeGreaterThan(first.targetAccuracy);
  });

  it("keeps every bot's timings and odds inside the ranges the director assumes", () => {
    for (const bot of baselineBotProfiles) {
      expect(bot.minBuzzDelayMs).toBeGreaterThanOrEqual(0);
      expect(bot.maxBuzzDelayMs).toBeGreaterThan(bot.minBuzzDelayMs);
      expect(bot.targetAccuracy).toBeGreaterThan(0);
      expect(bot.targetAccuracy).toBeLessThanOrEqual(1);
      expect(bot.wagerAggression).toBeGreaterThanOrEqual(0);
      expect(bot.wagerAggression).toBeLessThanOrEqual(1);
    }
  });

  it("points every avatar host at a voice that exists", () => {
    const voices = new Set(baselineVoiceProfiles.map((voice) => voice.id));
    for (const host of baselineAvatarHostProfiles) {
      expect(voices).toContain(host.voiceProfileId);
    }
  });
});
