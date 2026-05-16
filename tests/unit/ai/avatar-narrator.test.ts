import { describe, expect, it, vi } from "vitest";
import { AvatarNarrator, findAvatarProfile } from "@/lib/runtime";
import { baselineAvatarHostProfiles } from "@/lib/foundation/game-contracts";

describe("AvatarNarrator", () => {
  it("speaks clue readouts through the voice adapter when mode is on", () => {
    const speak = vi.fn();
    const narrator = new AvatarNarrator({
      voice: { speak, cancel: () => {}, isSupported: () => true, listVoices: () => [], listDiscoveredVoices: () => [], refreshVoices: () => {} },
      getProfile: () => baselineAvatarHostProfiles[0],
      getMode: () => "voice-only",
      getVoiceProfileId: () => "browser-default",
      getSoundEnabled: () => true,
    });
    const cue = narrator.emit({
      type: "clue-readout",
      context: { clueText: "This is the clue." },
    });
    expect(cue.speak).toBe(true);
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it("does not speak when host mode is off", () => {
    const speak = vi.fn();
    const narrator = new AvatarNarrator({
      voice: { speak, cancel: () => {}, isSupported: () => true, listVoices: () => [], listDiscoveredVoices: () => [], refreshVoices: () => {} },
      getProfile: () => baselineAvatarHostProfiles[0],
      getMode: () => "off",
      getVoiceProfileId: () => "browser-default",
      getSoundEnabled: () => true,
    });
    const cue = narrator.emit({
      type: "clue-readout",
      context: { clueText: "This is the clue." },
    });
    expect(cue.speak).toBe(false);
    expect(speak).not.toHaveBeenCalled();
  });

  it("does not double-speak the same cue text twice in a row", () => {
    const speak = vi.fn();
    const narrator = new AvatarNarrator({
      voice: { speak, cancel: () => {}, isSupported: () => true, listVoices: () => [], listDiscoveredVoices: () => [], refreshVoices: () => {} },
      getProfile: () => baselineAvatarHostProfiles[1],
      getMode: () => "voice-only",
      getVoiceProfileId: () => "browser-default",
      getSoundEnabled: () => true,
    });
    narrator.emit({ type: "clue-readout", context: { clueText: "Repeat me." } });
    narrator.emit({ type: "clue-readout", context: { clueText: "Repeat me." } });
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it("findAvatarProfile falls back to first profile", () => {
    expect(findAvatarProfile(undefined).id).toBe(baselineAvatarHostProfiles[0].id);
    expect(findAvatarProfile("nonexistent").id).toBe(baselineAvatarHostProfiles[0].id);
  });
});
