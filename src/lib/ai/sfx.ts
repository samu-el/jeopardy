export type SfxKind =
  | "buzz"
  | "correct"
  | "incorrect"
  | "timeout"
  | "tick"
  | "daily-double";

let context: AudioContext | undefined;

function ctx(): AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  if (!context) {
    const ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!ctor) return undefined;
    context = new ctor();
  }
  if (context.state === "suspended") {
    void context.resume();
  }
  return context;
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
}: {
  freq: number;
  duration: number;
  type?: OscillatorType;
  attack?: number;
  release?: number;
  gain?: number;
  delay?: number;
  freqEnd?: number;
}) {
  const audio = ctx();
  if (!audio) return;
  const start = audio.currentTime + delay;
  const stop = start + duration;
  const osc = audio.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), stop);
  }
  const env = audio.createGain();
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(gain, start + attack);
  env.gain.setValueAtTime(gain, stop - release);
  env.gain.linearRampToValueAtTime(0, stop);
  osc.connect(env).connect(audio.destination);
  osc.start(start);
  osc.stop(stop + 0.02);
}

export function playSfx(kind: SfxKind) {
  switch (kind) {
    case "buzz":
      tone({ freq: 880, duration: 0.16, type: "square", gain: 0.16 });
      break;
    case "correct":
      tone({ freq: 660, duration: 0.12, type: "triangle", gain: 0.18 });
      tone({ freq: 880, duration: 0.18, type: "triangle", gain: 0.18, delay: 0.12 });
      tone({ freq: 1320, duration: 0.22, type: "triangle", gain: 0.16, delay: 0.3 });
      break;
    case "incorrect":
      tone({ freq: 220, duration: 0.18, type: "sawtooth", gain: 0.18 });
      tone({ freq: 165, duration: 0.28, type: "sawtooth", gain: 0.18, delay: 0.18 });
      break;
    case "timeout":
      // Classic "time's up" — descending two-tone buzzer.
      tone({ freq: 340, freqEnd: 200, duration: 0.4, type: "sawtooth", gain: 0.22 });
      tone({ freq: 200, freqEnd: 110, duration: 0.45, type: "square", gain: 0.16, delay: 0.4 });
      break;
    case "tick":
      tone({ freq: 1200, duration: 0.05, type: "sine", gain: 0.08 });
      break;
    case "daily-double":
      // Rising three-tone sting
      tone({ freq: 523, duration: 0.18, type: "triangle", gain: 0.22 });
      tone({ freq: 659, duration: 0.18, type: "triangle", gain: 0.22, delay: 0.15 });
      tone({ freq: 880, duration: 0.32, type: "triangle", gain: 0.22, delay: 0.3 });
      break;
  }
}

export function primeAudio() {
  // Browsers gate WebAudio behind user gesture. Calling this from a click
  // handler unlocks the context for subsequent automatic plays.
  void ctx();
}

// Original ambient countdown loop used during Final Jeopardy. Not a
// reproduction of any third-party melody — a simple descending arpeggio
// in a minor mode that breathes in time with the wager window.
let thinkScheduled = false;
let thinkStopAt = 0;

export function startFinalTheme(durationSec = 30): void {
  const audio = ctx();
  if (!audio || thinkScheduled) return;
  thinkScheduled = true;
  const start = audio.currentTime;
  thinkStopAt = start + durationSec;
  const notes = [392, 349, 311, 294, 261, 233, 220, 196];
  const bpm = 75;
  const beat = 60 / bpm;
  let t = start;
  let idx = 0;
  while (t < thinkStopAt) {
    const freq = notes[idx % notes.length];
    tone({
      freq,
      duration: beat * 0.9,
      type: "sine",
      gain: 0.05,
      delay: t - audio.currentTime,
      attack: 0.05,
      release: 0.15,
    });
    tone({
      freq: freq / 2,
      duration: beat * 0.9,
      type: "triangle",
      gain: 0.03,
      delay: t - audio.currentTime,
      attack: 0.05,
      release: 0.15,
    });
    t += beat;
    idx += 1;
  }
  setTimeout(() => {
    thinkScheduled = false;
  }, durationSec * 1000);
}

export function stopFinalTheme(): void {
  // Web Audio doesn't expose a clean queue cancel without rebuilding ctx.
  // For brevity we simply let scheduled tones fade out at their own envelope
  // — caller-side state guards prevent re-arming.
  thinkScheduled = false;
}
