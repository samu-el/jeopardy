"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useGameStore } from "@/lib/state/game-store";
import { ui } from "@/lib/foundation/jeopardy-style";

const EMOJIS = [
  "🦊", "🐢", "🐙", "🦋", "🐝", "🐬", "🦉", "🐼",
  "🚀", "🎯", "🧠", "⚡", "🎲", "🎩", "🪐", "🌟",
];

/** The player's own colours: data a player picks, not the app's palette. */
const COLORS = [
  "#4B5BFF",
  "#33d684",
  "#ffd23b",
  "#ff7a8a",
  "#a06bff",
  "#5ad0ff",
  "#ff9a1f",
  "#9aa5b1",
];

interface AvatarPickerProps {
  playerId: string;
  emoji?: string;
  color?: string;
  size?: number;
  label?: string;
}

export function AvatarPicker({ playerId, emoji, color, size = 36, label }: AvatarPickerProps) {
  const setPlayerAvatar = useGameStore((s) => s.setPlayerAvatar);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const display = emoji ?? "•";
  const bg = color ?? ui.surfaceRaised;
  return (
    <>
      <Tooltip title={label ?? "Avatar"}>
        <IconButton
          onClick={(event) => setAnchor(event.currentTarget)}
          sx={{ p: 0 }}
        >
          <Box
            sx={{
              width: size,
              height: size,
              borderRadius: "50%",
              background: bg,
              border: `1px solid ${ui.lineStrong}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: size * 0.55,
              color: emoji ? undefined : ui.inkMuted,
            }}
          >
            {display}
          </Box>
        </IconButton>
      </Tooltip>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { sx: { p: 1.5, minWidth: 220 } } }}
      >
        <Typography variant="overline">Emoji</Typography>
        <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 0.5, mb: 1 }}>
          {EMOJIS.map((entry) => (
            <Box
              key={entry}
              component="button"
              aria-label={`Emoji ${entry}`}
              aria-pressed={emoji === entry}
              onClick={() => setPlayerAvatar(playerId, { emoji: entry })}
              sx={{
                width: 32,
                height: 32,
                background: emoji === entry ? ui.goldTint : "transparent",
                border: `1px solid ${emoji === entry ? ui.goldBright : ui.line}`,
                borderRadius: 1,
                cursor: "pointer",
                fontSize: 18,
                "&:hover": { background: ui.hoverTint },
                "&:active": { transform: "translateY(1px)" },
              }}
            >
              {entry}
            </Box>
          ))}
          <Box
            component="button"
            aria-label="Clear emoji"
            onClick={() => setPlayerAvatar(playerId, { emoji: null })}
            sx={{
              width: 32,
              height: 32,
              background: "transparent",
              border: `1px dashed ${ui.lineStrong}`,
              borderRadius: 1,
              cursor: "pointer",
              color: ui.inkMuted,
            }}
          >
            ×
          </Box>
        </Stack>
        <Typography variant="overline">Color</Typography>
        <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 0.5 }}>
          {COLORS.map((entry) => (
            <Box
              key={entry}
              component="button"
              aria-label={`Color ${entry}`}
              aria-pressed={color === entry}
              onClick={() => setPlayerAvatar(playerId, { color: entry })}
              sx={{
                width: 24,
                height: 24,
                background: entry,
                border:
                  color === entry
                    ? `2px solid ${ui.ink}`
                    : `1px solid ${ui.line}`,
                borderRadius: "50%",
                cursor: "pointer",
              }}
            />
          ))}
          <Box
            component="button"
            aria-label="Clear color"
            onClick={() => setPlayerAvatar(playerId, { color: null })}
            sx={{
              width: 24,
              height: 24,
              background: "transparent",
              border: `1px dashed ${ui.lineStrong}`,
              borderRadius: "50%",
              cursor: "pointer",
              color: ui.inkMuted,
              fontSize: 12,
            }}
          >
            ×
          </Box>
        </Stack>
      </Popover>
    </>
  );
}
