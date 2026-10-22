"use client";

import { Fragment, type ReactNode } from "react";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

/**
 * A run of facts about one thing (a category and its value, a wager and the
 * score it moved) set as separate pieces with a gap between them, never
 * glued together with a middle dot.
 *
 * The pieces are inline, joined by an ordinary space and a margin: the space
 * keeps "Math $200" readable to a screen reader and in copied text, the
 * margin is what sets the pieces apart on screen.
 */
export function MetaParts({
  parts,
  gap = "0.6em",
  sx,
  partSx,
  "data-testid": testId,
}: {
  parts: ReactNode[];
  gap?: string;
  sx?: SxProps<Theme>;
  partSx?: SxProps<Theme>;
  "data-testid"?: string;
}) {
  const shown = parts.filter(
    (part) => part !== null && part !== undefined && part !== false && part !== "",
  );
  return (
    <Box component="span" data-testid={testId} sx={sx}>
      {shown.map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? " " : null}
          <Box
            component="span"
            sx={[
              { display: "inline-block", marginInlineStart: index > 0 ? gap : 0 },
              ...(Array.isArray(partSx) ? partSx : [partSx ?? false]),
            ]}
          >
            {part}
          </Box>
        </Fragment>
      ))}
    </Box>
  );
}
