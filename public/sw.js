/*
 * Minimal service worker: an offline page for navigations, and a cache for
 * the build's hashed static files. Deliberately small.
 *
 * - Navigations are network-first: a fresh page whenever the network
 *   answers, `/offline.html` only when it doesn't.
 * - `/_next/static/*` files are content-hashed and immutable, so they are
 *   served cache-first once seen.
 * - Nothing else is touched: no `/api`, no websockets / rooms, no
 *   cross-origin requests, nothing but GET. Game state is never cached.
 *
 * Bump VERSION to drop every old cache on the next activation.
 */
const VERSION = "v1";
const SHELL_CACHE = `jeopardy-shell-${VERSION}`;
const STATIC_CACHE = `jeopardy-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icon.svg", "/icon-192.png", "/manifest.webmanifest"];
const STATIC_LIMIT = 120;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("jeopardy-") && key !== SHELL_CACHE && key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function trimStatic() {
  const cache = await caches.open(STATIC_CACHE);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - STATIC_LIMIT)).map((key) => cache.delete(key)));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (request.headers.get("upgrade") === "websocket") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        return cached || new Response("You're offline.", { status: 503, headers: { "Content-Type": "text/plain" } });
      }),
    );
    return;
  }

  if (PRECACHE.includes(url.pathname)) {
    // The offline page's own assets: fresh when online, cached when not.
    event.respondWith(fetch(request).catch(async () => (await caches.match(request)) || Response.error()));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone());
          void trimStatic();
        }
        return response;
      }),
    );
  }
});
