"use client";

import { useEffect } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/CloseOutlined";
import { useGameStore } from "@/lib/state/game-store";
import { selectNotices } from "@/lib/state/selectors";
import type { RoomNotice } from "@/lib/state/notices";
import { ui } from "@/lib/foundation/jeopardy-style";

/** How long a notice stays up before it goes on its own. */
const noticeLifetimeMs = 4_500;

const accent: Record<RoomNotice["kind"], string> = {
  joined: ui.green,
  left: ui.inkMuted,
  "host-changed": ui.gold,
  "room-full": ui.red,
  kicked: ui.red,
  refused: ui.red,
  info: ui.blue,
};

/**
 * Small toasts for room news — arrivals, departures, the chair changing
 * hands, a refusal. Independent of chat, which is off by default.
 */
export function RoomNotices() {
  const notices = useGameStore(selectNotices);

  return (
    <Box
      role="status"
      aria-live="polite"
      data-testid="room-notices"
      sx={{
        position: "fixed",
        top: { xs: 8, md: 16 },
        right: { xs: 8, md: 16 },
        left: { xs: 8, sm: "auto" },
        zIndex: 30,
        pointerEvents: "none",
        display: "flex",
        justifyContent: { xs: "center", sm: "flex-end" },
      }}
    >
      <Stack spacing={1} sx={{ width: { xs: "100%", sm: 320 } }}>
        {notices.map((notice) => (
          <NoticeToast key={notice.id} notice={notice} />
        ))}
      </Stack>
    </Box>
  );
}

function NoticeToast({ notice }: { notice: RoomNotice }) {
  const dismissNotice = useGameStore((s) => s.dismissNotice);
  const onDismiss = () => dismissNotice(notice.id);
  useEffect(() => {
    const timer = window.setTimeout(() => dismissNotice(notice.id), noticeLifetimeMs);
    return () => window.clearTimeout(timer);
  }, [dismissNotice, notice.id]);

  return (
    <Box
      data-testid="room-notice"
      data-kind={notice.kind}
      sx={{
        pointerEvents: "auto",
        display: "flex",
        alignItems: "center",
        gap: 1,
        pl: 1.5,
        pr: 0.5,
        py: 0.5,
        background: ui.surfaceRaised,
        border: `1px solid ${ui.lineStrong}`,
        borderLeft: `4px solid ${accent[notice.kind]}`,
        borderRadius: `${ui.radius}px`,
        boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
      }}
    >
      <Typography sx={{ flex: 1, fontSize: 14, color: ui.ink }}>{notice.text}</Typography>
      <IconButton size="small" aria-label="Dismiss" onClick={onDismiss} sx={{ color: ui.inkMuted }}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
