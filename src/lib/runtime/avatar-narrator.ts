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
    if (!cue.text.trim()) {
      cue.speak = false;
      return cue;
    }
    if (!this.config.getSoundEnabled()) {
      cue.speak = false;
      return cue;
    }
    const adapter = this.config.voice;
    if (!adapter) return cue;
    const voiceId = this.config.getVoiceProfileId() || profile.voiceProfileId;
    adapter.speak({
      text: cue.text,
      voiceProfileId: voiceId,
      rate: 0.92,
      pitch: profile.persona === "dry-commentator" ? 0.9 : 1,
      // Queue utterances naturally so picks ("Category, for 200") finish
      // before the clue text reads. Interrupting would drop the clue text.
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
