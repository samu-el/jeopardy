import { baselineVoiceProfiles, type VoiceProfile } from "@/lib/foundation/game-contracts";

export interface SpeakRequest {
  text: string;
  voiceProfileId?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  onEnd?: () => void;
}

export interface VoiceAdapter {
  speak(request: SpeakRequest): void;
  cancel(): void;
  isSupported(): boolean;
  listVoices(): VoiceProfile[];
}

class BrowserVoiceAdapter implements VoiceAdapter {
  private utterance: SpeechSynthesisUtterance | undefined;

  isSupported() {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  listVoices() {
    return baselineVoiceProfiles;
  }

  speak(request: SpeakRequest) {
    if (!this.isSupported()) {
      request.onEnd?.();
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(request.text);
    utterance.rate = request.rate ?? 1;
    utterance.pitch = request.pitch ?? 1;
    utterance.volume = request.volume ?? 1;
    const voices = synth.getVoices();
    const profile = baselineVoiceProfiles.find((voice) => voice.id === request.voiceProfileId);
    if (profile) {
      const preferredName = preferredVoiceName(profile);
      const match = voices.find((voice) => {
        if (preferredName && voice.name.toLowerCase().includes(preferredName.toLowerCase())) {
          return true;
        }
        return voice.lang.startsWith(profile.locale.split("-")[0]);
      });
      if (match) {
        utterance.voice = match;
      }
    }
    utterance.onend = () => request.onEnd?.();
    utterance.onerror = () => request.onEnd?.();
    this.utterance = utterance;
    synth.speak(utterance);
  }

  cancel() {
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
    }
    this.utterance = undefined;
  }
}

class NoopVoiceAdapter implements VoiceAdapter {
  isSupported() {
    return false;
  }
  listVoices() {
    return baselineVoiceProfiles;
  }
  speak(request: SpeakRequest) {
    request.onEnd?.();
  }
  cancel() {}
}

function preferredVoiceName(profile: VoiceProfile) {
  switch (profile.id) {
    case "studio-neutral":
      return "Google";
    case "classic-host":
      return "Daniel";
    default:
      return undefined;
  }
}

export function createVoiceAdapter(): VoiceAdapter {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return new NoopVoiceAdapter();
  }
  return new BrowserVoiceAdapter();
}
