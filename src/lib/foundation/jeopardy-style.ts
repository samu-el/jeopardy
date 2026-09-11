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
    '"Swiss 911", "Oswald", "Archivo Narrow", "Arial Narrow", "Liberation Sans Narrow", "DejaVu Sans Condensed", "Helvetica Neue Condensed", Impact, sans-serif',
  clue: '"Korinna", "Bookman Old Style", "Bitter", Georgia, "Times New Roman", serif',
} as const;

/** The chiselled drop shadow the board uses on every piece of text. */
export const jeopardyTextShadow = "0.06em 0.06em 0 rgba(0,0,0,0.85)";
export const jeopardyClueShadow = "0.04em 0.04em 0.02em rgba(0,0,0,0.6)";

/**
 * Everything that is not the board.
 *
 * The board has its own colours above because it is a specific object with
 * a specific look. The rest of the app is the studio around it: a black
 * stage, panels in one deep blue, one blue for anything you can press, gold
 * for anything worth pointing at. Every component draws from this list and
 * nothing else — the last design had three colour systems arguing.
 */
export const ui = {
  /** The page. */
  stage: "#000000",
  /** Panels, cards, dialogs, popovers, the chat, the lectern base. */
  surface: "#0B0F2A",
  /** A panel resting on a panel; hover on a surface. */
  surfaceRaised: "#141A44",
  line: "rgba(255,255,255,0.10)",
  lineStrong: "rgba(255,255,255,0.22)",
  ink: "#FFFFFF",
  inkMuted: "rgba(255,255,255,0.64)",
  inkFaint: "rgba(255,255,255,0.40)",
  /** The one interactive blue: buttons, links, focus, the wordmark. */
  blue: "#4B5BFF",
  blueDeep: "#3444E6",
  blueTint: "rgba(75,91,255,0.16)",
  /** The one accent: values, the room code, what is lit right now. */
  gold: "#F2C14E",
  goldDeep: "#D69F4C",
  goldTint: "rgba(242,193,78,0.14)",
  green: "#2FD07A",
  red: "#FF4E5B",
  /** Corners. One radius for panels and controls; the board has none. */
  radius: 8,
} as const;

/**
 * The physical language for everything you press or read outside the board.
 *
 * A lectern has keys; a set has lamps and readouts. These give the chrome
 * the same build: a key has a lit top edge and a dark underside, a readout is
 * black glass set into the surface, a housing is the strip a row of keys is
 * mounted in. Every control in the studio is one of these.
 */
export const controls = {
  /** A row of keys or readouts mounted together. */
  housing: {
    display: "inline-flex",
    alignItems: "center",
    background: ui.surface,
    border: `1px solid ${ui.line}`,
    // Strings, not numbers: these tokens are spread into `sx`, where a bare
    // number is a theme multiplier (borderRadius: 6 would be 48px).
    borderRadius: "999px",
    padding: "3px",
    gap: "2px",
  },
  /** The hairline between two things mounted in one housing. */
  divider: {
    width: "1px",
    alignSelf: "stretch",
    margin: "6px 3px",
    background: ui.line,
  },
  /** Black glass, set in: a score display, a text field, a code readout. */
  readout: {
    background: "#04061A",
    border: `1px solid ${ui.lineStrong}`,
    borderRadius: "6px",
    boxShadow: "inset 0 2px 6px rgba(0,0,0,0.65)",
  },
  /** A dark key at rest. */
  key: {
    background: "linear-gradient(180deg, #232A6B 0%, #161B4F 100%)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: ui.ink,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 1px 0 rgba(0,0,0,0.6)",
    "&:hover": {
      background: "linear-gradient(180deg, #2B3380 0%, #1B2160 100%)",
      borderColor: "rgba(255,255,255,0.24)",
    },
    "&:active": { transform: "translateY(1px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)" },
  },
  /** The key that moves the game on. */
  keyPrimary: {
    background: `linear-gradient(180deg, #5C6BFF 0%, ${ui.blueDeep} 100%)`,
    border: "1px solid rgba(255,255,255,0.18)",
    color: ui.ink,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 1px 0 rgba(0,0,0,0.6)",
    "&:hover": { background: `linear-gradient(180deg, #6B79FF 0%, ${ui.blue} 100%)` },
    "&:active": { transform: "translateY(1px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14)" },
  },
  /** The buzzer, armed: a red button you could feel for in the dark. */
  buzzer: {
    background: "linear-gradient(180deg, #FF7070 0%, #E01E37 55%, #B0122A 100%)",
    border: "1px solid rgba(255,140,140,0.5)",
    color: ui.ink,
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.35), 0 0 18px rgba(255,80,90,0.55)",
    "&:hover": { boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -2px 0 rgba(0,0,0,0.35), 0 0 26px rgba(255,80,90,0.75)" },
    "&:active": { transform: "translateY(1px)", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5), 0 0 10px rgba(255,80,90,0.4)" },
  },
  /** A key that cannot be pressed right now: recessed, unlit. */
  keyOff: {
    background: "#0E1236",
    border: `1px solid ${ui.line}`,
    color: ui.inkFaint,
    boxShadow: "inset 0 2px 4px rgba(0,0,0,0.55)",
  },
} as const;

/** Standard board shape: six categories, five clues each. */
export const boardColumns = 6;
export const boardRows = 5;
