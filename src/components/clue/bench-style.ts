import { jeopardyFonts } from "@/lib/foundation/jeopardy-style";

/**
 * A bench that may need two rows on a phone: centred, with room at the
 * corners for what wraps. One row on anything wider, with the pill's ends.
 */
export const wrapHousingSx = {
  flexWrap: "wrap",
  justifyContent: "center",
  rowGap: 0.75,
  p: { xs: 1, sm: "3px" },
  borderRadius: { xs: "16px", sm: "999px" },
  maxWidth: "100%",
} as const;

/** A key on a bench: the housing's height, the housing's round ends. */
export const benchKeySx = {
  minHeight: 32,
  px: 1.5,
  borderRadius: "999px",
  fontSize: 12,
  "@media (pointer: coarse)": { minHeight: 44 },
} as const;

/** Keys you press fast: no double-tap zoom, no callout, no selection. */
export const pressableSx = {
  touchAction: "manipulation",
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
  WebkitTapHighlightColor: "transparent",
} as const;

/**
 * One width, one height: a stack of these reads as a set.
 *
 * Compact on a desk — every lectern in the row carries the space for two of
 * them all game — but never under the 24px target minimum, and a full 44px
 * wherever the pointer is a finger.
 */
export const stackedButtonSx = {
  ...pressableSx,
  width: "100%",
  minWidth: 0,
  minHeight: 0,
  height: 28,
  py: 0,
  borderRadius: "6px",
  fontFamily: jeopardyFonts.display,
  fontSize: 12,
  lineHeight: 1,
  "@media (pointer: coarse)": { height: 44 },
} as const;

/** The same keys in the phone's bottom bar: thumb-sized. */
export const barButtonSx = {
  ...stackedButtonSx,
  width: "auto",
  height: 60,
  borderRadius: "12px",
  fontSize: 15,
  "@media (pointer: coarse)": { height: 60 },
} as const;
