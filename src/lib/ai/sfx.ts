export type SfxKind =
  | "select"
  | "buzz"
  | "correct"
  | "incorrect"
  | "timeout"
  | "tick"
  | "daily-double"
  | "round-start"
  | "applause";

let context: AudioContext | undefined;
let master: GainNode | undefined;

function ctx(): AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  if (!context) {
    const ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!ctor) return undefined;
    context = new ctor();
    master = context.createGain();
    master.gain.value = 0.9;
    master.connect(context.destination);
  }
  if (context.state === "suspended") {
    void context.resume();
  }
  return context;
}

function out(): AudioNode | undefined {
  const audio = ctx();
  if (!audio) return undefined;
  return master ?? audio.destination;
}

interface ToneOptions {
  freq: number;
  duration: number;
  type?: OscillatorType;
  attack?: number;
  release?: number;
  gain?: number;
  delay?: number;
  freqEnd?: number;
  /** Slight detune in cents, for thickening a pad. */
  detune?: number;
  /** Route through a sub-bus (used by the countdown so it can be cut). */
  destination?: AudioNode;
}

function tone({
  freq,
  duration,
  type = "sine",
  attack = 0.005,
  release = 0.04,
  gain = 0.18,
  delay = 0,
  freqEnd,
  detune = 0,
  destination: routed,
}: ToneOptions) {
  const audio = ctx();
  const destination = routed ?? out();
  if (!audio || !destination) return;
  const start = audio.currentTime + delay;
  const stop = start + duration;
  const osc = audio.createOscillator();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(freq, start);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), stop);
  }
  const env = audio.createGain();
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(gain, start + attack);
  env.gain.setValueAtTime(gain, Math.max(start + attack, stop - release));
  env.gain.linearRampToValueAtTime(0, stop);
  osc.connect(env).connect(destination);
  osc.start(start);
  osc.stop(stop + 0.02);
}

