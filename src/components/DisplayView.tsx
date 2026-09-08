"use client";

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import FullscreenIcon from "@mui/icons-material/FullscreenOutlined";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExitOutlined";
import QRCode from "qrcode";
import type { PublicActiveClueState } from "@/lib/game";
import { useGameStore } from "@/lib/state/game-store";
import { jeopardyFonts, jeopardyPalette } from "@/lib/foundation/jeopardy-style";
import { Board } from "./Board";
import { BuzzLights } from "./BuzzLights";

/**
 * The room on a television.
 *
 * A display is a spectator: it holds no seat, owns no buzzer, and sends no
 * commands. It shows the board everyone is looking at and the code they join
 * with, while the playing happens on phones. Everything here is sized to be
 * read across a room rather than at arm's length.
 */
export function DisplayView() {
  const publicState = useGameStore((s) => s.publicState);
  const online = useGameStore((s) => s.online);
  const [fullscreen, setFullscreen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    function onChange() {
      setFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // The lights run off the room's clock, so tick while a clue is open.
  const clueId = publicState?.currentClue?.clueId;
  useEffect(() => {
    if (!clueId) return;
    const id = setInterval(() => setNow(Date.now()), 120);
    return () => clearInterval(id);
  }, [clueId]);

  const active = publicState?.currentClue;
  const players = useMemo(
    () => (publicState?.players ?? []).filter((player) => !player.spectator),
    [publicState],
  );

  return (
    <Box
      data-testid="display-view"
      sx={{
        position: "fixed",
        inset: 0,
        background: "#000",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <DisplayChrome
        roomId={online?.roomId ?? null}
        fullscreen={fullscreen}
        onToggleFullscreen={() => {
          if (document.fullscreenElement) {
            void document.exitFullscreen().catch(() => {});
          } else {
            void document.documentElement.requestFullscreen().catch(() => {});
          }
        }}
      />

      <Box sx={{ flex: "1 1 auto", minHeight: 0, display: "flex", p: { xs: 1, md: 2 } }}>
        {active?.clue && !active.correctResponse ? (
          <DisplayClue clue={active} now={now} />
        ) : active?.correctResponse ? (
          <DisplayResponse clue={active} />
        ) : (
          <Box sx={{ flex: 1, minWidth: 0, display: "flex" }}>
            <Board state={publicState} canPick={false} />
          </Box>
        )}
      </Box>

      <DisplayScores players={players} state={publicState} />
    </Box>
  );
}

/** The clue, sized to be read from the sofa. */
function DisplayClue({ clue, now }: { clue: PublicActiveClueState; now: number }) {
  const category = clue.category;
  const value = clue.value;
  const text = clue.clue ?? "";
  const readoutEndsAt = clue.readoutEndsAt ?? now;
  const buzzWindowEndsAt = clue.buzzWindowEndsAt ?? now;
  const span = Math.max(1, buzzWindowEndsAt - readoutEndsAt);
  const remaining = Math.max(0, Math.min(1, (buzzWindowEndsAt - now) / span));
  // Long clues have to shrink or they run off a 16:9 screen; the steps keep
  // the type as large as the wordiest clue allows.
  const size = text.length > 220 ? "3.2cqw" : text.length > 120 ? "4.2cqw" : "5.4cqw";
  return (
    <Box
      data-testid="display-clue"
      sx={{
        flex: 1,
        containerType: "inline-size",
        borderRadius: 2,
        background: `linear-gradient(180deg, ${jeopardyPalette.board}, ${jeopardyPalette.boardShade})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        px: "6cqw",
        py: 4,
      }}
    >
      <Typography
        sx={{
          fontFamily: jeopardyFonts.display,
          color: jeopardyPalette.goldBright,
          letterSpacing: "0.18em",
          fontSize: "1.6cqw",
          mb: "2cqw",
        }}
      >
        {category} · ${value}
      </Typography>
      <Typography
        sx={{
          fontFamily: jeopardyFonts.display,
          textTransform: "uppercase",
          lineHeight: 1.22,
          fontSize: size,
          textShadow: "0 4px 10px rgba(0,0,0,0.55)",
        }}
      >
        {text}
      </Typography>
      <Box sx={{ mt: "3cqw" }}>
        <BuzzLights
          remaining={remaining}
          label={now < readoutEndsAt ? "Reading the clue" : "Time to ring in"}
        />
      </Box>
    </Box>
  );
}

/** What the answer was, once the room has been told. */
function DisplayResponse({ clue }: { clue: PublicActiveClueState }) {
  return (
    <Box
      data-testid="display-response"
      sx={{
        flex: 1,
        containerType: "inline-size",
        borderRadius: 2,
        background: `linear-gradient(180deg, ${jeopardyPalette.board}, ${jeopardyPalette.boardShade})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        px: "6cqw",
      }}
    >
      <Typography
        sx={{
          fontFamily: jeopardyFonts.display,
          color: jeopardyPalette.goldBright,
          letterSpacing: "0.18em",
          fontSize: "1.6cqw",
          mb: "2cqw",
        }}
      >
        {clue.category} · ${clue.value}
      </Typography>
      <Typography
        sx={{
          fontFamily: jeopardyFonts.display,
          textTransform: "uppercase",
          fontSize: "5cqw",
          color: jeopardyPalette.goldBright,
        }}
      >
        {clue.correctResponse}
      </Typography>
    </Box>
  );
}

/** Scores along the bottom, the way the set carries the lecterns. */
function DisplayScores({
  players,
  state,
}: {
  players: { id: string; displayName: string; score: number; connected: boolean }[];
  state: ReturnType<typeof useGameStore.getState>["publicState"];
}) {
  if (players.length === 0) return null;
  const buzzes = state?.currentClue?.buzzes ?? {};
  return (
    <Stack
      direction="row"
      spacing={2}
      data-testid="display-scores"
      sx={{
        px: { xs: 1, md: 3 },
        pb: { xs: 1, md: 2 },
        justifyContent: "center",
        alignItems: "stretch",
        flexWrap: "wrap",
        rowGap: 1,
      }}
    >
      {players.map((player) => {
        const rangIn = buzzes[player.id] !== undefined;
        return (
          <Box
            key={player.id}
            data-testid={`display-score-${player.id}`}
            sx={{
              minWidth: 180,
              px: 3,
              py: 1.5,
              borderRadius: 2,
              textAlign: "center",
              background: `linear-gradient(180deg, ${jeopardyPalette.podium}, #0a0d33)`,
              border: `2px solid ${rangIn ? jeopardyPalette.goldBright : jeopardyPalette.podiumEdge}`,
              boxShadow: rangIn ? `0 0 26px ${jeopardyPalette.goldBright}` : "none",
              opacity: player.connected ? 1 : 0.45,
            }}
          >
            <Typography
              sx={{
                fontSize: "clamp(13px, 1.4vw, 22px)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.8)",
              }}
            >
              {player.displayName}
            </Typography>
            <Typography
              sx={{
                fontFamily: jeopardyFonts.display,
                fontSize: "clamp(22px, 2.6vw, 46px)",
                color:
                  player.score < 0
                    ? jeopardyPalette.scoreNegative
                    : jeopardyPalette.scorePositive,
              }}
            >
              {player.score < 0 ? "-" : ""}${Math.abs(player.score).toLocaleString()}
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
}

/**
 * The join panel and the fullscreen control. The code is shown plainly here —
 * unlike the player view, a display exists to be read by the room it is in.
 */
function DisplayChrome({
  roomId,
  fullscreen,
  onToggleFullscreen,
}: {
  roomId: string | null;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
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
      // A missing QR is a cosmetic loss: the code and the URL still work.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [joinUrl]);

  return (
    <Stack
      direction="row"
      sx={{
        alignItems: "center",
        justifyContent: "space-between",
        px: { xs: 1.5, md: 3 },
        py: { xs: 1, md: 1.5 },
        gap: 2,
      }}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: "center", minWidth: 0 }}>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data: URI, nothing for the image loader to optimise
          <img
            src={qr}
            alt={`QR code to join room ${roomId}`}
            data-testid="display-qr"
            style={{ width: 92, height: 92, borderRadius: 6, background: "#fff" }}
          />
        ) : null}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: "clamp(11px, 1vw, 16px)",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            Play along — join with
          </Typography>
          <Typography
            data-testid="display-room-code"
            sx={{
              fontFamily: jeopardyFonts.display,
              letterSpacing: "0.3em",
              fontSize: "clamp(28px, 3.4vw, 64px)",
              color: jeopardyPalette.goldBright,
              lineHeight: 1.1,
            }}
          >
            {roomId ?? "—"}
          </Typography>
          <Typography
            sx={{
              fontSize: "clamp(10px, 0.9vw, 15px)",
              color: "rgba(255,255,255,0.45)",
              wordBreak: "break-all",
            }}
          >
            {joinUrl.replace(/^https?:\/\//, "")}
          </Typography>
        </Box>
      </Stack>

      <Tooltip title={fullscreen ? "Leave fullscreen" : "Fullscreen"}>
        <IconButton
          onClick={onToggleFullscreen}
          data-testid="display-fullscreen"
          aria-label={fullscreen ? "Leave fullscreen" : "Go fullscreen"}
          sx={{ color: "rgba(255,255,255,0.5)" }}
        >
          {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
