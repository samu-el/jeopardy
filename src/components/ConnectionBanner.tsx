"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useGameStore } from "@/lib/state/game-store";
import { ui } from "@/lib/foundation/jeopardy-style";

/**
 * Tells a player, in the one place they will look, that the room is no longer
 * live — and that their seat is still being held for them.
 */
export function ConnectionBanner() {
  const online = useGameStore((s) => s.online);
  const leaveOnlineRoom = useGameStore((s) => s.leaveOnlineRoom);

  if (!online || online.status === "connected" || online.status === "local") {
    return null;
  }

  const message =
    online.status === "rejected"
      ? (online.error ?? "This room is no longer open.")
      : online.status === "reconnecting"
        ? "Connection lost — reconnecting. Your seat and score are held."
        : online.status === "disconnected"
          ? "Disconnected from the room. Trying again…"
          : "Connecting to the room…";

  return (
    <Box
      role="status"
      aria-live="polite"
      data-testid="connection-banner"
      sx={{
        // Sits along the bottom so it never covers the toolbar, and only the
        // action inside it takes clicks.
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        pointerEvents: "none",
        background: online.status === "rejected" ? "rgba(140,20,32,0.96)" : ui.surface,
        borderTop: `1px solid ${ui.lineStrong}`,
        px: 2,
        py: 1,
      }}
    >
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: "center", justifyContent: "center" }}
      >
        <Typography sx={{ fontSize: 14, color: ui.ink }}>{message}</Typography>
        {online.status === "rejected" ? (
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            sx={{ pointerEvents: "auto" }}
            onClick={leaveOnlineRoom}
          >
            Play solo
          </Button>
        ) : null}
      </Stack>
    </Box>
  );
}
