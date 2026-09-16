"use client";

import Box from "@mui/material/Box";
import Popover from "@mui/material/Popover";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

/**
 * A titled panel hanging off the key that opened it.
 *
 * Settings and Players are the same popover with different contents, and
 * every dialog in the app repeats this eyebrow-and-body pair.
 */
export function AnchoredPanel({
  title,
  anchor,
  onClose,
  children,
}: {
  title: string;
  anchor: HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Popover
      open={Boolean(anchor)}
      anchorEl={anchor}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      slotProps={{ paper: { sx: { minWidth: 320, maxWidth: 380, p: 2.5 } } }}
    >
      <Typography variant="overline">{title}</Typography>
      <Box sx={{ mt: 1 }}>{children}</Box>
    </Popover>
  );
}
