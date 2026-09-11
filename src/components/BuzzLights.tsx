"use client";

import type { ReactNode } from "react";
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
  /**
   * Something to type into, mounted in the housing: the answer field while
   * the clock is yours. On a wide screen it takes the phase's place, left of
   * the lamps, mirroring the readout on the right; on a phone it gets a row
   * of its own under the lamps, full width, so nothing pokes out one side.
   */
  control?: ReactNode;
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
  control,
  reducedMotion,
}: BuzzLightsProps) {
  const clamped = Math.max(0, Math.min(1, remaining));
  const lit = Math.ceil(clamped * count);

  const phaseLabel = (
    <Box
      component="span"
      sx={{
        justifySelf: "end",
        gridArea: control ? "auto" : "1 / 1",
        minWidth: 0,
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        px: control ? 0 : 1.25,
        // On a phone the field row leaves no room for it; the lectern's
        // light says who rang in.
        display: control ? { xs: "none", sm: "inline" } : "inline",
        fontFamily: jeopardyFonts.display,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        fontSize: { xs: 10, sm: 11 },
        color: ui.inkMuted,
      }}
    >
      {phase}
    </Box>
  );

  return (
    <Box
      sx={{
        display: "grid",
        // minmax(0, …) so the outer thirds can shrink below what is printed
        // on them: a long name ellipsises rather than widening the page.
        gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
        alignItems: "center",
        columnGap: 2,
        rowGap: 0.75,
        minWidth: { xs: 0, sm: 440 },
        width: { xs: "100%", sm: "auto" },
        px: 0.75,
        py: 0.5,
        // Round ends on one row; on a phone a second row makes it a slab, and
        // 24px keeps the corners soft without swallowing what is inside.
        borderRadius: "24px",
        background: "#05071A",
        border: `1px solid ${ui.line}`,
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.6)",
      }}
    >
      {/* Idle, the phase is printed left of the lamps. While you type, the
          field takes that side and the phase moves beside the seconds, so
          the two thirds carry about the same weight. */}
      {control ? <Box aria-hidden sx={{ gridArea: "1 / 1" }} /> : phaseLabel}
      <Box
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={count}
        aria-valuenow={lit}
        sx={{ gridArea: "1 / 2", display: "flex", gap: { xs: 0.5, sm: 0.75 }, alignItems: "center" }}
      >
        {Array.from({ length: count }).map((_, index) => {
          const on = index < lit;
          return (
            <Box
              key={index}
              sx={{
                width: { xs: 22, sm: 38 },
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
      {/* Every cell is placed by hand: the field shares column 1 with the
          phase's empty stand-in on a wide screen, and auto-placement would
          have shuffled the lamps over to make room for it. */}
      <Box
        sx={{
          gridArea: "1 / 3",
          justifySelf: "start",
          display: "flex",
          alignItems: "center",
          columnGap: 1.5,
          minWidth: 0,
          maxWidth: "100%",
        }}
      >
        {/* The seconds readout: black glass, gold digits, one width whether it
          says 120 or 9, so the housing never breathes with the count. */}
        <Box
          component="span"
          aria-live="off"
          sx={{
            ...controls.readout,
            flex: "0 0 auto",
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
              seconds === null || seconds === undefined
                ? "none"
                : `0 0 8px ${ui.goldTint}`,
          }}
        >
          {seconds === null || seconds === undefined ? "—" : `${seconds}s`}
        </Box>
        {control ? phaseLabel : null}
      </Box>
      {control ? (
        <Box
          sx={{
            gridColumn: { xs: "1 / -1", sm: "1" },
            gridRow: { xs: 2, sm: 1 },
            justifySelf: { xs: "stretch", sm: "end" },
            minWidth: 0,
          }}
        >
          {control}
        </Box>
      ) : null}
    </Box>
  );
}
