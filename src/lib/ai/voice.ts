import {
  baselineVoiceProfiles as legacyProfiles,
  type VoiceProfile,
} from "@/lib/foundation/game-contracts";

export interface SpeakRequest {
  text: string;
  voiceProfileId?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  onEnd?: () => void;
  /**
   * When true, this utterance interrupts whatever is currently speaking.
   * Default false — utterances queue behind any in-flight speech.
   */
  interrupt?: boolean;
}

export interface DiscoveredVoice {
  id: string;
  label: string;
  locale: string;
  gender?: "female" | "male" | "neutral";
  quality: "premium" | "natural" | "standard" | "basic";
  voice: SpeechSynthesisVoice;
}

export interface VoiceAdapter {
  speak(request: SpeakRequest): void;
  cancel(): void;
  isSupported(): boolean;
  listVoices(): VoiceProfile[];
  listDiscoveredVoices(): DiscoveredVoice[];
  refreshVoices(): void;
}

// Heuristics to rank a SpeechSynthesisVoice for natural-sounding output.
// Browser TTS engines vary wildly in quality; the score favours
// network/neural voices ("Online (Natural)" from Edge, Google's
// "WaveNet"-style voices, Apple's "Enhanced" / "Premium" downloads).
function scoreVoice(voice: SpeechSynthesisVoice): {
  score: number;
  quality: DiscoveredVoice["quality"];
} {
  const name = voice.name.toLowerCase();
  let score = 0;
  let quality: DiscoveredVoice["quality"] = "basic";

  if (/(natural|neural|online|wavenet|polyglot|studio|premium|enhanced)/.test(name)) {
    score += 30;
    quality = "premium";
  } else if (/(google|microsoft|apple)/.test(name) && !/(microsoft david|microsoft mark|microsoft zira)/.test(name)) {
    // Default Microsoft SAPI desktop voices (David/Mark/Zira) sound robotic;
    // hosted Microsoft voices score much higher above. Other Google/Apple
    // voices are usually fine.
    score += 15;
    quality = "natural";
  } else if (voice.localService === false) {
    score += 10;
    quality = "natural";
  } else if (/(samantha|alex|daniel|karen|moira|tessa|allison|ava|tom|fred|kate|serena|veena)/.test(name)) {
    // Apple's bundled higher-quality system voices.
    score += 8;
    quality = "natural";
  } else {
    score += 1;
    quality = "standard";
  }

  if (voice.lang.startsWith("en")) score += 3;
  if (voice.default) score += 1;

  return { score, quality };
}

function detectGender(name: string): DiscoveredVoice["gender"] {
  const lower = name.toLowerCase();
  if (/(aria|jenny|samantha|zira|female|woman|karen|kate|allison|ava|moira|serena|veena|tessa|libby|sonia)/.test(lower)) {
    return "female";
  }
  if (/(guy|david|mark|alex|daniel|fred|tom|matthew|ryan|brian|james|sean|carter)/.test(lower)) {
    return "male";
  }
  return "neutral";
}

function prettifyLabel(voice: SpeechSynthesisVoice): string {
  // Strip noisy suffixes browsers add. Examples we want to collapse:
  //   "Microsoft Aria Online (Natural) - English (United States)" -> "Aria"
  //   "Google US English"  -> "Google US English"
  //   "Samantha (English (United States))" -> "Samantha"
  let name = voice.name;
  name = name.replace(/\(Natural\)/gi, "").trim();
  name = name.replace(/\s*Online\s*/gi, " ").trim();
  name = name.replace(/^Microsoft\s+/i, "");
  name = name.replace(/\s*-\s*English.*$/i, "");
  name = name.replace(/\s*\(English.*?\)\s*$/i, "");
  return name.replace(/\s+/g, " ").trim();
}

function discover(synth: SpeechSynthesis): DiscoveredVoice[] {
  const all = synth.getVoices();
  return all
    .filter((voice) => voice.lang.toLowerCase().startsWith("en"))
    .map((voice) => {
      const { score, quality } = scoreVoice(voice);
      return {
        voice,
        score,
        discovered: {
          id: `browser:${voice.voiceURI || voice.name}`,
          label: prettifyLabel(voice),
          locale: voice.lang,
          gender: detectGender(voice.name),
          quality,
          voice,
        } satisfies DiscoveredVoice,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ discovered }) => discovered);
}

class BrowserVoiceAdapter implements VoiceAdapter {
  private discovered: DiscoveredVoice[] = [];

  constructor() {
    if (this.isSupported()) {
      this.refreshVoices();
      window.speechSynthesis.addEventListener?.("voiceschanged", () => {
        this.refreshVoices();
      });
    }
  }

