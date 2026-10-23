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
 * values, black gaps and heavy drop shadows. Every surface that should read
 * as "the board" pulls its colours and type from here.
 */
export const jeopardyPalette = {
  /** The board blue: the brand, and the surface the board, the clue and the landing stand on. */
  board: "#060CE9",
  boardDeep: "#0409A8",
  boardShade: "#03066B",
  /** Gaps between cells: the black seams of the set, tinted to the stage. */
  gap: "#03041A",
  /** Dollar values and the Daily Double wager prompt (burnished gold). */
  goldDeep: goldScale.deep,
  goldBright: goldScale.bright,
  /**
   * @deprecated Ambiguous: this is the *deep* gold, while `ui.gold` is the
   * bright one. Use `goldDeep` (same value) instead.
   */
  gold: goldScale.deep,
  categoryText: "#FAFAFF",
  clueText: "#FAFAFF",
  /** Contestant score displays: white on black, red when negative. */
  scorePositive: "#FAFAFF",
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
  buzzLight: "#FAFAFF",
  /** A value printed faintly on a ghost tile before a game is dealt (an overlay, so alpha). */
  ghostValue: "rgba(214,159,76,0.16)",
} as const;

/**
 * The show sets categories and values in an ultra-compressed sans (Swiss 911)
 * and clues in a rounded slab serif (ITC Korinna). Neither is web-licensable
 * here, so each stack names the real face first (it is used when a viewer
 * happens to have it), then the closest webfont, then a system fallback.
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
 * a specific look. The rest of the app is the studio around it: a stage
 * tinted toward the board's blue, panels one step lighter, gold for the one
 * thing to press and for what is selected or focused. Every component draws
 * from this list and nothing else. `design.md` at the repo root names the
 * roles; `cssRoles` below writes them on `:root` for hand-written CSS.
 *
 * Every colour is solid hex so `contrast.ts` can test it; alpha is kept for
 * overlays (tints, scrims) only.
 */
export const ui = {
  /** The page: near-black, tinted toward the board blue. */
  stage: "#080A1F",
  /** Panels, dialogs, popovers, the chat, the lectern. */
  surface: "#0F1333",
  /** A key at rest; a panel resting on a panel; hover on a surface. */
  surfaceRaised: "#181D49",
  /** A hairline between rows and around panels. */
  line: "#2A2F5E",
  /** A field's edge and a key's outline: 3:1 or better on every surface. */
  lineStrong: "#6E74A8",
  ink: "#F5F6FF",
  /** Secondary text. */
  inkMuted: "#B9BDE0",
  /**
   * The quietest text that still carries meaning: captions, disabled
   * labels. Clears 4.5:1 on every surface below (stage, surface,
   * surfaceRaised, readout, keyOff).
   */
  inkFaint: "#9DA2CC",
  /** Hover wash on a surface (an overlay, so alpha). */
  hoverTint: "rgba(185,189,224,0.10)",
  /** A key that cannot be pressed right now. */
  keyOff: "#11143A",
  /**
   * The old interactive blue. Gold is the signal now; blue stays for links
   * on the stage and for the info tone.
   */
  blue: "#4B5BFF",
  blueDeep: "#3444E6",
  blueTint: "rgba(75,91,255,0.16)",
  /** Blue as *text* on a dark surface: 6.2:1 or better. */
  blueText: "#8A96FF",
  /** The one accent: the primary action, the selection, focus, the room code. */
  goldBright: goldScale.bright,
  goldDeep: goldScale.deep,
  /** The primary key under the pointer. */
  goldHover: "#F7CF6B",
  /**
   * @deprecated Ambiguous: this is the *bright* gold, while
   * `jeopardyPalette.gold` is the deep one. Use `goldBright` (same value).
   */
  gold: goldScale.bright,
  goldTint: "rgba(242,193,78,0.14)",
  /** The focus ring, on every surface and on the board. */
  focus: goldScale.bright,
  green: "#2FD07A",
  red: "#FF4E5B",
  /** The red under the pointer. */
  redHover: "#FF6E79",
  /** The Incorrect key: a deeper red that carries light text (5.5:1). */
  incorrectFill: "#C8102E",
  incorrectFillHover: "#A50D26",
  /** The Correct key under the pointer. */
  greenHover: "#27B86B",
  /** A negative score or a wrong ruling, as text on the stage or the board. */
  negativeInk: "#FF9C9C",
  /** A right ruling, as text on the board. */
  positiveInk: "#B8F5C4",
  /** Text on a `red` fill: near-black, 6.2:1 (white would be 3.2:1). */
  onRed: "#1A0003",
  /** Text on a `gold` fill. */
  onGold: "#1A1200",
  /** Text on a `green` fill. */
  onGreen: "#03170C",
  /** Text on the board blue, and its quieter step (7:1). */
  onBoard: "#FAFAFF",
  onBoardMuted: "#D9DCFF",
  /** A scrim laid over the board blue to set a block apart (an overlay). */
  boardScrim: "rgba(3,6,107,0.55)",
  /** The QR code stays black on white whatever the theme: scanners need it. */
  qrDark: "#000000",
  qrLight: "#FFFFFF",
  /** Corners: controls, and the panels that hold them (concentric). */
  radius: 8,
  radiusPanel: 12,
} as const;

