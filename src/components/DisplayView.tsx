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
import QRCode from "qrcode";
import { useGameStore } from "@/lib/state/game-store";
import { jeopardyFonts, jeopardyPalette } from "@/lib/foundation/jeopardy-style";
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
 * not a second drawing of it — with the toolbar, chat and panels left off.
 * A display is a spectator: no seat, no buzzer, no commands.
 */
export function DisplayView() {
  const publicState = useGameStore((s) => s.publicState);
  const online = useGameStore((s) => s.online);
  const [fullscreen, setFullscreen] = useState(false);
  const showJoin = useJoinPanelVisible();

  useEffect(() => {
    function onChange() {
      setFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

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
        px: { xs: 1, md: 3 },
        py: { xs: 1, md: 2 },
      }}
    >
      {/* The board, exactly as the browser draws it. */}
      <GameSurface interactive={false} />

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
 * How to get in: the code, the URL, and a QR for phones. Floats over a
 * corner rather than taking a band across the top, so hiding it gives the
 * board the whole screen and nothing reflows when it goes.
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
        top: 16,
        left: 16,
        alignItems: "center",
        background: "rgba(0,0,0,0.65)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 2,
        p: 1.5,
        backdropFilter: "blur(6px)",
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
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.5)",
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
            color: jeopardyPalette.goldBright,
            lineHeight: 1.15,
          }}
        >
          {roomId ?? "—"}
        </Typography>
        <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          {joinUrl.replace(/^https?:\/\//, "")}
        </Typography>
      </Box>
      <Tooltip title="Hide the join code">
        <IconButton
          size="small"
          data-testid="hide-join-panel"
          aria-label="Hide the join code"
          onClick={onHide}
          sx={{ color: "rgba(255,255,255,0.5)", alignSelf: "flex-start" }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
