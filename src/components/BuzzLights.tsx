"use client";

import Box from "@mui/material/Box";
import { jeopardyPalette } from "@/lib/foundation/jeopardy-style";

interface BuzzLightsProps {
  /** 0 = every light out, 1 = every light lit. */
  remaining: number;
  count?: number;
  label?: string;
  reducedMotion?: boolean;
}

/**
 * The row of lights that frames the clue on the set: they all come on when
 * the buzzer opens and go out one by one as the window runs down.
 */
export function BuzzLights({
  remaining,
  count = 5,
  label = "Time remaining",
  reducedMotion,
}: BuzzLightsProps) {
  const clamped = Math.max(0, Math.min(1, remaining));
  const lit = Math.ceil(clamped * count);

  return (
    <Box
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={count}
      aria-valuenow={lit}
      sx={{
        display: "flex",
        gap: { xs: 0.5, sm: 1 },
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {Array.from({ length: count }).map((_, index) => {
        const on = index < lit;
        return (
          <Box
            key={index}
            sx={{
              width: { xs: 26, sm: 40 },
              height: { xs: 8, sm: 10 },
              borderRadius: 1,
              background: on ? jeopardyPalette.goldBright : "rgba(255,255,255,0.10)",
              boxShadow: on ? `0 0 12px 1px ${jeopardyPalette.goldBright}` : "none",
              transition: reducedMotion ? "none" : "background 180ms ease, box-shadow 180ms ease",
            }}
          />
        );
      })}
    </Box>
  );
}
