import {
  createRoom,
  listRoomIds,
  roomSummary,
  type CreateRoomInput,
} from "@/lib/realtime/room-registry";
import { ensureRoomStore } from "@/lib/realtime/room-store-bootstrap";
import { socketPath } from "@/lib/realtime/socket-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateBody {
  hostId?: string;
  clues?: CreateRoomInput["clues"];
  settings?: CreateRoomInput["settings"];
}

export async function POST(request: Request) {
  let body: CreateBody = {};
  try {
    const text = await request.text();
    body = text ? (JSON.parse(text) as CreateBody) : {};
  } catch {
    return Response.json({ error: "invalid-body" }, { status: 400 });
  }

  await ensureRoomStore();
  const room = createRoom({
    hostId: body.hostId,
    clues: body.clues,
    settings: body.settings,
  });

  return Response.json({
    roomId: room.roomId,
    socketPath,
    room: roomSummary(room),
  });
}

export async function GET() {
  const store = await ensureRoomStore();
  return Response.json({ rooms: listRoomIds(), stored: await store.list() });
}
