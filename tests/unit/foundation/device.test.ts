import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { haptic, hapticPatterns } from "@/lib/foundation/haptics";
import { resolveSiteUrl, siteMetadataBase } from "@/lib/foundation/site";
import { createWakeLockController, type WakeLockEnvironment } from "@/lib/foundation/wake-lock";

describe("haptic", () => {
  it("vibrates with the kind's pattern", () => {
    const vibrate = vi.fn(() => true);
    expect(haptic("lockout", { navigator: { vibrate } })).toBe(true);
    expect(vibrate).toHaveBeenCalledWith(hapticPatterns.lockout);
  });

  it("does nothing when disabled or unsupported, and never throws", () => {
    const vibrate = vi.fn(() => true);
    expect(haptic("buzz", { enabled: false, navigator: { vibrate } })).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
    expect(haptic("buzz", { navigator: {} })).toBe(false);
    const throwing = () => {
      throw new Error("blocked");
    };
    expect(haptic("buzz", { navigator: { vibrate: throwing } })).toBe(false);
  });
});

function fakeEnvironment() {
  let visible = true;
  const listeners = new Set<() => void>();
  const sentinels: { released: boolean; release: () => Promise<void>; fire: () => void }[] = [];
  const request = vi.fn(async () => {
    let onRelease: (() => void) | undefined;
    const sentinel = {
      released: false,
      release: async () => {
        sentinel.released = true;
        onRelease?.();
      },
      addEventListener: (_: "release", listener: () => void) => {
        onRelease = listener;
      },
      // What the browser does when the tab is hidden.
      fire: () => {
        sentinel.released = true;
        onRelease?.();
      },
    };
    sentinels.push(sentinel);
    return sentinel;
  });
  const env: WakeLockEnvironment = {
    wakeLock: { request },
    isVisible: () => visible,
    onVisibilityChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    env,
    request,
    sentinels,
    setVisible(next: boolean) {
      visible = next;
      for (const listener of listeners) listener();
    },
    listenerCount: () => listeners.size,
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("wake lock controller", () => {
  it("acquires when active and releases when inactive", async () => {
    const fake = fakeEnvironment();
    const controller = createWakeLockController(fake.env);
    controller.setActive(true);
    await flush();
    expect(fake.request).toHaveBeenCalledTimes(1);
    expect(controller.isHeld()).toBe(true);
    controller.setActive(false);
    await flush();
    expect(controller.isHeld()).toBe(false);
    expect(fake.sentinels[0].released).toBe(true);
  });

  it("re-acquires after the tab becomes visible again", async () => {
    const fake = fakeEnvironment();
    const controller = createWakeLockController(fake.env);
    controller.setActive(true);
    await flush();
    fake.sentinels[0].fire();
    fake.setVisible(false);
    await flush();
    expect(fake.request).toHaveBeenCalledTimes(1);
    fake.setVisible(true);
    await flush();
    expect(fake.request).toHaveBeenCalledTimes(2);
    expect(controller.isHeld()).toBe(true);
  });

  it("does not request while hidden, nor after dispose", async () => {
    const fake = fakeEnvironment();
    const controller = createWakeLockController(fake.env);
    fake.setVisible(false);
    controller.setActive(true);
    await flush();
    expect(fake.request).not.toHaveBeenCalled();
    controller.dispose();
    expect(fake.listenerCount()).toBe(0);
    fake.setVisible(true);
    await flush();
    expect(fake.request).not.toHaveBeenCalled();
  });

  it("swallows a denied request", async () => {
    const env: WakeLockEnvironment = {
      wakeLock: { request: () => Promise.reject(new Error("NotAllowedError")) },
      isVisible: () => true,
      onVisibilityChange: () => () => undefined,
    };
    const controller = createWakeLockController(env);
    controller.setActive(true);
    await flush();
    expect(controller.isHeld()).toBe(false);
  });
});

describe("site url", () => {
  it("prefers the explicit env, then Vercel, then localhost", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://play.example.com/" })).toBe("https://play.example.com");
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "play.example.com" })).toBe("https://play.example.com");
    expect(
      resolveSiteUrl({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "jeopardy.vercel.app" }),
    ).toBe("https://jeopardy.vercel.app");
    expect(resolveSiteUrl({ VERCEL_ENV: "preview", VERCEL_URL: "jeopardy-abc.vercel.app" })).toBe(
      "https://jeopardy-abc.vercel.app",
    );
    expect(resolveSiteUrl({})).toBe("http://localhost:3000");
  });

  it("never throws for a bad value", () => {
    expect(siteMetadataBase({ NEXT_PUBLIC_SITE_URL: "http://" }).href).toBe("http://localhost:3000/");
  });
});

describe("service worker", () => {
  const source = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");

  it("never intercepts the API, websockets, other origins or non-GET requests", () => {
    expect(source).toContain('url.pathname.startsWith("/api/")');
    expect(source).toContain('request.headers.get("upgrade") === "websocket"');
    expect(source).toContain("url.origin !== self.location.origin");
    expect(source).toContain('request.method !== "GET"');
  });

  it("serves navigations network-first with an offline fallback", () => {
    expect(source).toMatch(/request\.mode === "navigate"[\s\S]*fetch\(request\)\.catch/);
    expect(source).toContain('"/offline.html"');
  });
});
