/**
 * Keeps the screen awake while a game is live.
 *
 * Phones auto-lock during long readouts, spectating and the Final Jeopardy
 * think time, and a locked phone drops its socket. The Screen Wake Lock API
 * holds the screen on, but the browser releases the lock whenever the page is
 * hidden, so it has to be re-requested on `visibilitychange`.
 *
 * Framework-free so it can be tested with fakes; `useWakeLock` in
 * `src/components/use-wake-lock.ts` is the React binding.
 */

export interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: "release", listener: () => void) => void;
}

export interface WakeLockEnvironment {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
  isVisible: () => boolean;
  onVisibilityChange: (listener: () => void) => () => void;
}

export interface WakeLockController {
  /** Hold the lock while `active` is true (re-acquired after the tab returns). */
  setActive: (active: boolean) => void;
  /** Release everything and stop listening. */
  dispose: () => void;
  /** Whether a lock is currently held (for tests and diagnostics). */
  isHeld: () => boolean;
}

export function createWakeLockController(env: WakeLockEnvironment): WakeLockController {
  let active = false;
  let disposed = false;
  let sentinel: WakeLockSentinelLike | null = null;
  let pending = false;

  async function acquire() {
    if (!env.wakeLock || pending || disposed) return;
    if (sentinel && !sentinel.released) return;
    if (!env.isVisible()) return;
    pending = true;
    try {
      const next = await env.wakeLock.request("screen");
      if (!active || disposed) {
        await next.release().catch(() => undefined);
        return;
      }
      sentinel = next;
      next.addEventListener?.("release", () => {
        if (sentinel === next) sentinel = null;
      });
    } catch {
      // Denied (battery saver, no user activation yet, unsupported): best effort only.
    } finally {
      pending = false;
    }
  }

  function release() {
    const held = sentinel;
    sentinel = null;
    if (held && !held.released) void held.release().catch(() => undefined);
  }

  const stopListening = env.onVisibilityChange(() => {
    if (active && env.isVisible()) void acquire();
  });

  return {
    setActive(next) {
      if (disposed) return;
      active = next;
      if (active) void acquire();
      else release();
    },
    dispose() {
      disposed = true;
      active = false;
      stopListening();
      release();
    },
    isHeld: () => sentinel !== null && !sentinel.released,
  };
}

/** The real browser environment, or `null` where there is no document. */
export function browserWakeLockEnvironment(): WakeLockEnvironment | null {
  if (typeof document === "undefined" || typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & { wakeLock?: WakeLockEnvironment["wakeLock"] };
  return {
    wakeLock: nav.wakeLock,
    isVisible: () => document.visibilityState === "visible",
    onVisibilityChange: (listener) => {
      document.addEventListener("visibilitychange", listener);
      return () => document.removeEventListener("visibilitychange", listener);
    },
  };
}
