import {
  baselineAvatarHostProfiles,
  baselineVoiceProfiles,
  type AvatarHostMode,
  type AvatarHostProfile,
} from "@/lib/ai/profiles";
import {
  generateAvatarHostCue,
  readoutRate,
  type AvatarHostCue,
  type AvatarHostCueType,
  type AvatarHostInput,
  type VoiceAdapter,
} from "@/lib/ai";
import type { GameEvent } from "@/lib/game";

export interface AvatarNarratorConfig {
  voice: VoiceAdapter | null;
  getProfile: () => AvatarHostProfile;
  getMode: () => AvatarHostMode;
  getVoiceProfileId: () => string;
  getSoundEnabled: () => boolean;
  /** The player's reading-speed setting (1 = normal). Defaults to 1. */
  getSpeechRate?: () => number | undefined;
  /**
   * Fires when a cue finishes speaking (TTS onend) or, when sound is off
   * or unavailable, immediately after the cue is generated. Use this to
   * react to readout completion without estimating from text length.
   */
  onCueSpoken?: (cue: AvatarHostCue) => void;
  /**
   * Fires when a cue actually starts speaking. Cues queue, so this can be a
   * long way after `emit` — which is exactly why the buzzer can't be timed
   * from the moment the clue was picked.
   */
  onCueStarted?: (cue: AvatarHostCue) => void;
  /**
   * Fires the moment a cue is handed to the voice, before it has its turn.
   * A cue that is still waiting behind another line has not been read, so
   * anything gated on the readout has to start holding here rather than at
   * `onCueStarted`.
   */
  onCueQueued?: (cue: AvatarHostCue) => void;
  /** Fires when the voice starts talking and when it falls silent (or is cancelled). */
  onSpeakingChange?: (speaking: boolean) => void;
}

export interface EmitOptions {
  /** Drop whatever is still being said before this cue is queued. */
  interruptQueue?: boolean;
  /**
   * Identity of the game event behind this cue. A cue whose event was
   * already narrated is not spoken again — so replaying an event batch never
   * doubles the voice, while a real repeat ("Incorrect." for a second
   * player) always speaks.
   */
  eventId?: string;
}

/**
 * The clue's own lines. These are read whenever sound is on — they are the
 * game, not the host's personality — so "Host: Off" silences commentary but
 * still reads the board aloud, as the landing page promises.
 */
const readoutCues = new Set<AvatarHostCueType>(["clue-selected", "clue-readout"]);

/** How many narrated event ids are remembered for de-duplication. */
const rememberedEvents = 200;

export class AvatarNarrator {
  private readonly config: AvatarNarratorConfig;
  private readonly narratedEvents = new Set<string>();
  /** Cues handed to the voice that haven't finished (or been cancelled). */
  private outstanding = new Set<AvatarHostCueType>();
  /**
   * Bumped by `cancel()`. A cancelled utterance still fires `onend`, and a
   * dropped clue readout must not be reported as read — least of all against
   * whichever clue is on screen by then.
   */
  private generation = 0;

  constructor(config: AvatarNarratorConfig) {
    this.config = config;
  }

