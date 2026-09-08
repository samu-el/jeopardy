import { generateGameId } from "@/lib/data/published-game";
import { normalizeRoomCode } from "@/lib/realtime/room-code";
import { socketPath } from "@/lib/realtime/socket-path";

export { RoomDurableObject } from "./room-object";
export { CustomGameObject } from "./game-object";

export interface Env {
  ROOMS: DurableObjectNamespace;
  GAMES: DurableObjectNamespace;
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

    // Custom games: published from the builder, opened from a share link.
    const game = url.pathname.match(/^\/games\/?([A-Za-z0-9]*)$/);
    if (game) {
      if (request.method === "OPTIONS") {
        return cors(new Response(null, { status: 204 }), request);
      }
      return cors(await routeGame(request, env, game[1] ?? ""), request);
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

/**
 * `POST /games` publishes a new game under a fresh id; `GET|PUT /games/<id>`
 * reads or replaces one. The id is minted here rather than accepted from the
 * client, so nobody can choose where their game lands — or overwrite
 * somebody else's by guessing.
 */
async function routeGame(request: Request, env: Env, id: string): Promise<Response> {
  if (request.method === "POST" && !id) {
    const created = generateGameId();
    const stub = env.GAMES.get(env.GAMES.idFromName(created));
    return stub.fetch(
      new Request(`https://games.invalid/?id=${created}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: await request.text(),
      }),
    );
  }
  if (!id) return Response.json({ error: "not-found" }, { status: 404 });

  const stub = env.GAMES.get(env.GAMES.idFromName(id));
  if (request.method === "GET") {
    return stub.fetch(new Request(`https://games.invalid/?id=${id}`));
  }
  if (request.method === "PUT") {
    return stub.fetch(
      new Request(`https://games.invalid/?id=${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: await request.text(),
      }),
    );
  }
  return new Response("Method not allowed", { status: 405 });
}

/** Lets the app on its own origin read the lookup answer. */
function cors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", request.headers.get("Origin") ?? "*");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "content-type");
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
