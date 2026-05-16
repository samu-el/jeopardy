"use client";

import Box from "@mui/material/Box";

interface WordmarkProps {
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeMap = {
  sm: { font: 22, height: 26 },
  md: { font: 32, height: 38 },
  lg: { font: 56, height: 64 },
  xl: { font: 96, height: 110 },
};

export function Wordmark({ size = "md" }: WordmarkProps) {
  const { font, height } = sizeMap[size];
  return (
    <Box
      component="span"
      aria-label="Jeopardy"
      sx={{
        display: "inline-flex",
        alignItems: "baseline",
        fontFamily: '"Inter Tight", Inter, ui-sans-serif, system-ui, sans-serif',
        fontWeight: 900,
        fontStyle: "italic",
        letterSpacing: -1.5,
        fontSize: font,
        lineHeight: 1,
        height,
        color: "#ffd23b",
        textShadow: "0 2px 0 rgba(0,0,0,0.6)",
        userSelect: "none",
      }}
    >
      <Box component="span" sx={{ color: "#5b8cff" }}>JEOPARDY</Box>
      <Box component="span" sx={{ color: "#ffd23b", ml: 0.25 }}>!</Box>
    </Box>
  );
}
