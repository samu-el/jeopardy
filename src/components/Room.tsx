"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useGameStore } from "@/lib/state/game-store";
import { Board } from "./Board";
import { Chat } from "./Chat";
import { ClueStage } from "./ClueStage";
import { ResultsView } from "./ResultsView";
import { AvatarHostController } from "./AvatarHostController";
import { Podium } from "./Podium";
import { RoomToolbar } from "./RoomToolbar";
import { CustomGameBuilder } from "./CustomGameBuilder";
import { EpisodeBrowser } from "./EpisodeBrowser";
import { GamePicker } from "./GamePicker";

export function Room() {
  const lobby = useGameStore((s) => s.lobby);
  const publicState = useGameStore((s) => s.publicState);
  const runtime = useGameStore((s) => s.runtime);
  const exitToLobby = useGameStore((s) => s.exitToLobby);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);

  const showResults = publicState?.round === "complete";

  // Synthetic player when no game has started yet — solo by default
  const players = useMemo(
    () =>
      publicState?.players ?? [
        {
          id: lobby.hostId,
          displayName: lobby.hostName,
          kind: "human" as const,
          connected: true,
          spectator: false,
          score: 0,
        },
        ...lobby.bots.map((bot) => ({
          id: bot.id,
          displayName: bot.name,
          kind: "ai-bot" as const,
          connected: true,
          spectator: false,
          score: 0,
        })),
        ...lobby.extraHumans.map((human) => ({
          id: human.id,
          displayName: human.name,
          kind: "human" as const,
          connected: true,
          spectator: false,
          score: 0,
        })),
      ],
    [
      publicState?.players,
      lobby.hostId,
      lobby.hostName,
      lobby.bots,
      lobby.extraHumans,
    ],
  );

  const previewState = useMemo(
    () => ({
      roomId: "preview",
      round: "lobby" as const,
      serverTime: 0,
      players,
      board: [],
      settings: {
        allowMultipleCorrect: false,
        hostId: lobby.hostId,
        aiJudgeEnabled: lobby.aiJudgeEnabled,
        aiBotsEnabled: lobby.bots.length > 0,
        aiAvatarHostEnabled: false,
      },
      stats: {
        questionsStarted: 0,
        answeredByPlayer: {},
        correctByPlayer: {},
        incorrectByPlayer: {},
        firstBuzzByPlayer: {},
        reactionTimesByPlayer: {},
        dailyDoublesByPlayer: {},
      },
    }),
    [players, lobby.hostId, lobby.aiJudgeEnabled, lobby.bots.length],
  );

  const hasEpisode = Boolean(lobby.loadedEpisode || lobby.customGame);

  if (showResults && publicState) {
    return (
      <Box sx={{ minHeight: "100vh", background: "#000" }}>
        <Box sx={{ maxWidth: 1400, mx: "auto", px: { xs: 2, md: 3 } }}>
          <RoomToolbar
            onOpenPicker={() => setPickerOpen(true)}
            onOpenBrowser={() => setBrowserOpen(true)}
          />
          <ResultsView state={publicState} onPlayAgain={exitToLobby} onExit={exitToLobby} />
        </Box>
        <GamePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
        <EpisodeBrowser open={browserOpen} onClose={() => setBrowserOpen(false)} />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", background: "#000" }}>
      <Box sx={{ maxWidth: 1400, mx: "auto", px: { xs: 2, md: 3 } }}>
        <RoomToolbar
          onOpenPicker={() => setPickerOpen(true)}
          onOpenBrowser={() => setBrowserOpen(true)}
        />

        <AvatarHostController />

        <Box
          sx={{
            display: "grid",
            gridTemplateRows: "minmax(0, 3fr) minmax(0, 1fr)",
            gap: 2,
            minHeight: { md: "calc(100vh - 160px)" },
          }}
        >
          <Box sx={{ position: "relative", minHeight: 320 }}>
            <Box sx={{ width: "100%", maxWidth: 1200, mx: "auto" }}>
              {publicState ? (
                <Board
                  state={publicState}
                  canPick={
                    publicState.settings.hostId === lobby.hostId &&
                    publicState.round !== "lobby" &&
                    publicState.round !== "complete" &&
                    !publicState.currentClue
                  }
                  onPick={(clueId) => {
                    runtime?.sendCommand(lobby.hostId, { type: "pick-clue", clueId });
                  }}
                />
              ) : (
                <EmptyBoard hasEpisode={hasEpisode} onOpenPicker={() => setPickerOpen(true)} />
              )}
            </Box>
            {publicState?.currentClue ? (
              <Box
                role="dialog"
                sx={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(180deg, #060d2a 0%, #02061b 100%)",
                  zIndex: 2,
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 1,
                }}
              >
                <ClueStage state={publicState} currentClientId={lobby.hostId} />
              </Box>
            ) : null}
          </Box>

          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: `repeat(${Math.max(1, players.length)}, minmax(0, 1fr))`,
              alignItems: "end",
            }}
          >
            {players.map((player) => (
              <Podium
                key={player.id}
                player={player}
                state={publicState ?? previewState}
                isYou={player.id === lobby.hostId}
              />
            ))}
          </Box>
        </Box>

        {publicState ? <Box sx={{ mt: 2 }}><Chat /></Box> : null}
      </Box>

      <GamePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
      <EpisodeBrowser open={browserOpen} onClose={() => setBrowserOpen(false)} />
      <CustomGameBuilder open={builderOpen} onClose={() => setBuilderOpen(false)} />
    </Box>
  );
}

function EmptyBoard({
  hasEpisode,
  onOpenPicker,
}: {
  hasEpisode: boolean;
  onOpenPicker: () => void;
}) {
  return (
    <Box
      sx={{
        minHeight: 360,
        border: "1px dashed rgba(255,255,255,0.12)",
        borderRadius: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.5,
        p: 4,
      }}
    >
      <Typography variant="h5" sx={{ color: "rgba(255,255,255,0.8)" }}>
        {hasEpisode ? "Ready" : "Pick an episode"}
      </Typography>
      <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
        {hasEpisode
          ? "Press Begin to deal the board."
          : "Open the shuffle icon above to load a real Jeopardy! game."}
      </Typography>
      {!hasEpisode ? (
        <Box
          component="button"
          onClick={onOpenPicker}
          sx={{
            mt: 1,
            px: 3,
            py: 1,
            borderRadius: 999,
            border: "1px solid #5b8cff",
            background: "transparent",
            color: "#5b8cff",
            fontWeight: 700,
            cursor: "pointer",
            "&:hover": { background: "rgba(91,140,255,0.08)" },
          }}
        >
          Choose a game
        </Box>
      ) : null}
    </Box>
  );
}
