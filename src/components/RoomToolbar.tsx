"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton, { type IconButtonProps } from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import EditNoteIcon from "@mui/icons-material/EditNoteOutlined";
import Popover from "@mui/material/Popover";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import LogoutIcon from "@mui/icons-material/LogoutOutlined";
import KeyboardIcon from "@mui/icons-material/KeyboardOutlined";
import HistoryIcon from "@mui/icons-material/HistoryOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ReplayIconAlt from "@mui/icons-material/PlayCircleOutlineOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ReplayIcon from "@mui/icons-material/ReplayOutlined";
import SettingsIcon from "@mui/icons-material/VolumeUpOutlined";
import PeopleIcon from "@mui/icons-material/PeopleOutlineOutlined";
import ShuffleIcon from "@mui/icons-material/ShuffleOutlined";
import LibraryIcon from "@mui/icons-material/LibraryBooksOutlined";
import { useGameStore } from "@/lib/state/game-store";
import { primeAudio, primeSpeech } from "@/lib/ai";
import { controls, ui } from "@/lib/foundation/jeopardy-style";
import { Wordmark } from "./Wordmark";
import { RoomBar } from "./RoomBar";
import { Housing, HousingDivider } from "./Housing";
import CastIcon from "@mui/icons-material/CastOutlined";
import { SettingsPanel } from "./SettingsPanel";
import { PlayersPanel } from "./PlayersPanel";

interface RoomToolbarProps {
  onOpenPicker: () => void;
  onOpenBrowser: () => void;
  onOpenBuilder: () => void;
  onToggleShortcuts: () => void;
  onToggleTranscript: () => void;
  onOpenReplay: () => void;
}

export function RoomToolbar({
  onOpenPicker,
  onOpenBrowser,
  onOpenBuilder,
  onToggleShortcuts,
  onToggleTranscript,
  onOpenReplay,
}: RoomToolbarProps) {
  const setScreen = useGameStore((s) => s.setScreen);
  const leaveOnlineRoom = useGameStore((s) => s.leaveOnlineRoom);
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
    // Three columns on a wide screen — mark, room, keys — so the room
    // housing sits on the board's centre line rather than trailing the
    // mark. A phone stacks it: the mark centred on top, the two housings
    // side by side and centred beneath it. Nothing hangs off one edge.
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "auto auto", sm: "1fr auto 1fr" },
        justifyContent: { xs: "center", sm: "stretch" },
        alignItems: "center",
        columnGap: 1,
        rowGap: 1,
        py: 1.5,
      }}
    >
      <Box sx={{ gridColumn: { xs: "1 / -1", sm: "1" }, justifySelf: { xs: "center", sm: "start" } }}>
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
      </Box>

      <Box sx={{ gridColumn: { xs: "1", sm: "2" }, justifySelf: { xs: "end", sm: "center" }, minWidth: 0 }}>
        <RoomBar
          episode={
            lobby.loadedEpisode
              ? `#${lobby.loadedEpisode.id}${lobby.loadedEpisode.airDate ? ` · ${lobby.loadedEpisode.airDate}` : ""}`
              : undefined
          }
        />
      </Box>

      <Box
        sx={{
          gridColumn: { xs: "2", sm: "3" },
          justifySelf: { xs: "start", sm: "end" },
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
          alignItems: "center",
          justifyContent: { xs: "center", sm: "flex-end" },
          minWidth: 0,
        }}
      >
        {/* The one key that isn't housed: it starts the game, and it should
            look like the thing you press to do that. */}
        {!inGame ? (
          isRoomHost ? (
            <Button
              variant="contained"
              data-testid="begin"
              startIcon={<PlayArrowIcon />}
              disabled={!canBegin}
              onClick={() => {
                primeAudio();
                primeSpeech();
                startGame();
              }}
              sx={{
                ...controls.keyPrimary,
                minHeight: 42,
                px: 2.5,
                borderRadius: "999px",
                "&.Mui-disabled": controls.keyOff,
              }}
            >
              Begin
            </Button>
          ) : (
            <Typography variant="overline" sx={{ whiteSpace: "nowrap", color: ui.inkMuted }}>
              Waiting for the host
            </Typography>
          )
        ) : null}

        <Housing>
          <ToolKey title="Change game" aria-label="Change game" data-testid="change-game" onClick={onOpenPicker}>
            <ShuffleIcon />
          </ToolKey>
          <DisplayButton />
          <ToolKey
            title="Settings"
            aria-label="Settings"
            onClick={(event) => setSettingsAnchor(event.currentTarget)}
          >
            <SettingsIcon />
          </ToolKey>
          <ToolKey title="More" aria-label="More" onClick={(event) => setMoreAnchor(event.currentTarget)}>
            <MoreVertIcon />
          </ToolKey>
          <HousingDivider />
          {inGame && isRoomHost ? (
            <ToolKey title="Restart" aria-label="Restart" onClick={() => exitToLobby()}>
              <ReplayIcon />
            </ToolKey>
          ) : null}
          <ToolKey
            title={online ? "Leave room" : "Home"}
            aria-label={online ? "Leave room" : "Home"}
            onClick={() => {
              // Leaving for real: hand the seat back rather than holding a
              // socket open behind the landing page.
              if (online) leaveOnlineRoom();
              setScreen("landing");
            }}
            sx={{ color: ui.red, "&:hover": { color: "#FF7A84", background: "rgba(255,78,91,0.12)" } }}
          >
            <LogoutIcon />
          </ToolKey>
        </Housing>
      </Box>

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
          data-testid="open-builder"
          onClick={() => {
            closeMore();
            onOpenBuilder();
          }}
        >
          <ListItemIcon>
            <EditNoteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Build a game</ListItemText>
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
        slotProps={{ paper: { sx: { minWidth: 320, maxWidth: 380, p: 2.5 } } }}
      >
        <Typography variant="overline">Settings</Typography>
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
        slotProps={{ paper: { sx: { minWidth: 320, maxWidth: 380, p: 2.5 } } }}
      >
        <Typography variant="overline">Players</Typography>
        <Box sx={{ mt: 1 }}>
          <PlayersPanel />
        </Box>
      </Popover>
    </Box>
  );
}

