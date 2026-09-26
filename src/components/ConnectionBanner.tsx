"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useGameStore } from "@/lib/state/game-store";
import { selectRoomStatus, type RoomStatusView } from "@/lib/state/selectors";
import { ui } from "@/lib/foundation/jeopardy-style";

type BannerAction = "use-here" | "retry" | "offline" | "home";

/** What each state says (when the room gives no sentence) and what it offers. */
const banner: Partial<Record<RoomStatusView, { text: string; actions: BannerAction[] }>> = {
  connecting: { text: "Connecting to the room…", actions: [] },
  reconnecting: {
    text: "Connection lost — reconnecting. Your seat and score are held.",
    actions: [],
  },
  unreachable: {
    text: "Can't reach the rooms service. Still trying…",
    actions: ["offline"],
  },
  "not-found": { text: "This room isn't open.", actions: ["retry", "home"] },
  replaced: { text: "This room was opened in another tab.", actions: ["use-here", "home"] },
  kicked: { text: "The host removed you from this room.", actions: ["home"] },
  full: { text: "This room is full.", actions: ["home"] },
  "invalid-session": {
    text: "That seat belongs to another device.",
    actions: ["home"],
  },
  "code-taken": { text: "Couldn't open a room right now.", actions: ["retry", "home"] },
  rejected: { text: "This room is no longer open.", actions: ["home"] },
};

const actionLabel: Record<BannerAction, string> = {
  "use-here": "Use this tab",
  retry: "Try again",
  offline: "Play offline",
  home: "Home",
};

/**
 * Tells a player, in the one place they will look, that the room is not
 * live — why, and what they can do about it. Each reason gets its own way
 * out; a tab replaced by another used to be offered "Play solo", which led
 * to an empty board.
 */
export function ConnectionBanner() {
  const online = useGameStore((s) => s.online);
  const status = useGameStore(selectRoomStatus);
  const takeOverRoom = useGameStore((s) => s.takeOverRoom);
  const retryRoom = useGameStore((s) => s.retryRoom);
  const playOffline = useGameStore((s) => s.playOffline);
  const leaveOnlineRoom = useGameStore((s) => s.leaveOnlineRoom);
  const setScreen = useGameStore((s) => s.setScreen);
  const startGame = useGameStore((s) => s.startGame);

  const entry = banner[status];
  if (!online || !entry) return null;

  const rejected = online.status === "rejected";
  const message = (rejected || status === "unreachable" ? online.error : undefined) ?? entry.text;

  function run(action: BannerAction) {
    switch (action) {
      case "use-here":
        takeOverRoom();
        return;
      case "retry":
        if (status === "code-taken") {
          leaveOnlineRoom();
          startGame();
          return;
        }
        void retryRoom();
        return;
      case "offline":
        playOffline();
        return;
      case "home":
        leaveOnlineRoom();
        setScreen("landing");
        return;
    }
  }

  return (
    <Box
      role={rejected ? "alert" : "status"}
      aria-live={rejected ? "assertive" : "polite"}
      data-testid="connection-banner"
      data-status={status}
      sx={{
        // Sits along the bottom so it never covers the toolbar, and only the
        // actions inside it take clicks.
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        pointerEvents: "none",
        background: rejected ? "rgba(140,20,32,0.96)" : ui.surface,
        borderTop: `1px solid ${ui.lineStrong}`,
        px: 2,
        py: 1,
        pb: "calc(8px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={{ xs: 1, sm: 2 }}
        sx={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}
      >
        <Typography sx={{ fontSize: 14, color: ui.ink }}>{message}</Typography>
        {entry.actions.length > 0 ? (
          <Stack direction="row" spacing={1}>
            {entry.actions.map((action) => (
              <Button
                key={action}
                size="small"
                variant="outlined"
                color="inherit"
                data-testid={`banner-${action}`}
                sx={{ pointerEvents: "auto", minHeight: 36 }}
                onClick={() => run(action)}
              >
                {actionLabel[action]}
              </Button>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}
