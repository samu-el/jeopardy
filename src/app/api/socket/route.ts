export const runtime = "nodejs";

// This route exists to advertise the socket endpoint to clients.
// The actual Socket.IO upgrade is attached to the HTTP server by `server.mjs`
// (or an equivalent custom server). When running `next dev` without that
// server, this endpoint returns a hint instead.
export function GET() {
  return Response.json({
    ok: true,
    message:
      "Socket.IO is served at /api/socket. Run `bun run start:socket` to start the server, or use the in-memory adapter for single-browser play.",
  });
}
