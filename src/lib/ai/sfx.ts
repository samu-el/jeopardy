export type SfxKind = "buzz" | "correct" | "incorrect" | "timeout" | "tick";

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
  }
}

export function primeAudio() {
  // Browsers gate WebAudio behind user gesture. Calling this from a click
  // handler unlocks the context for subsequent automatic plays.
  void ctx();
}
