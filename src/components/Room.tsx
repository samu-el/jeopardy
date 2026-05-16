"use client";

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
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
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { Onboarding } from "./Onboarding";

export function Room() {
  const lobby = useGameStore((s) => s.lobby);
  const publicState = useGameStore((s) => s.publicState);
  const runtime = useGameStore((s) => s.runtime);
  const exitToLobby = useGameStore((s) => s.exitToLobby);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  if (showResults && publicState) {
    return (
      <Box sx={{ minHeight: "100vh", background: "#000" }}>
        <Box sx={{ maxWidth: 1400, mx: "auto", px: { xs: 2, md: 3 } }}>
          <RoomToolbar
            onOpenPicker={() => setPickerOpen(true)}
            onOpenBrowser={() => setBrowserOpen(true)}
            onToggleShortcuts={() => setShortcutsOpen((value) => !value)}
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
          onToggleShortcuts={() => setShortcutsOpen((value) => !value)}
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
              <Board
                state={publicState}
                canPick={
                  publicState
                    ? publicState.settings.hostId === lobby.hostId &&
                      publicState.round !== "lobby" &&
                      publicState.round !== "complete" &&
                      !publicState.currentClue
                    : false
                }
                onPick={(clueId) => {
                  runtime?.sendCommand(lobby.hostId, { type: "pick-clue", clueId });
                }}
              />
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
              display: "flex",
              flexWrap: "wrap",
              gap: { xs: 1.5, sm: 2 },
              justifyContent: "center",
              alignItems: "flex-end",
              py: 1,
            }}
          >
            {players.map((player) => {
              let emoji: string | undefined;
              let color: string | undefined;
              if (player.id === lobby.hostId) {
                emoji = lobby.hostEmoji;
                color = lobby.hostColor;
              } else {
                const bot = lobby.bots.find((b) => b.id === player.id);
                if (bot) {
                  emoji = bot.emoji;
                  color = bot.color;
                } else {
                  const human = lobby.extraHumans.find((h) => h.id === player.id);
                  if (human) {
                    emoji = human.emoji;
                    color = human.color;
                  }
                }
              }
              return (
                <Box key={player.id} sx={{ flex: "0 0 auto", width: { xs: 130, sm: 160 } }}>
                  <Podium
                    player={player}
                    state={publicState ?? previewState}
                    isYou={player.id === lobby.hostId}
                    emoji={emoji}
                    color={color}
                  />
                </Box>
              );
            })}
          </Box>
        </Box>

        {publicState ? <Box sx={{ mt: 2 }}><Chat /></Box> : null}
      </Box>

      <GamePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
      <EpisodeBrowser open={browserOpen} onClose={() => setBrowserOpen(false)} />
      <CustomGameBuilder open={builderOpen} onClose={() => setBuilderOpen(false)} />
      <ShortcutsOverlay
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <Onboarding />
    </Box>
  );
}

