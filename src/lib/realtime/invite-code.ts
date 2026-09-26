/**
 * Reading a room code out of whatever someone typed or pasted: the code
 * itself, a code with stray spaces, or the whole invite link.
 */

export const roomCodeLength = 4;

// The same alphabet `generateRoomCode` draws from: no I, O, 0 or 1.
const roomCodeCharacters = /^[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]+$/;

/** A pasted invite link gives its `room=` value; anything else is cleaned up. */
export function parseInviteInput(raw: string): string {
  const fromLink = /[?&#]room=([A-Za-z0-9-]+)/i.exec(raw);
  const source = fromLink ? fromLink[1] : raw;
  return source
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, roomCodeLength);
}

/** Exactly as long as a code, from the code alphabet. */
export function isCompleteRoomCode(code: string): boolean {
  return code.length === roomCodeLength && roomCodeCharacters.test(code);
}

/** Characters no room code uses, which are usually a misread 1 or 0. */
export function hasImpossibleCharacters(code: string): boolean {
  return /[IO01]/.test(code);
}
