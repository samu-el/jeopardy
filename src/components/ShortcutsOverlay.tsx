"use client";

import { useEffect } from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ui } from "@/lib/foundation/jeopardy-style";

interface ShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
}

interface Shortcut {
  key: string;
  label: string;
  /** Only does anything for the player running the room. */
  hostOnly?: boolean;
}

const SHORTCUTS: Shortcut[] = [
  { key: "Space", label: "Ring in — early costs you a lockout" },
  { key: "Enter", label: "Send your answer or wager" },
  { key: "Alt + M", label: "Answer by voice" },
  { key: "R", label: "Reveal the response", hostOnly: true },
  { key: "Y", label: "Judge correct", hostOnly: true },
  { key: "N", label: "Judge incorrect", hostOnly: true },
  { key: "S", label: "Next clue", hostOnly: true },
  { key: "?", label: "Toggle this overlay" },
  { key: "Esc", label: "Close overlays" },
];

export function ShortcutsOverlay({ open, onClose }: ShortcutsOverlayProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogContent>
        <Typography variant="overline">Keyboard</Typography>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {SHORTCUTS.map((entry) => (
            <Stack
              key={entry.key}
              direction="row"
              spacing={2}
              sx={{ alignItems: "center", justifyContent: "space-between" }}
            >
              <Typography variant="body2" sx={{ color: ui.ink }}>
                {entry.label}
                {entry.hostOnly ? (
                  <Box
                    component="span"
                    sx={{ ml: 0.75, fontSize: 10, color: ui.gold, letterSpacing: "0.1em" }}
                  >
                    HOST
                  </Box>
                ) : null}
              </Typography>
              <Box
                sx={{
                  px: 1.25,
                  py: 0.5,
                  borderRadius: 1,
                  background: ui.surfaceRaised,
                  border: `1px solid ${ui.lineStrong}`,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {entry.key}
              </Box>
            </Stack>
          ))}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
