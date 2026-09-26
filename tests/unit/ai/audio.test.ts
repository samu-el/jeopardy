import { afterEach, describe, expect, it, vi } from "vitest";
import {
  describeSpeechRecognitionError,
  getAudioMix,
  installAudioUnlock,
  onAudioMixChange,
  resetAudioMix,
  setAudioMix,
  setPlaybackAudioSession,
} from "@/lib/ai";

afterEach(() => resetAudioMix());

describe("audio mix", () => {
  it("keeps separate, clamped levels for voice, effects and music", () => {
    setAudioMix({ voice: 0.4, effects: 2, music: -1 });
    expect(getAudioMix()).toMatchObject({ voice: 0.4, effects: 1, music: 0, muted: false });
    setAudioMix({ muted: true });
    expect(getAudioMix()).toMatchObject({ voice: 0.4, muted: true });
  });

  it("notifies listeners only on a real change", () => {
    const listener = vi.fn();
    const off = onAudioMixChange(listener);
    setAudioMix({ voice: 0.5 });
    setAudioMix({ voice: 0.5 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][1].voice).toBe(1);
    off();
    setAudioMix({ voice: 0.2 });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("audio unlock", () => {
  it("asks for a playback audio session where the browser has one", () => {
    const session = { type: "auto" };
    expect(setPlaybackAudioSession({ audioSession: session } as unknown as Navigator)).toBe(true);
    expect(session.type).toBe("playback");
    expect(setPlaybackAudioSession({} as Navigator)).toBe(false);
  });

  it("listens for the first gesture and then removes itself", () => {
    const added: string[] = [];
    const removed: string[] = [];
    let handler: (() => void) | undefined;
    const target = {
      addEventListener: (type: string, listener: () => void) => {
        added.push(type);
        handler = listener;
      },
      removeEventListener: (type: string) => removed.push(type),
    } as unknown as Document;
    installAudioUnlock(target);
    expect(added).toEqual(["pointerdown", "keydown", "touchend"]);
    handler?.();
    expect(removed).toEqual(["pointerdown", "keydown", "touchend"]);
  });
});

describe("speech recognition errors", () => {
  it("explains each failure in plain words", () => {
    expect(describeSpeechRecognitionError("not-allowed")).toMatchObject({ blocked: true });
    expect(describeSpeechRecognitionError("not-allowed")?.message).toMatch(/blocked/i);
    expect(describeSpeechRecognitionError("no-speech")?.message).toMatch(/didn't catch/i);
    expect(describeSpeechRecognitionError("network")?.blocked).toBe(false);
    expect(describeSpeechRecognitionError("audio-capture")?.message).toMatch(/microphone/i);
    expect(describeSpeechRecognitionError("something-new")?.message).toBeTruthy();
  });

  it("treats a deliberate abort as no error at all", () => {
    expect(describeSpeechRecognitionError("aborted")).toBeNull();
  });
});
