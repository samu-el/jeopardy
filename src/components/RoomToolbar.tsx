"use client";

import { useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton, { type IconButtonProps } from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import EditNoteIcon from "@mui/icons-material/EditNoteOutlined";
import Tooltip from "@mui/material/Tooltip";
import useMediaQuery from "@mui/material/useMediaQuery";
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
import { useGameStore } from "@/lib/state/game-store";
import { selectCanHost } from "@/lib/state/selectors";
import { primeAudio, primeSpeech } from "@/lib/ai";
import { controls, ui } from "@/lib/foundation/jeopardy-style";
import { Wordmark } from "./Wordmark";
import { RoomBar } from "./RoomBar";
import { Housing, HousingDivider } from "./Housing";
import CastIcon from "@mui/icons-material/CastOutlined";
import { AnchoredPanel } from "./AnchoredPanel";
import { SettingsPanel } from "./SettingsPanel";
import { PlayersPanel } from "./PlayersPanel";

interface RoomToolbarProps {
  onOpenPicker: () => void;
  onOpenBuilder: () => void;
  onToggleShortcuts: () => void;
  onToggleTranscript: () => void;
  onOpenReplay: () => void;
}

export function RoomToolbar({
  onOpenPicker,
  onOpenBuilder,
  onToggleShortcuts,
  onToggleTranscript,
  onOpenReplay,
}: RoomToolbarProps) {
  const goHome = useGameStore((s) => s.goHome);
  const startGame = useGameStore((s) => s.startGame);
  const lobby = useGameStore((s) => s.lobby);
  const publicState = useGameStore((s) => s.publicState);
  const runtime = useGameStore((s) => s.runtime);
  const exitToLobby = useGameStore((s) => s.exitToLobby);
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const [playersAnchor, setPlayersAnchor] = useState<HTMLElement | null>(null);
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const narrow = useMediaQuery("(max-width:599.95px)", { noSsr: true });
  const closeMore = () => setMoreAnchor(null);

  const online = useGameStore((s) => s.online);
  const isRoomHost = useGameStore(selectCanHost);
  const canBegin = Boolean(lobby.loadedEpisode || lobby.customGame) && isRoomHost;
  const inGame = Boolean(runtime && publicState && publicState.round !== "lobby");

  // Leaving for real: hand the seat back rather than holding a socket open
  // behind the landing page — asked first while a game is on. The wordmark
  // and the Leave key do the same.
  const leave = goHome;

  /** Everything the More key offers, in the order it offers it. */
  const moreItems: {
    label: string;
    icon: ReactNode;
    open: (anchor: HTMLElement) => void;
    testId?: string;
  }[] = [
    { label: "Players", icon: <PeopleIcon fontSize="small" />, open: setPlayersAnchor },
    {
      label: "Build a game",
      icon: <EditNoteIcon fontSize="small" />,
      open: onOpenBuilder,
      testId: "open-builder",
    },
    { label: "Transcript", icon: <HistoryIcon fontSize="small" />, open: onToggleTranscript },
    { label: "Replay last game", icon: <ReplayIconAlt fontSize="small" />, open: onOpenReplay },
    { label: "Shortcuts", icon: <KeyboardIcon fontSize="small" />, open: onToggleShortcuts },
  ];
  // A phone has room for three 44px keys beside the room code, not five:
  // the host's two less frequent ones move into More.
  if (narrow && isRoomHost) {
    moreItems.unshift({ label: "Change game", icon: <ShuffleIcon fontSize="small" />, open: onOpenPicker });
    if (inGame) {
      moreItems.push({
        label: "Restart",
        icon: <ReplayIcon fontSize="small" />,
        open: () => setConfirmRestart(true),
      });
    }
  }

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
        <Tooltip title={online ? "Leave room and go home" : "Home"}>
          <Box
            component="button"
            onClick={leave}
            aria-label={online ? "Leave room and go home" : "Home"}
            sx={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              p: 0,
              display: "inline-flex",
              alignItems: "center",
              minHeight: 44,
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
          {isRoomHost && !narrow ? (
            <ToolKey title="Change game" aria-label="Change game" data-testid="change-game" onClick={onOpenPicker}>
              <ShuffleIcon />
            </ToolKey>
          ) : null}
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
          {inGame && isRoomHost && !narrow ? (
            <ToolKey title="Restart" aria-label="Restart" onClick={() => setConfirmRestart(true)}>
              <ReplayIcon />
            </ToolKey>
          ) : null}
          <ToolKey
            title={online ? "Leave room" : "Home"}
            aria-label={online ? "Leave room" : "Home"}
            onClick={leave}
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
        {moreItems.map((item) => (
          <MenuItem
            key={item.label}
            data-testid={item.testId}
            onClick={(event) => {
              closeMore();
              item.open(event.currentTarget);
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText>{item.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      <Dialog
        open={confirmRestart}
        onClose={() => setConfirmRestart(false)}
        aria-labelledby="restart-title"
        aria-describedby="restart-text"
      >
        <DialogTitle id="restart-title">Restart the game?</DialogTitle>
        <DialogContent>
          <DialogContentText id="restart-text">
            Every score goes back to $0 and the board is dealt again, for everyone in the room.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRestart(false)} autoFocus>
            Keep playing
          </Button>
          <Button
            color="error"
            data-testid="confirm-restart"
            onClick={() => {
              setConfirmRestart(false);
              if (isRoomHost) exitToLobby();
            }}
          >
            Restart
          </Button>
        </DialogActions>
      </Dialog>

      <AnchoredPanel title="Settings" anchor={settingsAnchor} onClose={() => setSettingsAnchor(null)}>
        <SettingsPanel />
      </AnchoredPanel>

      <AnchoredPanel title="Players" anchor={playersAnchor} onClose={() => setPlayersAnchor(null)}>
        <PlayersPanel />
      </AnchoredPanel>
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
            width: { xs: 36, sm: 36 },
            height: { xs: 36, sm: 36 },
            // A finger needs 44px, whatever the screen width.
            "@media (pointer: coarse)": { width: 44, height: 44 },
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
