import {
  baselineAvatarHostProfiles,
  baselineVoiceProfiles,
  type AvatarHostMode,
  type AvatarHostProfile,
} from "@/lib/foundation/game-contracts";
import {
  generateAvatarHostCue,
  type AvatarHostCue,
  type AvatarHostInput,
  type VoiceAdapter,
} from "@/lib/ai";

export interface AvatarNarratorConfig {
  voice: VoiceAdapter | null;
  getProfile: () => AvatarHostProfile;
  getMode: () => AvatarHostMode;
  getVoiceProfileId: () => string;
  getSoundEnabled: () => boolean;
}

export class AvatarNarrator {
  private readonly config: AvatarNarratorConfig;
  private lastCueByType: Partial<Record<AvatarHostCue["type"], string>> = {};
  private lastSpeakAt = 0;

  constructor(config: AvatarNarratorConfig) {
    this.config = config;
  }

  emit(input: AvatarHostInput): AvatarHostCue {
    const profile = input.profile ?? this.config.getProfile();
    const mode = input.mode ?? this.config.getMode();
    const cue = generateAvatarHostCue({ ...input, profile, mode });
    if (mode === "off") {
      cue.speak = false;
      return cue;
    }
    if (cue.text === this.lastCueByType[cue.type]) {
      cue.speak = false;
      return cue;
    }
    this.lastCueByType[cue.type] = cue.text;
    if (!cue.speak) return cue;
    if (!this.config.getSoundEnabled()) {
      cue.speak = false;
      return cue;
    }
    const adapter = this.config.voice;
    if (!adapter) return cue;
    const now = Date.now();
    if (now - this.lastSpeakAt < 350) return cue;
    this.lastSpeakAt = now;
    // Always use the user-selected voice so every spoken line (intro,
    // categories, clue text, judging reactions) sounds like the same host.
    // Otherwise the system mixes two different system voices and they
    // overlap when fired close together.
    const voiceId = this.config.getVoiceProfileId() || profile.voiceProfileId;
    adapter.speak({
      text: cue.text,
      voiceProfileId: voiceId,
      rate: 0.97,
      pitch: profile.persona === "dry-commentator" ? 0.92 : 1,
      // Let utterances queue naturally; one continuous host voice.
      interrupt: false,
    });
    return cue;
  }

  cancel() {
    this.config.voice?.cancel();
  }
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
