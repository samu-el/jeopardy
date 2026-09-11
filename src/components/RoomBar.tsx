"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ContentCopyIcon from "@mui/icons-material/ContentCopyOutlined";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOffOutlined";
import { useGameStore } from "@/lib/state/game-store";
import { jeopardyFonts, ui } from "@/lib/foundation/jeopardy-style";

/**
 * The room strip: the code to read out, who is in, and the connection state.
 *
 * Every board is a shared room, so the code is always here — there is no
 * "make this shareable" step to find. It is masked until asked for, because
 * a code on screen is a code anyone watching can join with, and boards get
 * screen-shared.
 */
export function RoomBar() {
  const online = useGameStore((s) => s.online);
  const shareUnavailable = useGameStore((s) => s.shareUnavailable);
  const publicState = useGameStore((s) => s.publicState);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!online) {
    if (!shareUnavailable) return null;
    return (
      <Tooltip title="The rooms service could not be reached, so this board is running in this browser only.">
        <Chip
          size="small"
          label="Solo — not shareable"
          variant="outlined"
          data-testid="share-unavailable"
          sx={{ color: "rgba(255,255,255,0.6)", borderColor: "rgba(255,255,255,0.18)" }}
        />
      </Tooltip>
    );
  }

  const connectedCount =
    publicState?.players.filter((player) => player.connected && player.kind === "human")
      .length ?? 0;
  const shareUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}${window.location.pathname}?room=${online.roomId}`;

  function copyLink() {
    if (!navigator.clipboard || !shareUrl) return;
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1_800);
      })
      .catch(() => {});
  }

  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
      <Tooltip title={statusLabel(online.status)}>
        <Box
          aria-label={`Connection ${online.status}`}
          sx={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: statusColor(online.status),
            boxShadow: `0 0 8px ${statusColor(online.status)}`,
            flex: "0 0 auto",
          }}
        />
      </Tooltip>

      <Tooltip title={copied ? "Link copied" : "Copy the invite link"}>
        <Box
          component="button"
          onClick={copyLink}
          data-testid="room-code"
          aria-label={`Room code ${online.roomId}. Copy the invite link.`}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            background: ui.surface,
            border: `1px solid ${ui.lineStrong}`,
            borderRadius: 1.5,
            px: 1.25,
            py: 0.5,
            height: 30,
            cursor: "pointer",
            color: "inherit",
            "&:hover": { borderColor: ui.ink },
          }}
        >
          <Typography
            // Tabular figures so revealing the code doesn't shift the strip.
            sx={{
              fontFamily: jeopardyFonts.display,
              letterSpacing: "0.18em",
              fontSize: 15,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              color: ui.gold,
            }}
          >
            {revealed ? online.roomId : "•".repeat(online.roomId.length)}
          </Typography>
          <ContentCopyIcon sx={{ fontSize: 14, opacity: 0.7 }} />
        </Box>
      </Tooltip>

      <Tooltip title={revealed ? "Hide the code" : "Show the code"}>
        <IconButton
          size="small"
          data-testid="reveal-room-code"
          aria-label={revealed ? "Hide the room code" : "Show the room code"}
          aria-pressed={revealed}
          onClick={() => setRevealed((shown) => !shown)}
        >
          {revealed ? (
            <VisibilityOffIcon sx={{ fontSize: 17 }} />
          ) : (
            <VisibilityIcon sx={{ fontSize: 17 }} />
          )}
        </IconButton>
      </Tooltip>

      <Chip
        size="small"
        label={`${connectedCount} in room`}
        variant="outlined"
        sx={{ height: 30, display: { xs: "none", md: "flex" } }}
      />
    </Stack>
  );
}

function statusColor(status: string) {
  switch (status) {
    case "connected":
      return ui.green;
    case "connecting":
    case "reconnecting":
      return ui.gold;
    default:
      return ui.red;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "connected":
      return "Connected — share the code to let people in";
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
