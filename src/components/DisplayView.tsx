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
import QRCode from "qrcode";
import { useGameStore } from "@/lib/state/game-store";
import { jeopardyFonts, ui } from "@/lib/foundation/jeopardy-style";
import { AvatarHostController } from "./AvatarHostController";
import { GameSurface } from "./GameSurface";

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
  const [fullscreen, setFullscreen] = useState(false);
  const showJoin = useJoinPanelVisible();
  // Only a tab that has a room behind it has somewhere to go back to. A
  // television opened from a link would land on the join form.
  const canExit = screen !== "landing";

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
        justifyContent: "center",
        px: { xs: 1, md: 2 },
        py: { xs: 1, md: 1.5 },
        // The whole screen, less the gutter. There are no lecterns to leave
        // room for — a television shows the board — and the board reads this
        // and grows into it, which is the whole of "fits the television":
        // cell type is sized from the board, so a board that fills the
        // screen is a clue you can read from a sofa.
        "--board-fill-height": "calc(100dvh - 24px)",
      }}
    >
      {/* The board, exactly as the browser draws it. */}
      <GameSurface tv />
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
          opacity: 0.25,
          transition: "opacity 160ms",
          "&:hover": { opacity: 1 },
        }}
      >
        {canExit ? (
          <Tooltip title="Leave TV mode (Esc)">
            <IconButton
              size="small"
              data-testid="exit-display"
              aria-label="Leave TV mode"
              onClick={() => setDisplayMode(false)}
              sx={{ color: "rgba(255,255,255,0.7)" }}
            >
              <ExitIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null}
        {!showJoin ? (
          <Tooltip title="Show the join code">
            <IconButton
              size="small"
              data-testid="show-join-panel"
              aria-label="Show the join code"
              onClick={() => writeJoinPanel(true)}
              sx={{ color: "rgba(255,255,255,0.7)" }}
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
            sx={{ color: "rgba(255,255,255,0.7)" }}
          >
            {fullscreen ? (
              <FullscreenExitIcon fontSize="small" />
            ) : (
              <FullscreenIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Stack>

      {publicState ? null : (
        <Typography
          data-testid="display-connecting"
          sx={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.5)",
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
 * How to get in: the code, the URL, and a QR for phones.
 *
 * Bottom-left, in the black beside the lecterns. A board that fills a
 * television leaves its margin at the bottom, not the top — up there this
 * sat across the first category.
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
        bottom: 16,
        left: 16,
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
          style={{ width: 84, height: 84, borderRadius: 6, background: "#fff" }}
        />
      ) : null}
      <Box>
        <Typography
          sx={{
            fontFamily: jeopardyFonts.display,
            fontSize: 11,
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
        <Typography sx={{ fontSize: 11, color: ui.inkFaint }}>
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
