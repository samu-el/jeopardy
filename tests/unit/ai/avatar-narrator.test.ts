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

  it("reports a cue as queued before the voice reaches it", () => {
    const order: string[] = [];
    const narrator = new AvatarNarrator({
      voice: {
        speak: () => order.push("speak"),
        cancel: () => {},
        isSupported: () => true,
        listVoices: () => [],
        listDiscoveredVoices: () => [],
        refreshVoices: () => {},
      },
      getProfile: () => baselineAvatarHostProfiles[0],
      getMode: () => "voice-only",
      getVoiceProfileId: () => "browser-default",
      getSoundEnabled: () => true,
      onCueQueued: (cue) => order.push(`queued:${cue.type}`),
    });
    narrator.emit({ type: "clue-readout", context: { clueText: "Held from here." } });
    expect(order).toEqual(["queued:clue-readout", "speak"]);
  });

  it("ignores the end of a cue it cancelled", () => {
    // A cancelled utterance still fires onend. Reporting that as "read"
    // would open the buzzer on a clue whose readout never happened.
    let end: (() => void) | undefined;
    const spoken: string[] = [];
    const narrator = new AvatarNarrator({
      voice: {
        speak: (request) => {
          end = () => request.onEnd?.();
        },
        cancel: () => {},
        isSupported: () => true,
        listVoices: () => [],
        listDiscoveredVoices: () => [],
        refreshVoices: () => {},
      },
      getProfile: () => baselineAvatarHostProfiles[0],
      getMode: () => "voice-only",
      getVoiceProfileId: () => "browser-default",
      getSoundEnabled: () => true,
      onCueSpoken: (cue) => spoken.push(cue.type),
    });

    narrator.emit({ type: "clue-readout", context: { clueText: "Dropped mid-sentence." } });
    const cancelled = end;
    narrator.cancel();
    cancelled?.();
    expect(spoken).toEqual([]);

    narrator.emit({ type: "clue-readout", context: { clueText: "Read all the way." } });
    end?.();
    expect(spoken).toEqual(["clue-readout"]);
  });

  it("interrupts the queue once, not on every replay of the same cue", () => {
    // The room republishes state constantly and the UI replays the same
    // event batch with it. A repeat of a cue must not cut the voice off
    // mid-sentence — least of all the clue it just queued.
    const cancel = vi.fn();
    const narrator = new AvatarNarrator({
      voice: {
        speak: () => {},
        cancel,
        isSupported: () => true,
        listVoices: () => [],
        listDiscoveredVoices: () => [],
        refreshVoices: () => {},
      },
      getProfile: () => baselineAvatarHostProfiles[0],
      getMode: () => "voice-only",
      getVoiceProfileId: () => "browser-default",
      getSoundEnabled: () => true,
    });
    const pick = { type: "clue-selected", context: { category: "Math", value: 200 } } as const;
    narrator.emit(pick, { interruptQueue: true });
    narrator.emit(pick, { interruptQueue: true });
    narrator.emit(pick, { interruptQueue: true });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("findAvatarProfile falls back to first profile", () => {
    expect(findAvatarProfile(undefined).id).toBe(baselineAvatarHostProfiles[0].id);
    expect(findAvatarProfile("nonexistent").id).toBe(baselineAvatarHostProfiles[0].id);
  });
});
