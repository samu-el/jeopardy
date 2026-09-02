"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import LogoutIcon from "@mui/icons-material/LogoutOutlined";
import KeyboardIcon from "@mui/icons-material/KeyboardOutlined";
import HistoryIcon from "@mui/icons-material/HistoryOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ReplayIconAlt from "@mui/icons-material/PlayCircleOutlineOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ReplayIcon from "@mui/icons-material/ReplayOutlined";
import SettingsIcon from "@mui/icons-material/SettingsOutlined";
import PeopleIcon from "@mui/icons-material/PeopleOutlineOutlined";
import ShuffleIcon from "@mui/icons-material/ShuffleOutlined";
import LibraryIcon from "@mui/icons-material/LibraryBooksOutlined";
import { useGameStore } from "@/lib/state/game-store";
import { primeAudio, primeSpeech } from "@/lib/ai";
import { Wordmark } from "./Wordmark";
import { RoomBar } from "./RoomBar";
import { SettingsPanel } from "./SettingsPanel";
import { PlayersPanel } from "./PlayersPanel";

interface RoomToolbarProps {
  onOpenPicker: () => void;
  onOpenBrowser: () => void;
  onToggleShortcuts: () => void;
  onToggleTranscript: () => void;
  onOpenReplay: () => void;
}

export function RoomToolbar({
  onOpenPicker,
  onOpenBrowser,
  onToggleShortcuts,
  onToggleTranscript,
  onOpenReplay,
}: RoomToolbarProps) {
  const setScreen = useGameStore((s) => s.setScreen);
  const startGame = useGameStore((s) => s.startGame);
  const lobby = useGameStore((s) => s.lobby);
  const publicState = useGameStore((s) => s.publicState);
  const runtime = useGameStore((s) => s.runtime);
  const exitToLobby = useGameStore((s) => s.exitToLobby);
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const [playersAnchor, setPlayersAnchor] = useState<HTMLElement | null>(null);
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const closeMore = () => setMoreAnchor(null);

  const online = useGameStore((s) => s.online);
  const selfId = useGameStore((s) => s.selfId)();
  const isRoomHost = !publicState?.settings.hostId || publicState.settings.hostId === selfId;
  const canBegin = Boolean(lobby.loadedEpisode || lobby.customGame) && isRoomHost;
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
          <Box
            component="button"
            onClick={() => setScreen("landing")}
            aria-label="Home"
            sx={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              p: 0,
              display: "inline-flex",
              alignItems: "center",
              transition: "opacity 0.15s ease",
              "&:hover": { opacity: 0.8 },
              "&:focus-visible": {
                outline: "2px solid rgba(91,140,255,0.6)",
                outlineOffset: 4,
                borderRadius: 4,
              },
            }}
          >
            <Wordmark size="sm" />
          </Box>
        </Tooltip>
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
          <IconButton onClick={onOpenPicker} sx={{ minWidth: 44, minHeight: 44 }}>
            <ShuffleIcon />
          </IconButton>
        </Tooltip>
        <RoomBar />
        <Tooltip title="Settings">
          <IconButton
            onClick={(event) => setSettingsAnchor(event.currentTarget)}
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            <SettingsIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="More">
          <IconButton
            onClick={(event) => setMoreAnchor(event.currentTarget)}
            sx={{ minWidth: 44, minHeight: 44 }}
            aria-label="More"
          >
            <MoreVertIcon />
          </IconButton>
        </Tooltip>
        {inGame ? (
          isRoomHost ? (
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
          ) : null
        ) : isRoomHost ? (
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            disabled={!canBegin}
            onClick={() => {
              primeAudio();
              primeSpeech();
              startGame();
            }}
            sx={{ ml: 1, px: 3 }}
          >
            Begin
          </Button>
        ) : (
          <Typography
            variant="caption"
            sx={{ ml: 1, color: "text.secondary", whiteSpace: "nowrap" }}
          >
            Waiting for the host
          </Typography>
        )}
        <Tooltip title={online ? "Leave room" : "Home"}>
          <IconButton color="error" onClick={() => setScreen("landing")}>
            <LogoutIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      <Menu
        anchorEl={moreAnchor}
        open={Boolean(moreAnchor)}
        onClose={closeMore}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          onClick={(event) => {
            closeMore();
            setPlayersAnchor(event.currentTarget);
          }}
        >
          <ListItemIcon>
            <PeopleIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Players</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeMore();
            onOpenBrowser();
          }}
        >
          <ListItemIcon>
            <LibraryIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Browse episodes</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeMore();
            onToggleTranscript();
          }}
        >
          <ListItemIcon>
            <HistoryIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Transcript</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeMore();
            onOpenReplay();
          }}
        >
          <ListItemIcon>
            <ReplayIconAlt fontSize="small" />
          </ListItemIcon>
          <ListItemText>Replay last game</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeMore();
            onToggleShortcuts();
          }}
        >
          <ListItemIcon>
            <KeyboardIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Shortcuts</ListItemText>
        </MenuItem>
      </Menu>

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
