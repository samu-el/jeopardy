/**
 * The one gold scale. There used to be two tokens both called `gold` with
 * different values (`jeopardyPalette.gold` was the deep one, `ui.gold` the
 * bright one), so "gold" meant whichever file you happened to be in. Every
 * gold in the app is one of these two, named by what it looks like.
 */
export const goldScale = {
  /** Lit gold: accents, the room code, what is live right now. */
  bright: "#F2C14E",
  /** Burnished gold: dollar values on the board, the Daily Double prompt. */
  deep: "#D69F4C",
} as const;

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
  /** Dollar values and the Daily Double wager prompt (burnished gold). */
  goldDeep: goldScale.deep,
  goldBright: goldScale.bright,
  /**
   * @deprecated Ambiguous: this is the *deep* gold, while `ui.gold` is the
   * bright one. Use `goldDeep` (same value) instead.
   */
  gold: goldScale.deep,
  categoryText: "#FFFFFF",
  clueText: "#FFFFFF",
  /** Contestant score displays: white on black, red when negative. */
  scorePositive: "#FFFFFF",
  scoreNegative: "#FF5A5A",
  podium: "#1A1E5B",
  podiumEdge: "#3D45B8",
  correct: "#2FD07A",
  incorrect: "#FF4E5B",
  /**
   * Text on an `incorrect` fill. White on this red is 3.2:1, which fails AA;
   * near-black is 6.2:1 and keeps the red itself unchanged.
   */
  onIncorrect: "#1A0003",
  buzzLight: "#FFFFFF",
} as const;

/**
 * The show sets categories and values in an ultra-compressed sans (Swiss 911)
 * and clues in a rounded slab serif (ITC Korinna). Neither is web-licensable
 * here, so each stack names the real face first — it is used when a viewer
 * happens to have it — then the closest webfont, then a system fallback.
 */
export const jeopardyFonts = {
  // `--font-oswald` / `--font-bitter` are set by `next/font` in
  // `src/app/fonts.ts` (self-hosted, preloaded). The bare names after them
  // keep the stack working where those variables are absent (tests, tools).
  display:
    '"Swiss 911", var(--font-oswald, "Oswald"), "Oswald", "Archivo Narrow", "Arial Narrow", "Liberation Sans Narrow", "DejaVu Sans Condensed", "Helvetica Neue Condensed", Impact, sans-serif',
  clue: '"Korinna", "Bookman Old Style", var(--font-bitter, "Bitter"), "Bitter", Georgia, "Times New Roman", serif',
  /** Reading text: the platform's UI face. No webfont is loaded for it. */
  body: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
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
  /**
   * The quietest text that still carries meaning: captions, "LOCKED",
   * disabled labels. 0.40 was 3.7:1 on the surfaces; 0.54 clears 4.5:1 on
   * every surface below (stage, surface, surfaceRaised, readout, keyOff).
   */
  inkFaint: "rgba(255,255,255,0.54)",
  /** The one interactive blue: buttons, links, focus, the wordmark. */
  blue: "#4B5BFF",
  blueDeep: "#3444E6",
  blueTint: "rgba(75,91,255,0.16)",
  /**
   * The interactive blue when it is *text* on a dark surface (a selected
   * tab, a link). `blue` itself is 3.4-3.8:1 there; this is 6.2:1 or better.
   */
  blueText: "#8A96FF",
  /** The one accent: values, the room code, what is lit right now. */
  goldBright: goldScale.bright,
  goldDeep: goldScale.deep,
  /**
   * @deprecated Ambiguous: this is the *bright* gold, while
   * `jeopardyPalette.gold` is the deep one. Use `goldBright` (same value).
   */
  gold: goldScale.bright,
  goldTint: "rgba(242,193,78,0.14)",
  green: "#2FD07A",
  red: "#FF4E5B",
  /** Text on a `red` fill: near-black, 6.2:1 (white would be 3.2:1). */
  onRed: "#1A0003",
  /** Text on a `gold` fill. */
  onGold: "#1A1200",
  /** Text on a `green` fill. */
  onGreen: "#03170C",
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

/**
 * The set's face, in one call.
 *
 * Every category strip, eyebrow, button face and readout in the app is this
 * recipe with a size and a colour on top. Spelling the four properties out
 * per component is how fourteen slightly different versions of the same
 * label appeared in the first place.
 */
const displayBase = {
  fontFamily: jeopardyFonts.display,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

export function displayType<T extends object>(overrides?: T) {
  return { ...displayBase, ...overrides };
}

/** The clue face: the slab serif, chiselled, the way the monitor sets it. */
const clueBase = {
  fontFamily: jeopardyFonts.clue,
  textTransform: "uppercase",
  fontWeight: 600,
  textShadow: jeopardyClueShadow,
} as const;

export function clueType<T extends object>(overrides?: T) {
  return { ...clueBase, ...overrides };
}

/**
 * Longer clue, smaller type — the show sets a wordy clue down rather than
 * letting it overrun the monitor, and gives it a wider measure so it still
 * lands in about the same number of lines.
 *
 * One table for all three screens: the panel on a laptop, the television,
 * and the measure they share. It used to be three `if` ladders in two files
 * that drifted apart every time one of them was tuned.
 */
const clueScales = [
  { upTo: 90, panel: "clamp(18px, 4.2cqw, 46px)", tv: "clamp(20px, 5cqw, 78px)", measure: "22ch" },
  { upTo: 180, panel: "clamp(16px, 3.2cqw, 36px)", tv: "clamp(18px, 3.8cqw, 58px)", measure: "30ch" },
  { upTo: 300, panel: "clamp(15px, 2.5cqw, 29px)", tv: "clamp(16px, 3cqw, 46px)", measure: "38ch" },
  {
    upTo: Number.POSITIVE_INFINITY,
    panel: "clamp(13px, 2cqw, 24px)",
    tv: "clamp(14px, 2.4cqw, 36px)",
    measure: "46ch",
  },
] as const;

export function clueScale(length: number) {
  return clueScales.find((step) => length <= step.upTo) ?? clueScales[clueScales.length - 1];
}

/** The board's own gradient, on the panel and on the television alike. */
export const boardGradient = `linear-gradient(180deg, ${jeopardyPalette.board} 0%, ${jeopardyPalette.boardShade} 100%)`;
