"use client";

import Box from "@mui/material/Box";

interface WordmarkProps {
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeMap = {
  sm: { font: 24, height: 30 },
  md: { font: 36, height: 44 },
  lg: { font: 64, height: 76 },
  xl: { font: 112, height: 130 },
};

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
        fontFamily: '"Inter Tight", Inter, ui-sans-serif, system-ui, sans-serif',
        fontWeight: 900,
        fontStyle: "italic",
        fontSize: font,
        letterSpacing: -2,
        lineHeight: 1,
        transform: "skew(-10deg)",
      }}
    >
      <Box
        component="span"
        sx={{
          color: "#3a78ff",
          textShadow:
            "0 2px 0 rgba(0,0,0,0.55), 0 0 22px rgba(58,120,255,0.32)",
          WebkitTextStroke: "1px rgba(0,0,0,0.35)",
        }}
      >
        JEOPARDY
      </Box>
      <Box
        component="span"
        sx={{
          color: "#ffd23b",
          textShadow:
            "0 2px 0 rgba(0,0,0,0.55), 0 0 18px rgba(255,210,59,0.35)",
          WebkitTextStroke: "1px rgba(0,0,0,0.35)",
        }}
      >
        !
      </Box>
    </Box>
  );
}
