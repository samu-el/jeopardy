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
  const bridge = await import("./.next/server/chunks/socket-bridge.cjs").catch(() => null);
  if (bridge?.attachSocketServer) {
    bridge.attachSocketServer(server);
  } else {
    const fallback = await import("./src/lib/realtime/socket-bridge.ts").catch(() => null);
    fallback?.attachSocketServer?.(server);
  }
} catch (error) {
  console.warn("Socket.IO bridge not available:", error);
}

server.listen(port, hostname, () => {
  console.log(`> Jeopardy ready on http://${hostname}:${port}`);
});
