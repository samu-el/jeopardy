import { jeopardyFonts } from "@/lib/foundation/jeopardy-style";

export const wrapHousingSx = {
  flexWrap: "wrap",
  justifyContent: "center",
  rowGap: 0.75,
  p: { xs: 1, sm: "3px" },
  borderRadius: { xs: "16px", sm: "999px" },
  maxWidth: "100%",
} as const;

/** A key on a bench: the housing's height, the housing's round ends. */
export const benchKeySx = { minHeight: 32, px: 1.5, borderRadius: "999px", fontSize: 12 } as const;

/**
 * One width, one height: a stack of these reads as a set.
 *
 * Tight on purpose. Every lectern in the row carries the space for two of
 * them all game, so each millimetre here is one the board gets to keep.
 */
export const stackedButtonSx = {
  width: "100%",
  minWidth: 0,
  minHeight: 0,
  height: 22,
  py: 0,
  borderRadius: "6px",
  fontFamily: jeopardyFonts.display,
  fontSize: 12,
  lineHeight: 1,
} as const;