  isSupported() {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  listVoices() {
    return legacyProfiles;
  }

  listDiscoveredVoices() {
    return [...this.discovered];
  }

  refreshVoices() {
    if (!this.isSupported()) return;
    this.discovered = discover(window.speechSynthesis);
  }

  speak(request: SpeakRequest) {
    if (!this.isSupported()) {
      request.onEnd?.();
      return;
    }
    const synth = window.speechSynthesis;
    if (request.interrupt) {
      synth.cancel();
    }
    if (this.discovered.length === 0) {
      this.refreshVoices();
    }

    const utterance = new SpeechSynthesisUtterance(request.text);
    utterance.rate = request.rate ?? 1;
    utterance.pitch = request.pitch ?? 1;
    utterance.volume = request.volume ?? 1;

    const chosen = this.pickVoice(request.voiceProfileId);
    if (chosen) {
      utterance.voice = chosen.voice;
      utterance.lang = chosen.voice.lang;
    }

    utterance.onend = () => request.onEnd?.();
    utterance.onerror = () => request.onEnd?.();
    synth.speak(utterance);
  }

  cancel() {
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
    }
  }

  private pickVoice(requestedId: string | undefined): DiscoveredVoice | undefined {
    if (!requestedId || requestedId === "browser-default") {
      return this.discovered[0];
    }
    if (requestedId.startsWith("browser:")) {
      return this.discovered.find((voice) => voice.id === requestedId) ?? this.discovered[0];
    }
    // Persona ids: female-natural, male-natural, female-warm, male-warm, deep, bright
    const filtered = matchPersona(this.discovered, requestedId);
    return filtered ?? this.discovered[0];
  }
}

class NoopVoiceAdapter implements VoiceAdapter {
  isSupported() {
    return false;
  }
  listVoices() {
    return legacyProfiles;
  }
  listDiscoveredVoices() {
    return [];
  }
  refreshVoices() {}
  speak(request: SpeakRequest) {
    request.onEnd?.();
  }
  cancel() {}
}

export function createVoiceAdapter(): VoiceAdapter {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return new NoopVoiceAdapter();
  }
  return new BrowserVoiceAdapter();
}

let primed = false;
/**
 * Warms up speech synthesis on the first user gesture. Some Chromium builds
 * (notably with Microsoft SAPI voices on Windows) play the FIRST utterance
 * silently if the engine hasn't been touched yet. Speaking a near-silent
 * utterance from a click handler clears that.
 */
export function primeSpeech() {
  if (primed) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  primed = true;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch {
    // ignore
  }
}

// Curated personas. Each maps to a search predicate; we pick the highest-
// scored discovered voice that matches. The persona id is what gets stored
// in user preferences so it survives across machines.
export interface VoicePersona {
  id: string;
  label: string;
  description: string;
  gender: "female" | "male";
  predicate: (voice: DiscoveredVoice) => boolean;
}

export const voicePersonas: VoicePersona[] = [
  {
    id: "female-natural",
    label: "Aria",
    description: "Natural female",
    gender: "female",
    predicate: (voice) =>
      voice.gender === "female" &&
      (voice.quality === "premium" || /aria|jenny|samantha|libby|sonia|ava/i.test(voice.label)),
  },
  {
    id: "male-natural",
    label: "Guy",
    description: "Natural male",
    gender: "male",
    predicate: (voice) =>
      voice.gender === "male" &&
      (voice.quality === "premium" || /guy|ryan|brian|matthew|alex|tom/i.test(voice.label)),
  },
  {
    id: "female-warm",
    label: "Sonia",
    description: "Warm female",
    gender: "female",
    predicate: (voice) =>
      voice.gender === "female" &&
      /sonia|libby|olivia|emma|nicole|karen|kate|moira/i.test(voice.label),
  },
  {
    id: "male-warm",
    label: "Daniel",
    description: "Warm male",
    gender: "male",
    predicate: (voice) =>
      voice.gender === "male" &&
      /daniel|fred|james|tom|carter/i.test(voice.label),
  },
  {
    id: "deep",
    label: "Deep",
    description: "Deep male",
    gender: "male",
    predicate: (voice) =>
      voice.gender === "male" &&
      /davis|brandon|brian|tony|fred|jeremy/i.test(voice.label),
  },
  {
    id: "bright",
    label: "Bright",
    description: "Bright female",
    gender: "female",
    predicate: (voice) =>
      voice.gender === "female" &&
      /ava|emma|natasha|nora|allison|kate/i.test(voice.label),
  },
];

function matchPersona(
  discovered: DiscoveredVoice[],
  personaId: string,
): DiscoveredVoice | undefined {
  const persona = voicePersonas.find((entry) => entry.id === personaId);
  if (!persona) return undefined;
  const matches = discovered.filter(persona.predicate);
  if (matches.length > 0) return matches[0];
  // Fallback: any voice with the right gender, otherwise the highest-ranked.
  return (
    discovered.find((voice) => voice.gender === persona.gender) ?? discovered[0]
  );
}