/**
 * Puts *this* tab on the television.
 *
 * It deliberately does not open a second one. A new tab is a new client with
 * no seat and no host chair, which makes for a board nobody standing at the
 * screen can actually run — and running it from the screen is the point.
 * Same client, same seat, same authority: plug this machine into the TV, or
 * cast the tab, and click the board where everyone can see it.
 *
 * A second screen is still had by sharing `?room=CODE&display=1`, which
 * joins as a spectator and watches.
 */
function DisplayButton() {
  const online = useGameStore((s) => s.online);
  const setDisplayMode = useGameStore((s) => s.setDisplayMode);
  if (!online) return null;
  return (
    <ToolKey
      title="TV mode"
      aria-label="Open display mode"
      data-testid="open-display"
      onClick={() => setDisplayMode(true)}
      // A phone is never the television, and the key it saves is what lets
      // the two housings share a line.
      sx={{ display: { xs: "none", sm: "inline-flex" } }}
    >
      <CastIcon />
    </ToolKey>
  );
}

/**
 * One key in the toolbar housing: a round well that lights when the pointer
 * is over it. Flat on purpose — five raised keys in a row is a keyboard,
 * and this is a strip of switches.
 */
function ToolKey({ title, sx, children, ...props }: IconButtonProps & { title: string }) {
  return (
    <Tooltip title={title}>
      <IconButton
        {...props}
        sx={[
          {
            width: { xs: 32, sm: 36 },
            height: { xs: 32, sm: 36 },
            borderRadius: "50%",
            color: ui.inkMuted,
            "&:hover": { color: ui.ink, background: "rgba(255,255,255,0.08)" },
            "& svg": { fontSize: 20 },
          },
          ...(Array.isArray(sx) ? sx : [sx ?? false]),
        ]}
      >
        {children}
      </IconButton>
    </Tooltip>
  );
}
