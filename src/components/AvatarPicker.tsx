"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { avatarColors, avatarIcons, monogramFor, type PlayerAvatar as AvatarKey } from "@/lib/game";
import { useGameStore } from "@/lib/state/game-store";
import { jeopardyFonts, ui } from "@/lib/foundation/jeopardy-style";
import { PlayerAvatar, avatarGlyphs } from "./PlayerAvatar";

interface AvatarPickerProps {
  playerId: string;
  name: string;
  avatar?: AvatarKey;
  color?: string;
  size?: number;
  label?: string;
}

const tileSx = (selected: boolean) => ({
  width: 32,
  height: 32,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  color: ui.ink,
  background: selected ? ui.goldTint : "transparent",
  border: `1px solid ${selected ? ui.goldBright : ui.line}`,
  borderRadius: 1,
  cursor: "pointer",
  "&:hover": { background: ui.hoverTint },
  "&:active": { transform: "translateY(1px)" },
});

export function AvatarPicker({ playerId, name, avatar, color, size = 36, label }: AvatarPickerProps) {
  const setPlayerAvatar = useGameStore((s) => s.setPlayerAvatar);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const initialSelected = avatar === undefined || avatar === "initial";
  return (
    <>
      <Tooltip title={label ?? "Avatar"}>
        <IconButton
          aria-label={label ?? `Avatar for ${name}`}
          onClick={(event) => setAnchor(event.currentTarget)}
          sx={{ p: 0 }}
        >
          <PlayerAvatar name={name} avatar={avatar} color={color} size={size} />
        </IconButton>
      </Tooltip>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { sx: { p: 1.5, width: 356, maxWidth: "calc(100vw - 32px)" } } }}
      >
        <Typography variant="overline">Avatar</Typography>
        <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 0.5, mb: 1 }}>
          <Box
            component="button"
            aria-label="Initial"
            aria-pressed={initialSelected}
            onClick={() => setPlayerAvatar(playerId, { avatar: "initial" })}
            sx={{ ...tileSx(initialSelected), fontFamily: jeopardyFonts.display, fontWeight: 600, fontSize: 16 }}
          >
            {monogramFor(name) ?? "A"}
          </Box>
          {avatarIcons.map((key) => {
            const { Icon, label: glyphLabel } = avatarGlyphs[key];
            return (
              <Box
                key={key}
                component="button"
                aria-label={glyphLabel}
                aria-pressed={avatar === key}
                onClick={() => setPlayerAvatar(playerId, { avatar: key })}
                sx={tileSx(avatar === key)}
              >
                <Icon sx={{ fontSize: 20 }} />
              </Box>
            );
          })}
        </Stack>
        <Typography variant="overline">Color</Typography>
        <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 0.5 }}>
          {avatarColors.map((entry) => (
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
