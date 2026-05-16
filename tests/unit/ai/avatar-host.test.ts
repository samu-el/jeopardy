import { describe, expect, it } from "vitest";
import {
  baselineAvatarHostProfiles,
  type AvatarHostProfile,
} from "@/lib/foundation/game-contracts";
import { generateAvatarHostCue } from "@/lib/ai";

describe("avatar host cues", () => {
  it("never reveals the correct response in any cue payload", () => {
    const secret = "the-secret-answer";
    for (const profile of baselineAvatarHostProfiles) {
      const cues = [
        generateAvatarHostCue({ type: "intro", profile }),
        generateAvatarHostCue({
          type: "answer-correct",
          profile,
          context: { playerName: "Ada", correctResponse: secret },
        }),
        generateAvatarHostCue({
          type: "answer-incorrect",
          profile,
          context: { correctResponse: secret },
        }),
        generateAvatarHostCue({
          type: "buzzer-unlocked",
          profile,
          context: { correctResponse: secret },
        }),
      ];
      for (const cue of cues) {
        expect(cue.text).not.toContain(secret);
      }
    }
  });

  it("disables speech when avatar mode is off", () => {
    const profile = baselineAvatarHostProfiles[0];
    const cue = generateAvatarHostCue({ type: "intro", profile, mode: "off" });
    expect(cue.speak).toBe(false);
  });

  it("only emits rule reminders when the profile allows them", () => {
    const strict: AvatarHostProfile = {
      ...baselineAvatarHostProfiles[2],
      allowRuleReminders: false,
    };
    const open: AvatarHostProfile = {
      ...baselineAvatarHostProfiles[0],
      allowRuleReminders: true,
    };
    expect(generateAvatarHostCue({ type: "pacing-reminder", profile: strict }).speak).toBe(false);
    expect(generateAvatarHostCue({ type: "pacing-reminder", profile: open }).speak).toBe(true);
  });
});
