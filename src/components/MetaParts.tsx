"use client";

import { Fragment, type ReactNode } from "react";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import { visuallyHiddenSx } from "./visually-hidden";

/**
 * A run of facts about one thing (a category and its value, a wager and the
 * score it moved) set as separate pieces with a gap between them, never
 * glued together with a middle dot.
 *
 * The separator is still there for anyone not looking at the layout: a
 * screen reader hears "Math, $200", and copied text keeps its punctuation.
 * `separator` only changes that hidden text.
 */
export function MetaParts({
  parts,
  separator = ", ",
  gap = "0.6em",
  sx,
  partSx,
  "data-testid": testId,
}: {
  parts: ReactNode[];
  separator?: string;
  gap?: string | number;
  sx?: SxProps<Theme>;
  partSx?: SxProps<Theme>;
  "data-testid"?: string;
}) {
  const shown = parts.filter(
    (part) => part !== null && part !== undefined && part !== false && part !== "",
  );
  return (
    <Box
      component="span"
      data-testid={testId}
      sx={[
        {
          position: "relative",
          display: "inline-flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          columnGap: gap,
          rowGap: 0,
        },
        ...(Array.isArray(sx) ? sx : [sx ?? false]),
      ]}
    >
      {shown.map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <Box component="span" sx={visuallyHiddenSx}>
              {separator}
            </Box>
          ) : null}
          <Box component="span" sx={partSx}>
            {part}
          </Box>
        </Fragment>
      ))}
    </Box>
  );
}

/** Splits a label the game logic joined with " · " back into its parts. */
export function splitMeta(label: string): string[] {
  return label.split(" · ").filter(Boolean);
}