  /**
   * `interruptQueue` is applied only once the cue has survived every "should
   * this speak at all" check, so replaying the same event never cuts the
   * voice off.
   */
  emit(input: AvatarHostInput, options: EmitOptions = {}): AvatarHostCue {
    const profile = input.profile ?? this.config.getProfile();
    const hostMode = input.mode ?? this.config.getMode();
    const readout = readoutCues.has(input.type);
    const mode: AvatarHostMode = hostMode === "off" && readout ? "voice-only" : hostMode;
    const cue = generateAvatarHostCue({ ...input, profile, mode });
    if (mode === "off") {
      cue.speak = false;
      return cue;
    }
    if (options.eventId !== undefined) {
      if (this.narratedEvents.has(options.eventId)) {
        cue.speak = false;
        return cue;
      }
      this.rememberEvent(options.eventId);
    }
    if (!cue.speak) return cue;
    if (!cue.text.trim()) {
      cue.speak = false;
      return cue;
    }
    if (!this.config.getSoundEnabled()) {
      // Sound off → no TTS event will ever fire. Leave the engine's
      // time-based fallback in charge so silent readers get time to read.
      cue.speak = false;
      return cue;
    }
    const adapter = this.config.voice;
    if (!adapter) return cue;
    const voiceId = this.config.getVoiceProfileId() || profile.voiceProfileId;
    if (options.interruptQueue) {
      this.cancel();
    }
    this.config.onCueQueued?.(cue);
    const generation = this.generation;
    this.outstanding.add(cue.type);
    adapter.speak({
      text: cue.text,
      voiceProfileId: voiceId,
      rate: readoutRate(this.config.getSpeechRate?.()),
      pitch: profile.persona === "dry-commentator" ? 0.9 : 1,
      // Queue utterances naturally so picks ("Category, for 200") finish
      // before the clue text reads. Interrupting would drop the clue text.
      interrupt: false,
      onStart: () => {
        if (generation !== this.generation) return;
        this.config.onSpeakingChange?.(true);
        this.config.onCueStarted?.(cue);
      },
      onEnd: () => {
        if (generation !== this.generation) return;
        this.outstanding.delete(cue.type);
        if (this.outstanding.size === 0) this.config.onSpeakingChange?.(false);
        this.config.onCueSpoken?.(cue);
      },
    });
    return cue;
  }

  /** Stops everything being said or queued, now. */
  cancel() {
    this.generation += 1;
    this.outstanding = new Set();
    this.config.voice?.cancel();
    this.config.onSpeakingChange?.(false);
  }

  /**
   * Stops the voice only if one of these cues is still being said or waiting
   * — e.g. the clue's readout once the clue has closed. Returns whether it
   * cancelled anything.
   */
  cancelIfSpeaking(types: AvatarHostCueType[]): boolean {
    if (!types.some((type) => this.outstanding.has(type))) return false;
    this.cancel();
    return true;
  }

  /** True while a cue of one of these types is queued or speaking. */
  isSpeaking(types?: AvatarHostCueType[]): boolean {
    if (!types) return this.outstanding.size > 0;
    return types.some((type) => this.outstanding.has(type));
  }

  /** Forget narrated events — a new game starts from a clean slate. */
  resetEvents() {
    this.narratedEvents.clear();
  }

  private rememberEvent(id: string) {
    this.narratedEvents.add(id);
    if (this.narratedEvents.size > rememberedEvents) {
      const oldest = this.narratedEvents.values().next().value;
      if (oldest !== undefined) this.narratedEvents.delete(oldest);
    }
  }
}

/**
 * A stable identity for a game event, for de-duplication. Events carry no id
 * of their own, but every field that tells two real events apart (clue,
 * player, verdict, round) is part of the event — so the same event replayed
 * gives the same key, and two different events give different keys.
 */
export function gameEventKey(event: GameEvent): string {
  const record = event as unknown as Record<string, unknown>;
  const parts = Object.keys(record)
    .sort()
    .map((key) => `${key}=${String(record[key])}`);
  return parts.join("|");
}

/**
 * A ceiling on how long this utterance can run, used to hold the buzzer while
 * it plays. Generous on purpose — `onend` trims it to the real moment, and a
 * buzzer that opens a beat late is far better than one that opens mid-clue.
 */
export function spokenDurationEstimateMs(text: string, speechRate = 1): number {
  // ~11 characters a second at the normal reading rate, plus half again for
  // pauses and slower voices. A slower reading speed stretches it. The floor
  // covers the gap between one queued cue ending and the next one starting.
  const pace = readoutRate(speechRate) / readoutRate(1);
  return Math.min(60_000, Math.round(((text.length / 11) * 1_000 * 1.5) / pace) + 1_500);
}

export function findAvatarProfile(id: string | undefined): AvatarHostProfile {
  return (
    baselineAvatarHostProfiles.find((profile) => profile.id === id) ??
    baselineAvatarHostProfiles[0]
  );
}

export function findVoiceProfileLabel(id: string | undefined): string {
  return baselineVoiceProfiles.find((voice) => voice.id === id)?.label ?? id ?? "";
}