/** Short filtered-noise burst — used for the applause swell. */
function noise({
  duration,
  gain = 0.12,
  delay = 0,
  bandpassHz = 1_800,
  q = 0.7,
}: {
  duration: number;
  gain?: number;
  delay?: number;
  bandpassHz?: number;
  q?: number;
}) {
  const audio = ctx();
  const destination = out();
  if (!audio || !destination) return;
  const frames = Math.floor(audio.sampleRate * duration);
  const buffer = audio.createBuffer(1, Math.max(1, frames), audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < frames; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  const source = audio.createBufferSource();
  source.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = bandpassHz;
  filter.Q.value = q;
  const start = audio.currentTime + delay;
  const env = audio.createGain();
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(gain, start + duration * 0.25);
  env.gain.linearRampToValueAtTime(0, start + duration);
  source.connect(filter).connect(env).connect(destination);
  source.start(start);
  source.stop(start + duration + 0.02);
}

/**
 * Every cue here is synthesized from scratch. The show's own stings and its
 * think music are copyrighted recordings and are not reproduced — these are
 * original tones written to sit in the same register and pacing.
 */
export function playSfx(kind: SfxKind) {
  switch (kind) {
    case "select":
      // Soft confirm when a square is chosen.
      tone({ freq: 620, duration: 0.07, type: "sine", gain: 0.1 });
      tone({ freq: 930, duration: 0.09, type: "sine", gain: 0.08, delay: 0.05 });
      break;
    case "buzz":
      // Ring-in: bright two-tone chime, the "someone's in" moment.
      tone({ freq: 1_244, duration: 0.1, type: "square", gain: 0.13 });
      tone({ freq: 1_661, duration: 0.16, type: "square", gain: 0.11, delay: 0.07 });
      break;
    case "correct":
      tone({ freq: 784, duration: 0.1, type: "triangle", gain: 0.17 });
      tone({ freq: 1_047, duration: 0.14, type: "triangle", gain: 0.17, delay: 0.09 });
      tone({ freq: 1_568, duration: 0.22, type: "triangle", gain: 0.13, delay: 0.2 });
      break;
    case "incorrect":
      // The flat "wrong" honk: two low sawtooth stabs.
      tone({ freq: 196, duration: 0.2, type: "sawtooth", gain: 0.16 });
      tone({ freq: 165, duration: 0.3, type: "sawtooth", gain: 0.16, delay: 0.18 });
      break;
    case "timeout":
      // Time's up: descending double buzzer.
      tone({ freq: 330, freqEnd: 196, duration: 0.42, type: "sawtooth", gain: 0.2 });
      tone({ freq: 196, freqEnd: 110, duration: 0.5, type: "square", gain: 0.15, delay: 0.4 });
      break;
    case "tick":
      tone({ freq: 1_200, duration: 0.045, type: "sine", gain: 0.06 });
      break;
    case "daily-double":
      // Rising fanfare with a shimmer on top.
      tone({ freq: 392, duration: 0.16, type: "triangle", gain: 0.2 });
      tone({ freq: 523, duration: 0.16, type: "triangle", gain: 0.2, delay: 0.13 });
      tone({ freq: 659, duration: 0.18, type: "triangle", gain: 0.2, delay: 0.26 });
      tone({ freq: 1_047, duration: 0.5, type: "triangle", gain: 0.18, delay: 0.4 });
      tone({ freq: 1_319, duration: 0.5, type: "sine", gain: 0.1, delay: 0.42, detune: 6 });
      break;
    case "round-start":
      // Four-note lift under the round title card.
      tone({ freq: 349, duration: 0.16, type: "triangle", gain: 0.16 });
      tone({ freq: 440, duration: 0.16, type: "triangle", gain: 0.16, delay: 0.15 });
      tone({ freq: 523, duration: 0.16, type: "triangle", gain: 0.16, delay: 0.3 });
      tone({ freq: 698, duration: 0.6, type: "triangle", gain: 0.18, delay: 0.45 });
      break;
    case "applause":
      noise({ duration: 1.6, gain: 0.1, bandpassHz: 2_400, q: 0.5 });
      noise({ duration: 1.2, gain: 0.06, delay: 0.25, bandpassHz: 1_200, q: 0.4 });
      break;
  }
}

export function primeAudio() {
  // Browsers gate WebAudio behind a user gesture. Calling this from a click
  // handler unlocks the context for subsequent automatic plays.
  void ctx();
}

export function setSfxVolume(volume: number) {
  ctx();
  if (master) master.gain.value = Math.max(0, Math.min(1, volume));
}

// The Final Jeopardy countdown. Original composition — the show's "Think!"
// theme is copyrighted and is not reproduced. Same job: 30 seconds of
// steady, ticking tension that runs out with the clock.
let finalBus: GainNode | undefined;
let finalTimer: ReturnType<typeof setTimeout> | undefined;

export function startFinalTheme(durationSec = 30): void {
  const audio = ctx();
  const destination = out();
  if (!audio || !destination || finalBus) return;

  // Its own bus, so the countdown can be cut without touching other cues.
  finalBus = audio.createGain();
  finalBus.gain.value = 1;
  finalBus.connect(destination);

  const start = audio.currentTime;
  const stopAt = start + durationSec;
  // 75bpm walking figure with a tick on the offbeat.
  const bpm = 75;
  const beat = 60 / bpm;
  const melody = [392, 349, 330, 294, 262, 294, 330, 349];
  let time = start;
  let index = 0;
  while (time < stopAt) {
    const freq = melody[index % melody.length];
    const delay = time - audio.currentTime;
    tone({
      freq,
      duration: beat * 0.85,
      type: "sine",
      gain: 0.05,
      delay,
      attack: 0.05,
      release: 0.15,
      destination: finalBus,
    });
    tone({
      freq: freq / 2,
      duration: beat * 0.85,
      type: "triangle",
      gain: 0.035,
      delay,
      attack: 0.05,
      release: 0.15,
      destination: finalBus,
    });
    tone({
      freq: 1_600,
      duration: 0.03,
      type: "sine",
      gain: 0.02,
      delay: delay + beat / 2,
      destination: finalBus,
    });
    time += beat;
    index += 1;
  }

  finalTimer = setTimeout(() => stopFinalTheme(), durationSec * 1_000);
}

export function stopFinalTheme(): void {
  if (finalTimer) {
    clearTimeout(finalTimer);
    finalTimer = undefined;
  }
  const audio = ctx();
  const bus = finalBus;
  finalBus = undefined;
  if (!audio || !bus) return;
  // Fade the countdown bus out, then drop it: the tones scheduled on it are
  // silenced no matter how far ahead they were queued.
  const now = audio.currentTime;
  bus.gain.cancelScheduledValues(now);
  bus.gain.setValueAtTime(bus.gain.value, now);
  bus.gain.linearRampToValueAtTime(0.0001, now + 0.35);
  setTimeout(() => {
    try {
      bus.disconnect();
    } catch {
      // Already disconnected.
    }
  }, 500);
}

export function isFinalThemePlaying(): boolean {
  return finalBus !== undefined;
}
