/**
 * Set design tokens. The show's board is a very specific blue with gold
 * values, black gaps and heavy drop shadows — every surface that should read
 * as "the board" pulls its colours and type from here.
 */
export const jeopardyPalette = {
  /** The board blue. */
  board: "#060CE9",
  boardDeep: "#0409A8",
  boardShade: "#03066B",
  /** Gaps between cells, and the studio surround. */
  gap: "#000000",
  /** Dollar values and the Daily Double wager prompt. */
  gold: "#D69F4C",
  goldBright: "#F2C14E",
  categoryText: "#FFFFFF",
  clueText: "#FFFFFF",
  /** Contestant score displays: white on black, red when negative. */
  scorePositive: "#FFFFFF",
  scoreNegative: "#FF5A5A",
  podium: "#1A1E5B",
  podiumEdge: "#3D45B8",
  correct: "#2FD07A",
  incorrect: "#FF4E5B",
  buzzLight: "#FFFFFF",
} as const;

/**
 * The show sets categories and values in an ultra-compressed sans (Swiss 911)
 * and clues in a rounded slab serif (ITC Korinna). Neither is web-licensable
 * here, so each stack names the real face first — it is used when a viewer
 * happens to have it — then the closest webfont, then a system fallback.
 */
export const jeopardyFonts = {
  display:
    '"Swiss 911", "Oswald", "Archivo Narrow", "Arial Narrow", Impact, sans-serif',
  clue: '"Korinna", "Bookman Old Style", "Bitter", Georgia, "Times New Roman", serif',
} as const;

/** The chiselled drop shadow the board uses on every piece of text. */
export const jeopardyTextShadow = "0.06em 0.06em 0 rgba(0,0,0,0.85)";
export const jeopardyClueShadow = "0.04em 0.04em 0.02em rgba(0,0,0,0.6)";

/** Standard board shape: six categories, five clues each. */
export const boardColumns = 6;
export const boardRows = 5;
