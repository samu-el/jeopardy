"use client";

import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";
import { controls, jeopardyFonts, ui } from "@/lib/foundation/jeopardy-style";

interface HousingProps {
  children?: ReactNode;
  sx?: SxProps<Theme>;
  "data-testid"?: string;
}

function merge(base: SxProps<Theme>, sx?: SxProps<Theme>): SxProps<Theme> {
  return [base, ...(Array.isArray(sx) ? sx : [sx ?? false])] as SxProps<Theme>;
}

/**
 * Several controls mounted in one dark pill — the strip of keys on a
 * lectern, the room readout, the toolbar. One housing reads as one
 * instrument; the same buttons loose on the page read as clutter.
 */
export function Housing({ children, sx, ...rest }: HousingProps) {
  return (
    <Box {...rest} sx={merge(controls.housing, sx)}>
      {children}
    </Box>
  );
}

/** The hairline between two groups in a housing. */
export function HousingDivider({ sx }: { sx?: SxProps<Theme> }) {
  return <Box aria-hidden sx={merge(controls.divider, sx)} />;
}

/** A printed label on the housing: the set's face, small and spaced. */
export function HousingLabel({ children, sx, ...rest }: HousingProps) {
  return (
    <Box
      {...rest}
      sx={merge(
        {
          display: "inline-flex",
          alignItems: "center",
          height: 36,
          px: 1.5,
          fontFamily: jeopardyFonts.display,
          fontWeight: 600,
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: ui.inkMuted,
          whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums",
        },
        sx,
      )}
    >
      {children}
    </Box>
  );
}
