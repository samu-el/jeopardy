import { RoomHost } from "@/lib/realtime/room-host";
import { RoomSession } from "@/lib/realtime/room-session";
import { isUsableSnapshot, type RoomSnapshot } from "@/lib/realtime/room-store";
import { encodeFrame } from "@/lib/realtime/ws-protocol";

const snapshotKey = "snapshot";
/** Set the first time a room is opened, so a wrong code can't join a blank room. */
const createdKey = "created";

/**
 * One Durable Object per room code: the room *is* the object.
 *
 * That replaces three things the Node build needed — the process-wide room
 * registry, the Redis store, and the idle-eviction sweep. Cloudflare routes
 * every client with the same code to the same instance, storage travels with
 * it, and an object nobody is connected to is evicted for free.
 */
export class RoomDurableObject implements DurableObject {
  private readonly ctx: DurableObjectState;
  private host: RoomHost | undefined;
  private readonly sessions = new Map<WebSocket, RoomSession>();

  constructor(ctx: DurableObjectState) {
    this.ctx = ctx;
  }

  async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname === "/exists") {
      // Asked without opening anything: a room exists once someone has
      // hosted it, and keeps existing while its snapshot is in storage.
      const created = await this.ctx.storage.get<boolean>(createdKey);
      return Response.json({ exists: Boolean(created) || Boolean(this.host) });
    }
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket upgrade.", { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const session = new RoomSession({
      connectionId: crypto.randomUUID(),
      resolveRoom: (_roomId, create) => this.ensureRoom(create),
      send: (frame) => {
        try {
          server.send(encodeFrame(frame));
        } catch {
          // The socket closed under us; the close handler does the cleanup.
        }
      },
    });
    this.sessions.set(server, session);

    server.addEventListener("message", (event: MessageEvent) => {
      const raw = typeof event.data === "string" ? event.data : "";
      if (!raw) return;
      void session.receive(raw).catch((error) => {
        console.warn("[rooms] frame failed:", error);
      });
    });
    const drop = () => this.dropSession(server);
    server.addEventListener("close", drop);
    server.addEventListener("error", drop);

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Brings the room into memory: from storage if it has been played before,
   * fresh if this is the host opening it. `create` is false for everyone
   * joining by code, so a typo lands on "that room does not exist" instead of
   * quietly opening an empty board.
   */
  private async ensureRoom(create: boolean): Promise<RoomHost | undefined> {
    if (this.host && !this.host.isDestroyed) return this.host;

    const stored = await this.ctx.storage.get<RoomSnapshot>(snapshotKey);
    const restoreFrom = isUsableSnapshot(stored) ? stored : undefined;
    if (!restoreFrom) {
      const created = await this.ctx.storage.get<boolean>(createdKey);
      if (!created && !create) return undefined;
    }

    const roomId = this.ctx.id.name ?? restoreFrom?.roomId ?? "ROOM";
    const host = new RoomHost({
      roomId,
      restoreFrom,
      onDirty: (dirty) => this.persist(dirty),
    }).start();
    this.host = host;
    if (!restoreFrom) {
      // Written immediately: a room that exists must survive an eviction that
      // happens before the first debounced save.
      await this.ctx.storage.put(createdKey, true);
      this.persist(host);
    }
    return host;
  }

  private persist(host: RoomHost) {
    // Fire and forget: losing durability costs a resumed game, never the one
    // in progress.
    void this.ctx.storage.put(snapshotKey, host.snapshot()).catch((error) => {
      console.warn("[rooms] snapshot failed:", error);
    });
  }

  private dropSession(socket: WebSocket) {
    const session = this.sessions.get(socket);
    if (!session) return;
    this.sessions.delete(socket);
    session.close();
    if (this.sessions.size > 0) return;

    // Nobody left. Write the room down and let the object go idle — an
    // evicted object costs nothing, and the next join restores it.
    const host = this.host;
    if (!host) return;
    host.flush();
    this.persist(host);
    host.destroy();
    this.host = undefined;
  }
}
