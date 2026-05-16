"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import HomeIcon from "@mui/icons-material/HomeOutlined";
import LogoutIcon from "@mui/icons-material/LogoutOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ReplayIcon from "@mui/icons-material/ReplayOutlined";
import SettingsIcon from "@mui/icons-material/SettingsOutlined";
import PeopleIcon from "@mui/icons-material/PeopleOutlineOutlined";
import ShuffleIcon from "@mui/icons-material/ShuffleOutlined";
import LibraryIcon from "@mui/icons-material/LibraryBooksOutlined";
import { useGameStore } from "@/lib/state/game-store";
import { primeAudio } from "@/lib/ai";
import { Wordmark } from "./Wordmark";
import { SettingsPanel } from "./SettingsPanel";
import { PlayersPanel } from "./PlayersPanel";

interface RoomToolbarProps {
  onOpenPicker: () => void;
  onOpenBrowser: () => void;
}

export function RoomToolbar({ onOpenPicker, onOpenBrowser }: RoomToolbarProps) {
  const setScreen = useGameStore((s) => s.setScreen);
  const startGame = useGameStore((s) => s.startGame);
  const lobby = useGameStore((s) => s.lobby);
  const publicState = useGameStore((s) => s.publicState);
  const runtime = useGameStore((s) => s.runtime);
  const exitToLobby = useGameStore((s) => s.exitToLobby);
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const [playersAnchor, setPlayersAnchor] = useState<HTMLElement | null>(null);

  const canBegin = Boolean(lobby.loadedEpisode || lobby.customGame);
  const inGame = Boolean(runtime && publicState && publicState.round !== "lobby");

  return (
    <Stack
      direction="row"
      sx={{
        py: 1.5,
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Tooltip title="Home">
          <IconButton onClick={() => setScreen("landing")}>
            <HomeIcon />
          </IconButton>
        </Tooltip>
        <Wordmark size="sm" />
        {lobby.loadedEpisode ? (
          <Chip
            label={`#${lobby.loadedEpisode.id}${lobby.loadedEpisode.airDate ? ` · ${lobby.loadedEpisode.airDate}` : ""}`}
            size="small"
            variant="outlined"
            sx={{ ml: 1, color: "text.secondary" }}
          />
        ) : null}
      </Stack>

      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
        <Tooltip title="New game">
          <IconButton onClick={onOpenPicker}>
            <ShuffleIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Browse">
          <IconButton onClick={onOpenBrowser}>
            <LibraryIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Players">
          <IconButton onClick={(event) => setPlayersAnchor(event.currentTarget)}>
            <PeopleIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Settings">
          <IconButton onClick={(event) => setSettingsAnchor(event.currentTarget)}>
            <SettingsIcon />
          </IconButton>
        </Tooltip>
        {inGame ? (
          <Tooltip title="Restart">
            <IconButton
              color="warning"
              onClick={() => {
                exitToLobby();
              }}
            >
              <ReplayIcon />
            </IconButton>
          </Tooltip>
        ) : (
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            disabled={!canBegin}
            onClick={() => {
              primeAudio();
              startGame();
            }}
            sx={{ ml: 1, px: 3 }}
          >
            Begin
          </Button>
        )}
        <Tooltip title="Leave">
          <IconButton color="error" onClick={() => setScreen("landing")}>
            <LogoutIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      <Popover
        open={Boolean(settingsAnchor)}
        anchorEl={settingsAnchor}
        onClose={() => setSettingsAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { minWidth: 320, maxWidth: 380, p: 2 } } }}
      >
        <Typography variant="overline" sx={{ color: "text.secondary" }}>
          Settings
        </Typography>
        <Box sx={{ mt: 1 }}>
          <SettingsPanel />
        </Box>
      </Popover>

      <Popover
        open={Boolean(playersAnchor)}
        anchorEl={playersAnchor}
        onClose={() => setPlayersAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { minWidth: 320, maxWidth: 380, p: 2 } } }}
      >
        <Typography variant="overline" sx={{ color: "text.secondary" }}>
          Players
        </Typography>
        <Box sx={{ mt: 1 }}>
          <PlayersPanel />
        </Box>
      </Popover>
    </Stack>
  );
}
