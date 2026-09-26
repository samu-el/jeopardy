import {
  baselineVoiceProfiles as legacyProfiles,
  type VoiceProfile,
} from "@/lib/ai/profiles";
import { getAudioMix } from "./audio-mix";

export interface SpeakRequest {
  text: string;
  voiceProfileId?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  /** Fires when this utterance actually begins — it may have been queued. */
  onStart?: () => void;
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

const femaleNames =
  /\b(aria|jenny|samantha|zira|karen|kate|allison|ava|moira|serena|veena|tessa|libby|sonia|emma|michelle|natasha|nora|olivia|nicole|susan|hazel|catherine|clara|jane|joanna|salli|kimberly|ivy|kendra|amy|emily|fiona|victoria|zoe|sara|nancy|heather|linda|elizabeth|monica|paulina|ana|aubrey|ashley|cora|elena|jessa|isla|maisie|abbie|bella|hollie|mia|molly|neerja|leah|luna|nova|shimmer)\b/;
const maleNames =
  /\b(guy|david|mark|alex|daniel|fred|tom|matthew|ryan|brian|james|sean|carter|andrew|christopher|eric|roger|steffan|davis|brandon|tony|jason|jacob|william|liam|george|oliver|arthur|aaron|gordon|lee|rishi|thomas|ralph|junior|albert|bruce|ethan|noah|elliot|kai|prabhat|wayne|mitchell|connor|duncan|luke|nathan|oscar|reed|evan|rocko|grandpa|onyx|fable)\b/;

/** Pure: which way a voice's name reads. Exported for tests. */
export function detectGender(name: string): DiscoveredVoice["gender"] {
  const lower = name.toLowerCase();
  // "Female" before "male": the word boundary keeps "female" out of \bmale\b.
  if (/\b(female|woman|girl)\b/.test(lower)) return "female";
  if (/\b(male|man|boy)\b/.test(lower)) return "male";
  if (femaleNames.test(lower)) return "female";
  if (maleNames.test(lower)) return "male";
  // Chrome's unnamed "Google US English" is a female voice.
  if (lower.trim() === "google us english") return "female";
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
  return discoverVoices(synth.getVoices());
}

/** Pure: English voices, best first. Exported for tests. */
export function discoverVoices(all: SpeechSynthesisVoice[]): DiscoveredVoice[] {
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
    utterance.volume = Math.max(0, Math.min(1, request.volume ?? getAudioMix().voice));

    const chosen = this.pickVoice(request.voiceProfileId);
    if (chosen) {
      utterance.voice = chosen.voice;
      utterance.lang = chosen.voice.lang;
    }

    utterance.onstart = () => request.onStart?.();
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
    return resolveVoice(this.discovered, requestedId).voice;
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
    request.onStart?.();
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

/** Stops whatever is being spoken — used when the microphone opens. */
export function cancelSpeech() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
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

/**
 * Which voice each persona speaks with on this machine. A persona only claims
 * a voice its description fits, and never one another persona already took,
 * so the menu never offers two names for the same voice.
 */
export function assignPersonas(discovered: DiscoveredVoice[]): Map<string, DiscoveredVoice> {
  const claimed = new Set<string>();
  const assigned = new Map<string, DiscoveredVoice>();
  for (const persona of voicePersonas) {
    const match = discovered.find((voice) => persona.predicate(voice) && !claimed.has(voice.id));
    if (!match) continue;
    claimed.add(match.id);
    assigned.set(persona.id, match);
  }
  return assigned;
}

export interface ResolvedVoice {
  voice: DiscoveredVoice | undefined;
  /** False when the persona or voice asked for isn't on this machine. */
  exact: boolean;
  persona?: VoicePersona;
}

export const browserDefaultVoiceId = "browser-default";

/**
 * The voice a stored id speaks with. When a persona has no voice of its own
 * here, it falls back to the best voice of the right gender — never to a
 * voice of the other gender while one of the right gender exists.
 */
export function resolveVoice(
  discovered: DiscoveredVoice[],
  requestedId: string | undefined,
): ResolvedVoice {
  if (!requestedId || requestedId === browserDefaultVoiceId) {
    return { voice: discovered[0], exact: true };
  }
  if (requestedId.startsWith("browser:")) {
    const voice = discovered.find((entry) => entry.id === requestedId);
    return { voice: voice ?? discovered[0], exact: Boolean(voice) };
  }
  const persona = voicePersonas.find((entry) => entry.id === requestedId);
  if (!persona) return { voice: discovered[0], exact: false };
  const assigned = assignPersonas(discovered).get(persona.id);
  if (assigned) return { voice: assigned, exact: true, persona };
  // Best of the right gender (the list is already ranked), then anyone.
  const fallback =
    discovered.find((voice) => voice.gender === persona.gender) ??
    discovered.find((voice) => voice.gender === "neutral") ??
    discovered[0];
  return { voice: fallback, exact: false, persona };
}

export interface VoiceOption {
  id: string;
  label: string;
  /** Secondary line: the voice it resolves to, or why it can't. */
  sub: string;
  quality?: DiscoveredVoice["quality"];
  unavailable?: boolean;
}

/**
 * The voice menu. Always starts with "Browser default", names the voice each
 * choice actually uses, and always contains the selected id — a stored
 * persona this machine can't voice shows as "Aria (unavailable)" with the
 * voice it falls back to, instead of an out-of-range select value.
 */
export function buildVoiceOptions(
  discovered: DiscoveredVoice[],
  selectedId?: string,
): VoiceOption[] {
  const assigned = assignPersonas(discovered);
  const claimed = new Set([...assigned.values()].map((voice) => voice.id));
  const options: VoiceOption[] = [
    {
      id: browserDefaultVoiceId,
      label: "Browser default",
      sub: discovered[0]?.label ?? "System voice",
      quality: discovered[0]?.quality,
    },
  ];
  for (const persona of voicePersonas) {
    const voice = assigned.get(persona.id);
    if (voice) {
      options.push({ id: persona.id, label: persona.label, sub: voice.label, quality: voice.quality });
    }
  }
  for (const voice of discovered) {
    if (claimed.has(voice.id)) continue;
    options.push({ id: voice.id, label: voice.label, sub: voice.locale, quality: voice.quality });
  }
  if (selectedId && !options.some((option) => option.id === selectedId)) {
    const resolved = resolveVoice(discovered, selectedId);
    const label = resolved.persona?.label ?? selectedId.replace(/^browser:/, "");
    options.push({
      id: selectedId,
      label: `${label} (unavailable)`,
      sub: resolved.voice ? `using ${resolved.voice.label}` : "no voices installed",
      unavailable: true,
    });
  }
  return options;
}

/** The narrator's reading pace: a touch slower than the engine default. */
export const baseReadoutRate = 0.92;
export const speechRateRange = { min: 0.8, max: 1.2 } as const;

/**
 * The utterance rate for a player's reading-speed setting (1 = normal).
 * Everything that speaks for the game — readout, host, preview — uses this,
 * so the preview sounds like the game.
 */
export function readoutRate(speechRate: number | undefined = 1): number {
  const setting = Number.isFinite(speechRate) ? speechRate : 1;
  const clamped = Math.max(speechRateRange.min, Math.min(speechRateRange.max, setting));
  return Number((baseReadoutRate * clamped).toFixed(3));
}

export const voicePreviewText = "This is your Jeopardy host. Welcome to the game.";

/** Plays the preview line, cutting off any earlier preview instead of queueing. */
export function previewVoice(
  adapter: VoiceAdapter | null | undefined,
  voiceProfileId: string,
  speechRate?: number,
) {
  adapter?.speak({
    text: voicePreviewText,
    voiceProfileId,
    rate: readoutRate(speechRate),
    interrupt: true,
  });
}
