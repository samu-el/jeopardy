"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import FullscreenIcon from "@mui/icons-material/FullscreenOutlined";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExitOutlined";
import QrCodeIcon from "@mui/icons-material/QrCode2Outlined";
import CloseIcon from "@mui/icons-material/CloseOutlined";
import ExitIcon from "@mui/icons-material/CloseFullscreenOutlined";
import VolumeOffIcon from "@mui/icons-material/VolumeOffOutlined";
import VolumeUpIcon from "@mui/icons-material/VolumeUpOutlined";
import Button from "@mui/material/Button";
import QRCode from "qrcode";
import { primeAudio, primeSpeech } from "@/lib/ai";
import { useGameStore } from "@/lib/state/game-store";
import { jeopardyFonts, ui } from "@/lib/foundation/jeopardy-style";
import { AvatarHostController } from "./AvatarHostController";
import { GameSurface } from "./GameSurface";
import { TvResults } from "./TvResults";
import { useReducedMotion } from "./use-reduced-motion";

/** How long a TV waits on a silent connection before saying so. */
const connectPatienceMs = 12_000;
/** How often a TV pointed at a closed room checks whether it has opened. */
const closedRoomRetryMs = 10_000;
/** Height the join panel takes at the bottom, kept clear of the board. */
const joinStrip = "124px";

/** Remembered per television, so a hidden panel stays hidden after a reload. */
const joinPanelKey = "jeopardy.display.join-panel.v1";
const joinPanelListeners = new Set<() => void>();

function readJoinPanel(): boolean {
  try {
    return window.localStorage.getItem(joinPanelKey) !== "hidden";
  } catch {
    return true;
  }
}

function writeJoinPanel(visible: boolean) {
  try {
    window.localStorage.setItem(joinPanelKey, visible ? "shown" : "hidden");
  } catch {
    // A preference that won't persist is not worth failing over.
  }
  for (const listener of joinPanelListeners) listener();
}

/**
 * Read through `useSyncExternalStore` rather than an effect: the server has
 * no localStorage, so the panel renders shown on the server and switches on
 * the client without a hydration mismatch or a cascading render.
 */
function useJoinPanelVisible(): boolean {
  return useSyncExternalStore(
    (listener) => {
      joinPanelListeners.add(listener);
      return () => joinPanelListeners.delete(listener);
    },
    readJoinPanel,
    () => true,
  );
}

/**
 * The room on a television.
 *
 * It shows the same board the browser shows — the identical `GameSurface`,
 * not a second drawing of it — with the toolbar, chat and panels left off,
 * and sized to the screen it is standing on rather than to a desk.
 *
 * It is also a control surface, not a poster. Someone is at the screen with
 * a mouse or a fingertip: they click a tile, the clue fills the frame, a
 * click reveals the answer and a click puts the board back. Whether those
 * clicks are obeyed is the server's call — a screen that only came to watch
 * simply never gets offered them.
 */
