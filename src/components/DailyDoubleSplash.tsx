"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { boardGradient, jeopardyFonts, jeopardyPalette, jeopardyTextShadow } from "@/lib/foundation/jeopardy-style";

interface DailyDoubleSplashProps {
  visible: boolean;
  reducedMotion?: boolean;
}

/**
 * The card that slams over the board when a Daily Double comes up: two words
 * stacked on the set's blue, arriving with the sting.
 */
export function DailyDoubleSplash({ visible, reducedMotion }: DailyDoubleSplashProps) {
  if (!visible) return null;
  return (
    <Box
      aria-hidden
      data-testid="daily-double-splash"
      sx={{
        position: "absolute",
        inset: 0,
        zIndex: 6,
        background: boardGradient,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: { xs: 0, md: 1 },
        animation: reducedMotion ? "none" : "dd-in 220ms ease-out",
        "@keyframes dd-in": {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
      }}
    >
      {["DAILY", "DOUBLE"].map((word, index) => (
        <Typography
          key={word}
          sx={{
            fontFamily: jeopardyFonts.display,
            fontWeight: 700,
            color: jeopardyPalette.goldBright,
            fontSize: "clamp(34px, 9vw, 110px)",
            lineHeight: 1,
            letterSpacing: "0.02em",
            textShadow: jeopardyTextShadow,
            transform: "skewX(-8deg)",
            animation: reducedMotion
              ? "none"
              : `dd-slam 420ms ${index * 130}ms cubic-bezier(0.2, 0.9, 0.25, 1) both`,
            "@keyframes dd-slam": {
              from: { transform: "skewX(-8deg) scale(2.4)", opacity: 0 },
              to: { transform: "skewX(-8deg) scale(1)", opacity: 1 },
            },
          }}
        >
          {word}
        </Typography>
      ))}
    </Box>
  );
}
