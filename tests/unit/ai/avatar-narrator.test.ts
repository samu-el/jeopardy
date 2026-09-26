import { describe, expect, it, vi } from "vitest";
import {
  AvatarNarrator,
  findAvatarProfile,
  gameEventKey,
  spokenDurationEstimateMs,
  type AvatarNarratorConfig,
} from "@/lib/runtime";
import { readoutRate, type SpeakRequest } from "@/lib/ai";
import { baselineAvatarHostProfiles } from "@/lib/ai/profiles";

function recordingNarrator(overrides: Partial<AvatarNarratorConfig> = {}) {
  const requests: SpeakRequest[] = [];
  const cancel = vi.fn();
  const narrator = new AvatarNarrator({
    voice: {
      speak: (request) => requests.push(request),
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
    ...overrides,
  });
  return { narrator, requests, cancel };
}

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

  it("keeps commentary quiet with the host off, but still reads the clue", () => {
    const { narrator, requests } = recordingNarrator({ getMode: () => "off" });
    expect(narrator.emit({ type: "answer-correct", context: { playerName: "Ada" } }).speak).toBe(
      false,
    );
    expect(narrator.emit({ type: "final-prompt" }).speak).toBe(false);
    expect(
      narrator.emit({ type: "clue-readout", context: { clueText: "This is the clue." } }).speak,
    ).toBe(true);
    expect(requests.map((request) => request.text)).toEqual(["This is the clue."]);
  });

  it("says nothing at all with sound off", () => {
    const { narrator, requests } = recordingNarrator({ getSoundEnabled: () => false });
    narrator.emit({ type: "clue-readout", context: { clueText: "Silent." } });
    expect(requests).toEqual([]);
  });

  it("dedupes by event, not by text: a replayed event is silent, a real repeat speaks", () => {
    for (const profile of [baselineAvatarHostProfiles[0], baselineAvatarHostProfiles[1]]) {
      const { narrator, requests } = recordingNarrator({ getProfile: () => profile });
      const sequence = [
        { id: "judged:ada:c1", input: { type: "answer-incorrect", context: { playerName: "Ada" } } },
        { id: "judged:bob:c1", input: { type: "answer-incorrect", context: { playerName: "Bob" } } },
        { id: "judged:cy:c1", input: { type: "answer-correct", context: { playerName: "Ada" } } },
        { id: "picked:c2", input: { type: "clue-selected", context: { category: "Math", value: 200 } } },
        { id: "judged:ada:c2", input: { type: "answer-correct", context: { playerName: "Ada" } } },
        { id: "judged:ada:c3", input: { type: "answer-incorrect", context: { playerName: "Ada" } } },
      ] as const;
      const flags = sequence.map((step) => narrator.emit(step.input, { eventId: step.id }).speak);
      expect(flags).toEqual([true, true, true, true, true, true]);
      expect(requests).toHaveLength(6);

      // The same batch replayed: nothing new is said.
      const replay = sequence.map((step) => narrator.emit(step.input, { eventId: step.id }).speak);
      expect(replay.every((flag) => !flag)).toBe(true);
      expect(requests).toHaveLength(6);

      narrator.resetEvents();
      expect(narrator.emit(sequence[0].input, { eventId: sequence[0].id }).speak).toBe(true);
    }
  });

  it("reads at the player's speech rate", () => {
    const { narrator, requests } = recordingNarrator({ getSpeechRate: () => 1.2 });
    narrator.emit({ type: "clue-readout", context: { clueText: "Fast." } });
    expect(requests[0].rate).toBe(readoutRate(1.2));
    expect(readoutRate(1.2)).toBeGreaterThan(readoutRate(1));
    expect(readoutRate(5)).toBe(readoutRate(1.2));
    expect(readoutRate(undefined)).toBe(0.92);
  });

  it("cancels the clue's lines only while they are still outstanding", () => {
    const { narrator, requests, cancel } = recordingNarrator();
    expect(narrator.cancelIfSpeaking(["clue-readout"])).toBe(false);
    narrator.emit({ type: "clue-readout", context: { clueText: "Long clue." } });
    expect(narrator.isSpeaking(["clue-readout"])).toBe(true);
    expect(narrator.cancelIfSpeaking(["clue-readout"])).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(narrator.isSpeaking()).toBe(false);

    narrator.emit({ type: "clue-readout", context: { clueText: "Read through." } });
    requests.at(-1)?.onEnd?.();
    expect(narrator.cancelIfSpeaking(["clue-readout"])).toBe(false);
  });

  it("reports speaking and silence, including on cancel", () => {
    const changes: boolean[] = [];
    const { narrator, requests } = recordingNarrator({
      onSpeakingChange: (speaking) => changes.push(speaking),
    });
    narrator.emit({ type: "clue-readout", context: { clueText: "One." } });
    requests[0].onStart?.();
    requests[0].onEnd?.();
    narrator.emit({ type: "clue-readout", context: { clueText: "Two." } });
    requests[1].onStart?.();
    narrator.cancel();
    expect(changes).toEqual([true, false, true, false]);
  });

  it("keys game events by what they are, so a replay has the same key", () => {
    const judged = {
      type: "answer-judged",
      clueId: "c1",
      targetPlayerId: "ada",
      correct: false,
      delta: -200,
    } as const;
    expect(gameEventKey(judged)).toBe(gameEventKey({ ...judged }));
    expect(gameEventKey(judged)).not.toBe(gameEventKey({ ...judged, targetPlayerId: "bob" }));
    expect(gameEventKey(judged)).not.toBe(gameEventKey({ ...judged, clueId: "c2" }));
  });

  it("stretches the readout estimate for a slower reading speed", () => {
    const text = "x".repeat(220);
    expect(spokenDurationEstimateMs(text, 0.8)).toBeGreaterThan(spokenDurationEstimateMs(text, 1));
    expect(spokenDurationEstimateMs(text, 1.2)).toBeLessThan(spokenDurationEstimateMs(text, 1));
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
    narrator.emit(pick, { interruptQueue: true, eventId: "picked:c1" });
    narrator.emit(pick, { interruptQueue: true, eventId: "picked:c1" });
    narrator.emit(pick, { interruptQueue: true, eventId: "picked:c1" });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("findAvatarProfile falls back to first profile", () => {
    expect(findAvatarProfile(undefined).id).toBe(baselineAvatarHostProfiles[0].id);
    expect(findAvatarProfile("nonexistent").id).toBe(baselineAvatarHostProfiles[0].id);
  });
});
