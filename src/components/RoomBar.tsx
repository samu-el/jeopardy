"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ContentCopyIcon from "@mui/icons-material/ContentCopyOutlined";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOffOutlined";
import { useGameStore } from "@/lib/state/game-store";
import { controls, jeopardyFonts, ui } from "@/lib/foundation/jeopardy-style";
import { Housing, HousingDivider, HousingLabel } from "./Housing";

interface RoomBarProps {
  /** Printed at the front of the housing: which episode is on the board. */
  episode?: string;
}

/**
 * The room housing: the code to read out, who is in, and the connection
 * state, mounted together with the episode label.
 *
 * Every board is a shared room, so the code is always here — there is no
 * "make this shareable" step to find. It is masked until asked for, because
 * a code on screen is a code anyone watching can join with, and boards get
 * screen-shared.
 */
export function RoomBar({ episode }: RoomBarProps) {
  const online = useGameStore((s) => s.online);
  const shareUnavailable = useGameStore((s) => s.shareUnavailable);
  const publicState = useGameStore((s) => s.publicState);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  // The episode label is a wide-screen luxury: on a phone the code matters
  // and the air date does not.
  const wideOnly = { display: { xs: "none", md: "inline-flex" } } as const;
  const episodeLabel = episode ? <HousingLabel sx={wideOnly}>{episode}</HousingLabel> : null;

  if (!online) {
    if (!shareUnavailable) {
      return episodeLabel ? <Housing sx={wideOnly}>{episodeLabel}</Housing> : null;
    }
    return (
      <Housing>
        {episodeLabel}
        {episodeLabel ? <HousingDivider sx={{ display: { xs: "none", md: "block" } }} /> : null}
        <Tooltip title="The rooms service could not be reached, so this board is running in this browser only.">
          <HousingLabel data-testid="share-unavailable" sx={{ color: ui.inkFaint }}>
            Solo · not shareable
          </HousingLabel>
        </Tooltip>
      </Housing>
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

  const lamp = statusColor(online.status);

  return (
    <Housing data-testid="room-bar">
      {episodeLabel}
      {episodeLabel ? <HousingDivider sx={{ display: { xs: "none", md: "block" } }} /> : null}

      <Tooltip title={statusLabel(online.status)}>
        <Box
          role="img"
          aria-label={`Connection ${online.status}`}
          sx={{
            mx: 1.25,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: lamp,
            boxShadow: `0 0 8px ${lamp}, inset 0 1px 0 rgba(255,255,255,0.5)`,
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
            ...controls.readout,
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
            height: 30,
            px: 1.25,
            cursor: "pointer",
            color: "inherit",
            "&:hover": { borderColor: ui.inkMuted },
            "&:focus-visible": { outline: `2px solid ${ui.blue}`, outlineOffset: 1 },
          }}
        >
          <Typography
            // Tabular figures so revealing the code doesn't shift the strip.
            sx={{
              fontFamily: jeopardyFonts.display,
              letterSpacing: "0.18em",
              fontSize: 15,
              fontWeight: 600,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
              color: ui.gold,
              textShadow: `0 0 8px ${ui.goldTint}`,
            }}
          >
            {revealed ? online.roomId : "•".repeat(online.roomId.length)}
          </Typography>
          <ContentCopyIcon sx={{ fontSize: 13, color: ui.inkMuted }} />
        </Box>
      </Tooltip>

      <Tooltip title={revealed ? "Hide the code" : "Show the code"}>
        <IconButton
          size="small"
          data-testid="reveal-room-code"
          aria-label={revealed ? "Hide the room code" : "Show the room code"}
          aria-pressed={revealed}
          onClick={() => setRevealed((shown) => !shown)}
          sx={{ width: 32, height: 32, borderRadius: "50%" }}
        >
          {revealed ? (
            <VisibilityOffIcon sx={{ fontSize: 17 }} />
          ) : (
            <VisibilityIcon sx={{ fontSize: 17 }} />
          )}
        </IconButton>
      </Tooltip>

      <HousingDivider sx={{ display: { xs: "none", md: "block" } }} />
      <HousingLabel sx={wideOnly}>{connectedCount} in room</HousingLabel>
    </Housing>
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
