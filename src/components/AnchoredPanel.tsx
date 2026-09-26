"use client";

import { useId, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Popover from "@mui/material/Popover";
import Typography from "@mui/material/Typography";

/**
 * A titled panel hanging off the key that opened it.
 *
 * Settings and Players are the same popover with different contents. It is
 * announced as a dialog named by its title, so focus lands somewhere with a
 * name rather than on an anonymous box.
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
  const titleId = useId();
  return (
    <Popover
      open={Boolean(anchor)}
      anchorEl={anchor}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      slotProps={{
        paper: {
          role: "dialog",
          "aria-labelledby": titleId,
          sx: {
            // Never wider than a 320px phone with its gutters.
            width: "min(380px, calc(100vw - 32px))",
            maxHeight: "calc(100% - 32px)",
            p: 2.5,
          },
        },
      }}
    >
      <Typography variant="overline" component="h2" id={titleId} sx={{ m: 0 }}>
        {title}
      </Typography>
      <Box sx={{ mt: 1 }}>{children}</Box>
    </Popover>
  );
}
