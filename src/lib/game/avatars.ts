/**
 * A player's face: an icon key or their initial, drawn on their colour.
 *
 * Only keys travel. Each client maps a key to its own glyph, so the room
 * never stores or forwards a picture, and anything it does not recognise
 * (an older client's emoji included) falls back to the initial.
 */

export const avatarIcons = [
  "star",
  "bolt",
  "rocket",
  "paw",
  "brain",
  "dice",
  "music",
  "heart",
  "flame",
  "moon",
  "sun",
  "tree",
  "diamond",
  "anchor",
  "plane",
  "coffee",
] as const;

export type AvatarIcon = (typeof avatarIcons)[number];

/** `initial` is the monogram: the first letter of the player's name. */
export type PlayerAvatar = AvatarIcon | "initial";

/** The colours a player can pick for their face and lectern. */
export const avatarColors = [
  "#4B5BFF",
  "#33d684",
  "#ffd23b",
  "#ff7a8a",
  "#a06bff",
  "#5ad0ff",
  "#ff9a1f",
  "#9aa5b1",
] as const;

const iconSet = new Set<string>(avatarIcons);

export function isAvatarIcon(value: unknown): value is AvatarIcon {
  return typeof value === "string" && iconSet.has(value);
}

/** A key the room keeps, or undefined for anything else (emoji, junk, a typo). */
export function normalizeAvatar(value: unknown): PlayerAvatar | undefined {
  if (value === "initial") return "initial";
  return isAvatarIcon(value) ? value : undefined;
}

/** A hex colour the room keeps, or undefined. A colour ends up in CSS, so nothing else gets through. */
export function normalizeAvatarColor(value: unknown): string | undefined {
  return typeof value === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : undefined;
}

/**
 * The monogram for a name: its first letter or digit, capitalised. A name
 * with neither (all symbols or emoji) has no monogram.
 */
export function monogramFor(name: string): string | undefined {
  const match = /[\p{L}\p{N}]/u.exec(name);
  return match ? match[0].toLocaleUpperCase() : undefined;
}
