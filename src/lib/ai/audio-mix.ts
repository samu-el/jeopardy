/**
 * The audio mix: one level each for the host's voice, sound effects and
 * music, plus a master mute. Pure state with listeners — the Web Audio
 * graph (sfx.ts) and the speech adapter (voice.ts) read it, and the UI
 * writes it from the player's preferences.
 */

export interface AudioMix {
  /** Host voice and clue readout, 0–1. */
  voice: number;
  /** Stings: select, buzz, correct, incorrect, timeout, applause. 0–1. */
  effects: number;
  /** The Final Jeopardy countdown. 0–1. */
  music: number;
  /** Everything off. */
  muted: boolean;
}

export const defaultAudioMix: AudioMix = { voice: 1, effects: 0.9, music: 0.8, muted: false };

let mix: AudioMix = { ...defaultAudioMix };
const listeners = new Set<(mix: AudioMix, previous: AudioMix) => void>();

function clampLevel(value: number | undefined, fallback: number) {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

export function getAudioMix(): AudioMix {
  return mix;
}

/** Merges levels into the mix. Out-of-range levels are clamped to 0–1. */
export function setAudioMix(next: Partial<AudioMix>): AudioMix {
  const previous = mix;
  const merged: AudioMix = {
    voice: clampLevel(next.voice, previous.voice),
    effects: clampLevel(next.effects, previous.effects),
    music: clampLevel(next.music, previous.music),
    muted: next.muted ?? previous.muted,
  };
  if (
    merged.voice === previous.voice &&
    merged.effects === previous.effects &&
    merged.music === previous.music &&
    merged.muted === previous.muted
  ) {
    return previous;
  }
  mix = merged;
  for (const listener of listeners) listener(mix, previous);
  return mix;
}

export function onAudioMixChange(listener: (mix: AudioMix, previous: AudioMix) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test helper: back to the defaults, listeners kept. */
export function resetAudioMix() {
  setAudioMix(defaultAudioMix);
}
