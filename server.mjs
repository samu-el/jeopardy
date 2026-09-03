// Custom Next.js server: same HTTP listener serves the app and the Socket.IO
// room bridge, so shared rooms work in `dev` and in production alike.
// Run with Bun (`bun server.mjs`) — the bridge is TypeScript.
import { createServer } from "node:http";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((req, res) => handle(req, res));

try {
  const { ensureRoomStore } = await import("./src/lib/realtime/room-store-bootstrap.ts");
  // Attach persistence before the first client can join, so a room created
  // seconds after boot is already durable.
  const store = await ensureRoomStore();
  const { attachSocketServer } = await import("./src/lib/realtime/socket-bridge.ts");
  attachSocketServer(server);
  console.log(
    `> Socket.IO room bridge attached at /api/socket (rooms: ${store.kind})`,
  );
} catch (error) {
  // The app still serves solo play without the bridge; shared rooms won't work.
  console.warn("Socket.IO bridge not available:", error);
}

server.listen(port, hostname, () => {
  console.log(`> Jeopardy ready on http://${hostname}:${port}`);
});
