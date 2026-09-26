import { primeAudio } from "./sfx";
import { primeSpeech } from "./voice";

/**
 * Browsers only let a page make sound after a user gesture, and iOS also
 * routes Web Audio through the ringer unless the page asks for playback.
 * `unlockAudio()` does everything a gesture can unlock in one call: resumes
 * the Web Audio context (with a silent frame for iOS), wakes speech
 * synthesis, and marks the session as media playback where supported.
 *
 * Safe to call repeatedly and from any click, tap or key handler.
 */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  setPlaybackAudioSession();
  primeAudio();
  primeSpeech();
}

/**
 * `navigator.audioSession` (Safari 16.4+): "playback" keeps the host's voice
 * and the stings audible with the ring/silent switch on, like any media app.
 */
export function setPlaybackAudioSession(nav: Navigator | undefined = globalNavigator()): boolean {
  const session = (nav as (Navigator & { audioSession?: { type: string } }) | undefined)
    ?.audioSession;
  if (!session) return false;
  try {
    if (session.type !== "playback") session.type = "playback";
    return true;
  } catch {
    return false;
  }
}

function globalNavigator(): Navigator | undefined {
  return typeof navigator === "undefined" ? undefined : navigator;
}

const unlockEvents = ["pointerdown", "keydown", "touchend"] as const;

/**
 * Unlocks audio on the first gesture anywhere on the page, then gets out of
 * the way. Returns a function that removes the listeners early.
 */
export function installAudioUnlock(target?: Pick<Document, "addEventListener" | "removeEventListener">) {
  const host = target ?? (typeof document === "undefined" ? undefined : document);
  if (!host) return () => {};
  const handler = () => {
    unlockAudio();
    remove();
  };
  const remove = () => {
    for (const type of unlockEvents) host.removeEventListener(type, handler, true);
  };
  for (const type of unlockEvents) host.addEventListener(type, handler, true);
  return remove;
}
