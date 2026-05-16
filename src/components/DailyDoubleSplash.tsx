"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface DailyDoubleSplashProps {
  visible: boolean;
  reducedMotion?: boolean;
}

export function DailyDoubleSplash({ visible, reducedMotion }: DailyDoubleSplashProps) {
  if (!visible) return null;
  return (
    <Box
      role="status"
      aria-label="Daily Double"
      sx={{
        position: "absolute",
        inset: 0,
        zIndex: 3,
        background:
          "radial-gradient(circle at 50% 50%, #ffd23b 0%, #ff9a1f 70%, #b35900 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textShadow: "0 6px 0 rgba(0,0,0,0.35)",
        animation: reducedMotion ? "none" : "dd-fade-in 0.25s ease",
        "@keyframes dd-fade-in": {
          from: { opacity: 0, transform: "scale(1.05)" },
          to: { opacity: 1, transform: "scale(1)" },
        },
      }}
    >
      <Typography
        sx={{
          fontStyle: "italic",
          fontWeight: 900,
          color: "#0c0c10",
          fontSize: { xs: 48, sm: 72, md: 96 },
          letterSpacing: -2,
          transform: "skew(-8deg)",
          textAlign: "center",
          lineHeight: 1,
        }}
      >
        DAILY DOUBLE!
      </Typography>
    </Box>
  );
}