/** The roles from `design.md`, as CSS custom properties on `:root`. */
export const cssRoles = {
  "--color-paper": ui.stage,
  "--color-paper-2": ui.surface,
  "--color-paper-3": ui.surfaceRaised,
  "--color-ink": ui.ink,
  "--color-ink-2": ui.inkMuted,
  "--color-muted": ui.inkFaint,
  "--color-rule": ui.line,
  "--color-edge": ui.lineStrong,
  "--color-accent": ui.goldBright,
  "--color-accent-ink": ui.onGold,
  "--color-focus": ui.focus,
  "--color-field": jeopardyPalette.board,
  "--color-error": ui.red,
  "--color-success": ui.green,
  "--font-display": jeopardyFonts.display,
  "--font-body": jeopardyFonts.body,
  "--font-outlier": jeopardyFonts.clue,
  "--radius-control": `${ui.radius}px`,
  "--radius-panel": `${ui.radiusPanel}px`,
} as const;

/**
 * The physical language for everything you press or read outside the board,
 * kept flat: a key is a raised fill and a hairline, a readout is the stage
 * colour set into a surface. No bevels, inset highlights or glows; elevation
 * is lightness.
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
  /** A readout: a score, a text field, a code. The stage colour, set in. */
  readout: {
    background: "#05061A",
    border: `1px solid ${ui.lineStrong}`,
    borderRadius: "6px",
    boxShadow: "none",
  },
  /** A key at rest. */
  key: {
    background: ui.surfaceRaised,
    border: `1px solid ${ui.lineStrong}`,
    color: ui.ink,
    boxShadow: "none",
    "&:hover": { background: "#21275A", borderColor: ui.inkMuted },
    "&:active": { transform: "translateY(1px)" },
  },
  /** The key that moves the game on: gold, like the values on the board. */
  keyPrimary: {
    background: ui.goldBright,
    border: `1px solid ${ui.goldBright}`,
    color: ui.onGold,
    boxShadow: "none",
    "&:hover": { background: ui.goldHover, borderColor: ui.goldHover },
    "&:active": { transform: "translateY(1px)" },
  },
  /** The buzzer, armed: the only red control. */
  buzzer: {
    background: ui.red,
    border: `1px solid ${ui.red}`,
    color: ui.onRed,
    boxShadow: "none",
    "&:hover": { background: ui.redHover, borderColor: ui.redHover },
    "&:active": { transform: "translateY(1px)" },
  },
  /** A key that cannot be pressed right now: recessed, unlit. */
  keyOff: {
    background: ui.keyOff,
    border: `1px solid ${ui.line}`,
    color: ui.inkFaint,
    boxShadow: "none",
  },
} as const;

/** Standard board shape: six categories, five clues each. */
export const boardColumns = 6;
export const boardRows = 5;

/**
 * The set's face, in one call.
 *
 * Every category strip, clue header and money readout on the board and the
 * television is this recipe with a size and a colour on top. Spelling the four properties out
 * per component is how fourteen slightly different versions of the same
 * label appeared in the first place.
 */
const displayBase = {
  fontFamily: jeopardyFonts.display,
  textTransform: "uppercase",
  // Capitals are the show's display voice; tracked 0.02em at most, and
  // never below 16px (smaller text is the body face, as written).
  letterSpacing: "0.02em",
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
 * Longer clue, smaller type: the show sets a wordy clue down rather than
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
