import { normalizeRoomCode } from "@/lib/realtime/room-code";
import { socketPath } from "@/lib/realtime/socket-path";

export { RoomDurableObject } from "./room-object";

export interface Env {
  ROOMS: DurableObjectNamespace;
  /**
   * Comma-separated origins allowed to open rooms. Unset means any origin,
   * which is what `wrangler dev` and the e2e suite run with.
   */
  ALLOWED_ORIGINS?: string;
}

/**
 * The rooms edge. It does one thing: turn a room code into the Durable Object
 * that owns that room, and hand the socket over.
 *
 * The app itself is served from Vercel; only this needs somewhere that can
 * hold a connection open, which a serverless function cannot.
 */
const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "jeopardy-rooms" });
    }
    if (!originAllowed(request, env)) {
      return new Response("Origin not allowed", { status: 403 });
    }

    // Does this code belong to a room anyone has opened? The app asks before
    // it moves a player onto the board, so a typo is a message rather than a
    // half-joined screen.
    const lookup = url.pathname.match(/^\/room\/([^/]+)$/);
    if (lookup) {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), request);
      const code = normalizeRoomCode(decodeURIComponent(lookup[1]));
      if (!code) return cors(Response.json({ exists: false }, { status: 400 }), request);
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      const answer = await stub.fetch(new Request(`https://rooms.invalid/exists`));
      return cors(
        Response.json({ id: code, exists: (await answer.json<{ exists: boolean }>()).exists }),
        request,
      );
    }

    if (url.pathname !== socketPath) {
      return new Response("Not found", { status: 404 });
    }

    // The code has to be on the URL: the object is chosen before the first
    // frame is read, so it cannot come from the join frame.
    const code = normalizeRoomCode(url.searchParams.get("room") ?? "");
    if (!code) {
      return new Response("A room code is required.", { status: 400 });
    }

    const id = env.ROOMS.idFromName(code);
    return env.ROOMS.get(id).fetch(request);
  },
};

export default worker;

/** Lets the app on its own origin read the lookup answer. */
function cors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", request.headers.get("Origin") ?? "*");
  headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  headers.set("Vary", "Origin");
  return new Response(response.body, { status: response.status, headers });
}

function originAllowed(request: Request, env: Env): boolean {
  const allowed = env.ALLOWED_ORIGINS?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!allowed || allowed.length === 0) return true;
  const origin = request.headers.get("Origin");
  // A WebSocket from a browser always carries an Origin. Anything without one
  // isn't a browser, and is held to the same list rather than waved through.
  return Boolean(origin && allowed.includes(origin));
}
