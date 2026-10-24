"use client";

import Box from "@mui/material/Box";
import { jeopardyFonts, ui } from "@/lib/foundation/jeopardy-style";

interface WordmarkProps {
  size?: "sm" | "md" | "lg" | "xl";
}

// The hero size steps down on a phone: at 112px the mark runs off a 390px
// screen with the exclamation mark cut in half, and at 52px it sits inside
// a 360px screen's gutters with room to spare.
const sizeMap = {
  sm: { font: 24, height: 30 },
  md: { font: 36, height: 44 },
  lg: { font: 64, height: 76 },
  // A two-column landing leaves the mark about 460px at 1024: 96 fits it,
  // 112 needs a desktop-wide column.
  xl: {
    font: { xs: 52, sm: 88, md: 96, lg: 112 },
    height: { xs: 62, sm: 102, md: 112, lg: 130 },
  },
} as const;

/**
 * Original wordmark for this project. The official Jeopardy! logo is a
 * trademark of Jeopardy Productions / Sony Pictures and cannot be
 * reproduced. To drop in a licensed asset, place it at
 * `public/wordmark.svg` and edit this component to render an <img>.
 */
export function Wordmark({ size = "md" }: WordmarkProps) {
  const { font, height } = sizeMap[size];
  return (
    <Box
      component="span"
      role="img"
      aria-label="Jeopardy!"
      sx={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 0.25,
        height,
        userSelect: "none",
        // The same condensed face as the board's categories, leaned the way
        // the show leans its title. One typeface for the whole set.
        fontFamily: jeopardyFonts.display,
        fontWeight: 700,
        fontSize: font,
        letterSpacing: "0.01em",
        lineHeight: 1,
        transform: "skew(-10deg)",
        // The lean pushes the foot of the J out past the box on the left and
        // the top of the ! out on the right. Room for both inside the box, so
        // the ink starts where the box does and a centred mark stays centred.
        px: "0.09em",
      }}
    >
      <Box
        component="span"
        sx={{
          color: ui.blue,
          textShadow: "0.04em 0.04em 0 rgba(0,0,0,0.6)",
        }}
      >
        JEOPARDY
      </Box>
      <Box
        component="span"
        sx={{
          color: ui.gold,
          textShadow: "0.04em 0.04em 0 rgba(0,0,0,0.6)",
        }}
      >
        !
      </Box>
    </Box>
  );
}
