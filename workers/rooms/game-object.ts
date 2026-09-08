import {
  checkPublishedGame,
  publishedGameVersion,
  type PublishedGame,
} from "@/lib/data/published-game";

const gameKey = "game";
const tokenKey = "editToken";

interface StoredGame {
  game: PublishedGame;
  /** Held by whoever published it, so only they can replace it. */
  editToken: string;
}

/**
 * One Durable Object per published custom game.
 *
 * A game is small and read far more often than written, so the object exists
 * to hold one value and hand it back. Keying by the game's own id means the
 * share link resolves straight to the object that owns it, with no index to
 * keep in step.
 */
export class CustomGameObject implements DurableObject {
  private readonly ctx: DurableObjectState;

  constructor(ctx: DurableObjectState) {
    this.ctx = ctx;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET") {
      const stored = await this.ctx.storage.get<StoredGame>(gameKey);
      if (!stored || stored.game?.version !== publishedGameVersion) {
        return Response.json({ error: "not-found" }, { status: 404 });
      }
      return Response.json({ game: stored.game });
    }

    if (request.method === "PUT") {
      const id = url.searchParams.get("id") ?? "";
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "invalid-json" }, { status: 400 });
      }
      if (!isRecord(body)) {
        return Response.json({ error: "invalid-body" }, { status: 400 });
      }

      const checked = checkPublishedGame({ ...body.game as object, id });
      if (!checked.ok || !checked.game) {
        return Response.json({ error: "invalid-game", problems: checked.problems }, {
          status: 422,
        });
      }

      const existing = await this.ctx.storage.get<StoredGame>(gameKey);
      if (existing) {
        // Replacing a game needs the token handed out when it was published.
        // Without this a share link would double as an edit link.
        const offered = typeof body.editToken === "string" ? body.editToken : "";
        if (!offered || offered !== existing.editToken) {
          return Response.json({ error: "not-yours" }, { status: 403 });
        }
        const game: PublishedGame = {
          ...checked.game,
          createdAt: existing.game.createdAt,
        };
        await this.ctx.storage.put(gameKey, { game, editToken: existing.editToken });
        return Response.json({ game, editToken: existing.editToken });
      }

      const editToken = crypto.randomUUID();
      await this.ctx.storage.put(gameKey, { game: checked.game, editToken });
      await this.ctx.storage.put(tokenKey, editToken);
      return Response.json({ game: checked.game, editToken }, { status: 201 });
    }

    return new Response("Method not allowed", { status: 405 });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
