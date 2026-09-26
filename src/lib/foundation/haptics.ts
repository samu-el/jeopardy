/**
 * Haptic confirmation for the moments a player needs to *feel*: the buzz
 * landed, they were locked out, the ruling came back.
 *
 * `navigator.vibrate` exists on Android Chrome and is a no-op or missing
 * elsewhere (iOS Safari has none), so every call is a best-effort hint and
 * never throws. Callers pass `enabled` — wire it to the reduced-motion /
 * haptics preference so a viewer who asked for less stimulation gets none.
 *
 *   haptic("buzz", { enabled: !preferences.reducedMotion });
 */

export type HapticKind = "buzz" | "lockout" | "correct" | "incorrect" | "tap";

/** Vibration patterns in milliseconds (on, off, on, ...). */
export const hapticPatterns: Record<HapticKind, number | number[]> = {
  tap: 10,
  buzz: 15,
  lockout: [40, 60, 40],
  correct: [20, 40, 20],
  incorrect: 120,
};

interface VibratingNavigator {
  vibrate?: (pattern: number | number[]) => boolean;
}

export interface HapticOptions {
  /** Off when false. Defaults to true. */
  enabled?: boolean;
  /** Injected for tests; defaults to the global `navigator`. */
  navigator?: VibratingNavigator;
}

/** Fires a haptic pulse if the device supports it. Returns whether one was requested. */
export function haptic(kind: HapticKind, options: HapticOptions = {}): boolean {
  if (options.enabled === false) return false;
  const nav: VibratingNavigator | undefined =
    options.navigator ?? (typeof navigator === "undefined" ? undefined : (navigator as VibratingNavigator));
  if (!nav || typeof nav.vibrate !== "function") return false;
  try {
    return nav.vibrate(hapticPatterns[kind]);
  } catch {
    return false;
  }
}
