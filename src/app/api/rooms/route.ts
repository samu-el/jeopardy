import { getOrCreateBridgeRoom, type BridgeRoomInit } from "@/lib/realtime/socket-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateBody {
  hostId: string;
  hostName: string;
  players: BridgeRoomInit["players"];
  clues: BridgeRoomInit["clues"];
  settings?: BridgeRoomInit["settings"];
}

function makeRoomId(): string {
  // Short, easy-to-share room code.
  const random = Math.random().toString(36).slice(2, 8);
  return `r-${random}`;
}

export async function POST(request: Request) {
  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return Response.json({ error: "invalid-body" }, { status: 400 });
  }
  if (!body.hostId || !Array.isArray(body.clues) || body.clues.length === 0) {
    return Response.json({ error: "invalid-body" }, { status: 400 });
  }
  const roomId = makeRoomId();
  getOrCreateBridgeRoom({
    roomId,
    hostId: body.hostId,
    players: body.players,
    clues: body.clues,
    settings: body.settings,
  });
  return Response.json({ roomId, socketPath: "/api/socket" });
}