export function DisplayView() {
  const publicState = useGameStore((s) => s.publicState);
  const online = useGameStore((s) => s.online);
  const screen = useGameStore((s) => s.screen);
  const setDisplayMode = useGameStore((s) => s.setDisplayMode);
  const joinAsDisplay = useGameStore((s) => s.joinAsDisplay);
  const soundEnabled = useGameStore((s) => s.preferences.soundEnabled);
  const reducedMotion = useReducedMotion();
  const setPreference = useGameStore((s) => s.setPreference);
  const [fullscreen, setFullscreen] = useState(false);
  const showJoinPreference = useJoinPanelVisible();
  // Only a tab that has a room behind it has somewhere to go back to. A
  // television opened from a link would land on the join form.
  const canExit = screen !== "landing";
  const roomClosed = online?.status === "rejected";
  const stalled = useStalledConnection(publicState === null && !roomClosed);
  const unreachable = roomClosed || stalled;
  // No QR for a room nobody can join.
  const showJoin = showJoinPreference && !unreachable && Boolean(online?.roomId);
  const complete = publicState?.round === "complete";

  // A closed room might just not be open yet — the host may still be on
  // their way. Keep checking rather than leaving a TV with no keyboard stuck.
  // Each refusal is a fresh `online` object, so this re-arms after every try.
  const closedAttempt = roomClosed ? online : null;
  useEffect(() => {
    if (!closedAttempt) return;
    const roomId = closedAttempt.roomId;
    const id = setTimeout(() => void joinAsDisplay(roomId), closedRoomRetryMs);
    return () => clearTimeout(id);
  }, [closedAttempt, joinAsDisplay]);

  useEffect(() => {
    function onChange() {
      setFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!canExit) return;
    function onKey(event: KeyboardEvent) {
      // Esc is the way out of every other full-screen thing, so it is the
      // way out of this one.
      if (event.key === "Escape") setDisplayMode(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canExit, setDisplayMode]);

  return (
    <Box
      data-testid="display-view"
      sx={{
        position: "fixed",
        inset: 0,
        background: "#000",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: showJoin ? "flex-start" : "center",
        px: { xs: 1, md: 2 },
        py: { xs: 1, md: 1.5 },
        // The whole screen, less the gutter — and less the strip the join
        // panel stands in, so it never sits across a tile. There are no
        // lecterns to leave room for; the board reads this and grows into
        // it, which is the whole of "fits the television".
        "--board-fill-height": showJoin
          ? `calc(100dvh - 24px - ${joinStrip})`
          : "calc(100dvh - 24px)",
        // Category names read from a sofa: bigger than a desk's 18px cap.
        "--board-category-scale": "1.4",
        "--board-category-max": "4.4vh",
      }}
    >
      {complete && publicState ? (
        <TvResults state={publicState} reducedMotion={reducedMotion} />
      ) : (
        /* The board, exactly as the browser draws it. */
        <GameSurface tv />
      )}
      {/* The screen with the speakers should be the one doing the talking. */}
      <AvatarHostController />

      {showJoin ? (
        <JoinPanel roomId={online?.roomId ?? null} onHide={() => writeJoinPanel(false)} />
      ) : null}

      {/* Kept faint and out of the way: a TV is for the board, but a display
          with no way back to its own controls is a display you have to
          reload to fix. */}
      <Stack
        direction="row"
        spacing={0.5}
        sx={{
          position: "fixed",
          bottom: 8,
          right: 8,
          zIndex: 20,
          opacity: 0.35,
          transition: "opacity 160ms",
          "&:hover, &:focus-within": { opacity: 1 },
        }}
      >
        {canExit ? (
          <Tooltip title="Leave TV mode (Esc)">
            <IconButton
              size="small"
              data-testid="exit-display"
              aria-label="Leave TV mode"
              onClick={() => setDisplayMode(false)}
              sx={{ color: "rgba(255,255,255,0.8)" }}
            >
              <ExitIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null}
        <Tooltip title={soundEnabled ? "Mute the TV" : "Turn on TV sound"}>
          <IconButton
            size="small"
            data-testid="display-sound"
            aria-label={soundEnabled ? "Mute the TV" : "Turn on TV sound"}
            aria-pressed={soundEnabled}
            onClick={() => {
              // The click is the gesture browsers want before any audio.
              if (!soundEnabled) {
                primeAudio();
                primeSpeech();
              }
              setPreference("soundEnabled", !soundEnabled);
            }}
            sx={{ color: "rgba(255,255,255,0.8)" }}
          >
            {soundEnabled ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        {!showJoin && !unreachable ? (
          <Tooltip title="Show the join code">
            <IconButton
              size="small"
              data-testid="show-join-panel"
              aria-label="Show the join code"
              onClick={() => writeJoinPanel(true)}
              sx={{ color: "rgba(255,255,255,0.8)" }}
            >
              <QrCodeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null}
        <Tooltip title={fullscreen ? "Leave fullscreen" : "Fullscreen"}>
          <IconButton
            size="small"
            data-testid="display-fullscreen"
            aria-label={fullscreen ? "Leave fullscreen" : "Go fullscreen"}
            onClick={() => {
              if (document.fullscreenElement) {
                void document.exitFullscreen().catch(() => {});
              } else {
                void document.documentElement.requestFullscreen().catch(() => {});
              }
            }}
            sx={{ color: "rgba(255,255,255,0.8)" }}
          >
            {fullscreen ? (
              <FullscreenExitIcon fontSize="small" />
            ) : (
              <FullscreenIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Stack>

      {unreachable ? (
        <RoomUnavailable
          roomId={online?.roomId ?? null}
          closed={roomClosed}
          onRetry={() => {
            if (online?.roomId) void joinAsDisplay(online.roomId);
          }}
          onLeave={() => {
            setDisplayMode(false);
            window.location.assign("/");
          }}
        />
      ) : publicState ? null : (
        <Typography
          data-testid="display-connecting"
          role="status"
          sx={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.7)",
            fontFamily: jeopardyFonts.display,
            letterSpacing: "0.2em",
            pointerEvents: "none",
          }}
        >
          CONNECTING…
        </Typography>
      )}
    </Box>
  );
}

/**
 * True once `waiting` has held for `connectPatienceMs` — a connection that
 * never produced a first snapshot. Clears as soon as `waiting` goes false.
 */
function useStalledConnection(waiting: boolean): boolean {
  const [stalledFor, setStalledFor] = useState<boolean | null>(null);
  useEffect(() => {
    if (!waiting) return;
    const id = setTimeout(() => setStalledFor(true), connectPatienceMs);
    return () => {
      clearTimeout(id);
      setStalledFor(null);
    };
  }, [waiting]);
  return waiting && stalledFor === true;
}

/**
 * What a television says when the room behind its link is not there: the
 * code it was given, that it keeps checking, and a way out.
 */
function RoomUnavailable({
  roomId,
  closed,
  onRetry,
  onLeave,
}: {
  roomId: string | null;
  closed: boolean;
  onRetry: () => void;
  onLeave: () => void;
}) {
  return (
    <Stack
      role="alert"
      data-testid="display-room-unavailable"
      spacing={2}
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 10,
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        background: "#000",
        px: 3,
      }}
    >
      <Typography
        component="h1"
        sx={{
          fontFamily: jeopardyFonts.display,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          fontSize: "clamp(24px, 5vh, 64px)",
          color: ui.ink,
        }}
      >
        {closed ? `Room ${roomId ?? ""} isn't open` : `Can't reach room ${roomId ?? ""}`}
      </Typography>
      <Typography sx={{ color: ui.inkMuted, fontSize: "clamp(16px, 2.6vh, 28px)", maxWidth: 820 }}>
        {closed
          ? "The game may have ended, or the host hasn't opened it yet. This screen keeps checking and shows the board as soon as the room opens."
          : "The connection isn't answering. This screen keeps trying."}
      </Typography>
      <Stack direction="row" spacing={2}>
        <Button variant="contained" onClick={onRetry} data-testid="display-retry">
          Try again
        </Button>
        <Button variant="outlined" onClick={onLeave} data-testid="display-leave">
          Leave
        </Button>
      </Stack>
    </Stack>
  );
}

/**
 * How to get in: the code, the URL, and a QR for phones.
 *
 * Bottom-left, in a strip the board leaves clear for it (see
 * `--board-fill-height` above): laid over the board, it covered a tile.
 */
function JoinPanel({ roomId, onHide }: { roomId: string | null; onHide: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const joinUrl =
    typeof window === "undefined" || !roomId
      ? ""
      : `${window.location.origin}/?room=${roomId}`;

  useEffect(() => {
    if (!joinUrl) return;
    let cancelled = false;
    QRCode.toDataURL(joinUrl, {
      margin: 1,
      width: 320,
      color: { dark: "#000000ff", light: "#ffffffff" },
    })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      // A missing QR is cosmetic: the code and the URL still work.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [joinUrl]);

  return (
    <Stack
      direction="row"
      spacing={2}
      data-testid="display-join"
      sx={{
        position: "fixed",
        bottom: 12,
        left: 16,
        maxHeight: `calc(${joinStrip} - 16px)`,
        alignItems: "center",
        background: ui.surface,
        border: `1px solid ${ui.line}`,
        borderRadius: 1,
        p: 1.5,
      }}
    >
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element -- a data: URI, nothing for the image loader to optimise
        <img
          src={qr}
          alt={`QR code to join room ${roomId}`}
          data-testid="display-qr"
          style={{ width: 80, height: 80, borderRadius: 6, background: "#fff" }}
        />
      ) : null}
      <Box>
        <Typography
          sx={{
            fontFamily: jeopardyFonts.display,
            fontSize: 13,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: ui.gold,
          }}
        >
          Play along
        </Typography>
        <Typography
          data-testid="display-room-code"
          sx={{
            fontFamily: jeopardyFonts.display,
            letterSpacing: "0.3em",
            fontSize: "clamp(24px, 2.6vw, 44px)",
            color: ui.ink,
            lineHeight: 1.15,
          }}
        >
          {roomId ?? "—"}
        </Typography>
        <Typography sx={{ fontSize: 13, color: ui.inkMuted }}>
          {joinUrl.replace(/^https?:\/\//, "")}
        </Typography>
      </Box>
      <Tooltip title="Hide the join code">
        <IconButton
          size="small"
          data-testid="hide-join-panel"
          aria-label="Hide the join code"
          onClick={onHide}
          sx={{ alignSelf: "flex-start" }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
