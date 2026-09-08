/**
 * Room codes. Kept apart from the room registry so the browser and the
 * Cloudflare Worker can both use them without pulling in a server-side
 * room table.
 */

// No I/O/0/1: a code gets read aloud and typed in from across a room.
const roomCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = 4): string {
  let code = "";
  for (let index = 0; index < length; index += 1) {
    code += roomCodeAlphabet[Math.floor(Math.random() * roomCodeAlphabet.length)];
  }
  return code;
}

export function normalizeRoomCode(roomId: string): string {
  return roomId.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}
