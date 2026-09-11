"use client";

import Box from "@mui/material/Box";
import { controls, jeopardyFonts, ui } from "@/lib/foundation/jeopardy-style";

interface BuzzLightsProps {
  /** 0 = every light out, 1 = every light lit. */
  remaining: number;
  count?: number;
  label?: string;
  /** What the clock is timing, printed left of the lamps: "Reading…", "Ring in". */
  phase?: string;
  /** Seconds left, on the readout right of the lamps. Null shows a blank readout. */
  seconds?: number | null;
  reducedMotion?: boolean;
}

/**
 * The lamps under the board on the set: all on when the buzzer opens, going
 * out one by one as the window runs down.
 *
 * Mounted in a housing with the countdown, so the clock is one instrument
 * rather than a row of shapes and a line of text that happen to be level.
 * The phase is printed on the left, the seconds on a readout on the right,
 * and the lamps sit on the housing's centre line whatever either says: the
 * two outer thirds are the same width, and the housing has a floor under
 * its width so a label changing length never nudges the lamps.
 */
export function BuzzLights({
  remaining,
  count = 5,
  label = "Time remaining",
  phase,
  seconds,
  reducedMotion,
}: BuzzLightsProps) {
  const clamped = Math.max(0, Math.min(1, remaining));
  const lit = Math.ceil(clamped * count);

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        columnGap: 2,
        minWidth: { xs: 0, sm: 440 },
        pl: 2,
        pr: 0.75,
        py: 0.5,
        borderRadius: "999px",
        background: "#05071A",
        border: `1px solid ${ui.line}`,
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.6)",
      }}
    >
      <Box
        component="span"
        sx={{
          justifySelf: "end",
          fontFamily: jeopardyFonts.display,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          fontSize: { xs: 10, sm: 11 },
          color: ui.inkMuted,
          whiteSpace: "nowrap",
        }}
      >
        {phase}
      </Box>
      <Box
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={count}
        aria-valuenow={lit}
        sx={{ display: "flex", gap: { xs: 0.5, sm: 0.75 }, alignItems: "center" }}
      >
        {Array.from({ length: count }).map((_, index) => {
          const on = index < lit;
          return (
            <Box
              key={index}
              sx={{
                width: { xs: 26, sm: 38 },
                height: { xs: 8, sm: 10 },
                borderRadius: 999,
                background: on
                  ? "linear-gradient(180deg, #FFE7A0 0%, #F2C14E 55%, #C68F2A 100%)"
                  : "#0A0D28",
                border: on ? "1px solid rgba(255,230,160,0.6)" : `1px solid ${ui.line}`,
                boxShadow: on
                  ? "0 0 10px 1px rgba(242,193,78,0.7), inset 0 1px 0 rgba(255,255,255,0.5)"
                  : "inset 0 1px 2px rgba(0,0,0,0.7)",
                transition: reducedMotion
                  ? "none"
                  : "background 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
              }}
            />
          );
        })}
      </Box>
      {/* The seconds readout: black glass, gold digits, one width whether it
          says 120 or 9, so the housing never breathes with the count. */}
      <Box
        component="span"
        aria-live="off"
        sx={{
          ...controls.readout,
          justifySelf: "start",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "flex-end",
          minWidth: 56,
          height: 26,
          px: 1,
          fontFamily: jeopardyFonts.display,
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: "0.06em",
          color: seconds === null || seconds === undefined ? ui.inkFaint : ui.gold,
          fontVariantNumeric: "tabular-nums",
          textShadow:
            seconds === null || seconds === undefined ? "none" : `0 0 8px ${ui.goldTint}`,
        }}
      >
        {seconds === null || seconds === undefined ? "—" : `${seconds}s`}
      </Box>
    </Box>
  );
}
