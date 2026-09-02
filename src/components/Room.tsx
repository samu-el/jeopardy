"use client";

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import { useGameStore } from "@/lib/state/game-store";
import { jeopardyPalette } from "@/lib/foundation/jeopardy-style";
import { Board } from "./Board";
import { Chat } from "./Chat";
import { ClueStage } from "./ClueStage";
import { ConnectionBanner } from "./ConnectionBanner";
import { ResultsView } from "./ResultsView";
import { AvatarHostController } from "./AvatarHostController";
import { Podium } from "./Podium";
import { RoomToolbar } from "./RoomToolbar";
import { RoundIntro } from "./RoundIntro";
import { CustomGameBuilder } from "./CustomGameBuilder";
import { EpisodeBrowser } from "./EpisodeBrowser";
import { GamePicker } from "./GamePicker";
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { Onboarding } from "./Onboarding";
import { TranscriptPane } from "./TranscriptPane";
import { ReplayView } from "./ReplayView";

export function Room() {
  const lobby = useGameStore((s) => s.lobby);
  const publicState = useGameStore((s) => s.publicState);
  const runtime = useGameStore((s) => s.runtime);
  const online = useGameStore((s) => s.online);
  const selfId = useGameStore((s) => s.selfId)();
  const exitToLobby = useGameStore((s) => s.exitToLobby);
  const reducedMotion = useGameStore((s) => s.preferences.reducedMotion);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [replayOpen, setReplayOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

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

  // The round title card is time-boxed by the room, so tick while it shows.
  const introEndsAt = publicState?.roundIntroEndsAt;
  useEffect(() => {
    if (!introEndsAt) return;
    const id = setInterval(() => setNow(Date.now()), 120);
    return () => clearInterval(id);
  }, [introEndsAt]);

  const showResults = publicState?.round === "complete";
  const introVisible = Boolean(introEndsAt && now < introEndsAt);

  // Before a game exists, show the lobby roster from local config so the
  // podiums aren't an empty row.
  const players = useMemo(
    () =>
      publicState && publicState.players.length > 0
        ? publicState.players
        : [
            {
              id: lobby.hostId,
              displayName: lobby.hostName,
              kind: "human" as const,
              connected: true,
              spectator: false,
              score: 0,
              emoji: lobby.hostEmoji,
              color: lobby.hostColor,
            },
            ...lobby.bots.map((bot) => ({
              id: bot.id,
              displayName: bot.name,
              kind: "ai-bot" as const,
              connected: true,
              spectator: false,
              score: 0,
              emoji: bot.emoji,
              color: bot.color,
            })),
            ...lobby.extraHumans.map((human) => ({
              id: human.id,
              displayName: human.name,
              kind: "human" as const,
              connected: true,
              spectator: false,
              score: 0,
              emoji: human.emoji,
              color: human.color,
            })),
          ],
    [publicState, lobby],
  );

  const previewState = useMemo(
    () => ({
      roomId: online?.roomId ?? "preview",
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
        autoAdvanceMs: 0,
        earlyBuzzLockoutMs: 0,
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
    [players, lobby.hostId, lobby.aiJudgeEnabled, lobby.bots.length, online?.roomId],
  );

  const toolbar = (
    <RoomToolbar
      onOpenPicker={() => setPickerOpen(true)}
      onOpenBrowser={() => setBrowserOpen(true)}
      onToggleShortcuts={() => setShortcutsOpen((value) => !value)}
      onToggleTranscript={() => setTranscriptOpen((value) => !value)}
      onOpenReplay={() => setReplayOpen(true)}
    />
  );

  if (showResults && publicState) {
    return (
      <Box sx={{ minHeight: "100vh", background: "#000" }}>
        <ConnectionBanner />
        <Box sx={{ maxWidth: 1400, mx: "auto", px: { xs: 2, md: 3 } }}>
          {toolbar}
          <ResultsView state={publicState} onPlayAgain={exitToLobby} onExit={exitToLobby} />
        </Box>
        <GamePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
        <EpisodeBrowser open={browserOpen} onClose={() => setBrowserOpen(false)} />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", background: "#000" }}>
      <ConnectionBanner />
      <Box sx={{ maxWidth: 1400, mx: "auto", px: { xs: 1.5, md: 3 } }}>
        {toolbar}

        <AvatarHostController />

        <Box
          sx={{
            display: "grid",
            gridTemplateRows: "minmax(0, 3fr) minmax(0, auto)",
            gap: 2,
          }}
        >
          <Box sx={{ position: "relative", width: "100%", maxWidth: 1240, mx: "auto" }}>
            <Board
              state={publicState}
              canPick={
                publicState
                  ? (publicState.pickerId === selfId ||
                      publicState.settings.hostId === selfId) &&
                    publicState.round !== "lobby" &&
                    publicState.round !== "complete" &&
                    !publicState.currentClue &&
                    !introVisible
                  : false
              }
              onPick={(clueId) => {
                runtime?.sendCommand(selfId, { type: "pick-clue", clueId });
              }}
              overlay={
                publicState?.currentClue ? (
                  <Box
                    role="dialog"
                    aria-label="Clue"
                    sx={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      background: jeopardyPalette.board,
                    }}
                  >
                    <ClueStage state={publicState} currentClientId={selfId} />
                  </Box>
                ) : undefined
              }
            />
            {publicState ? (
              <RoundIntro
                round={publicState.round}
                visible={introVisible}
                reducedMotion={reducedMotion}
              />
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
            {players.map((player) => (
              <Box key={player.id} sx={{ flex: "0 0 auto", width: { xs: 130, sm: 168 } }}>
                <Podium
                  player={player}
                  state={publicState ?? previewState}
                  isYou={player.id === selfId}
                  emoji={player.emoji ?? avatarFor(lobby, player.id)?.emoji}
                  color={player.color ?? avatarFor(lobby, player.id)?.color}
                />
              </Box>
            ))}
          </Box>
        </Box>

        {publicState || online ? (
          <Box sx={{ mt: 2 }}>
            <Chat />
          </Box>
        ) : null}
      </Box>

      <GamePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
      <EpisodeBrowser open={browserOpen} onClose={() => setBrowserOpen(false)} />
      <CustomGameBuilder open={builderOpen} onClose={() => setBuilderOpen(false)} />
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <TranscriptPane open={transcriptOpen} onClose={() => setTranscriptOpen(false)} />
      <ReplayView open={replayOpen} onClose={() => setReplayOpen(false)} />
      <Onboarding />
    </Box>
  );
}

/** Local avatar choices, used for seats the room state doesn't carry yet. */
function avatarFor(
  lobby: ReturnType<typeof useGameStore.getState>["lobby"],
  playerId: string,
): { emoji?: string; color?: string } | undefined {
  if (playerId === lobby.hostId) {
    return { emoji: lobby.hostEmoji, color: lobby.hostColor };
  }
  const bot = lobby.bots.find((candidate) => candidate.id === playerId);
  if (bot) return { emoji: bot.emoji, color: bot.color };
  const human = lobby.extraHumans.find((candidate) => candidate.id === playerId);
  if (human) return { emoji: human.emoji, color: human.color };
  return undefined;
}
