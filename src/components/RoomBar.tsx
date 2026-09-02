"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ContentCopyIcon from "@mui/icons-material/ContentCopyOutlined";
import GroupAddIcon from "@mui/icons-material/GroupAddOutlined";
import { useGameStore } from "@/lib/state/game-store";
import { jeopardyFonts, jeopardyPalette } from "@/lib/foundation/jeopardy-style";

/**
 * Shared-room strip: the code to read out, who is in, and the connection
 * state. Hidden entirely in solo play so the board stays uncluttered.
 */
export function RoomBar() {
  const online = useGameStore((s) => s.online);
  const publicState = useGameStore((s) => s.publicState);
  const hostOnlineRoom = useGameStore((s) => s.hostOnlineRoom);
  const leaveOnlineRoom = useGameStore((s) => s.leaveOnlineRoom);
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);

  if (!online) {
    return (
      <Button
        size="small"
        startIcon={<GroupAddIcon />}
        disabled={opening}
        onClick={async () => {
          setOpening(true);
          try {
            await hostOnlineRoom();
          } finally {
            setOpening(false);
          }
        }}
        sx={{ color: "rgba(255,255,255,0.75)", whiteSpace: "nowrap", minWidth: "auto" }}
      >
        {opening ? "Opening…" : "Invite"}
      </Button>
    );
  }

  const connectedCount =
    publicState?.players.filter((player) => player.connected && player.kind === "human")
      .length ?? 0;
  const shareUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}${window.location.pathname}?room=${online.roomId}`;

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Tooltip title={statusLabel(online.status)}>
        <Box
          aria-label={`Connection ${online.status}`}
          sx={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: statusColor(online.status),
            boxShadow: `0 0 8px ${statusColor(online.status)}`,
          }}
        />
      </Tooltip>
      <Tooltip title={copied ? "Link copied" : "Copy invite link"}>
        <Box
          component="button"
          onClick={() => {
            if (!navigator.clipboard || !shareUrl) return;
            navigator.clipboard
              .writeText(shareUrl)
              .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1_800);
              })
              .catch(() => {});
          }}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 1,
            px: 1,
            py: 0.4,
            cursor: "pointer",
            color: "inherit",
          }}
        >
          <Typography
            sx={{
              fontFamily: jeopardyFonts.display,
              letterSpacing: "0.18em",
              fontSize: 15,
              fontWeight: 600,
              color: jeopardyPalette.goldBright,
            }}
          >
            {online.roomId}
          </Typography>
          <ContentCopyIcon sx={{ fontSize: 14, opacity: 0.7 }} />
        </Box>
      </Tooltip>
      <Chip
        size="small"
        label={`${connectedCount} in room`}
        variant="outlined"
        sx={{
          color: "rgba(255,255,255,0.7)",
          borderColor: "rgba(255,255,255,0.2)",
          display: { xs: "none", sm: "flex" },
        }}
      />
      <Button
        size="small"
        color="inherit"
        onClick={leaveOnlineRoom}
        sx={{ opacity: 0.7, display: { xs: "none", sm: "inline-flex" } }}
      >
        Leave
      </Button>
    </Stack>
  );
}

function statusColor(status: string) {
  switch (status) {
    case "connected":
      return jeopardyPalette.correct;
    case "connecting":
    case "reconnecting":
      return jeopardyPalette.goldBright;
    default:
      return jeopardyPalette.incorrect;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting…";
    case "reconnecting":
      return "Reconnecting…";
    case "rejected":
      return "Room unavailable";
    default:
      return "Disconnected";
  }
}
