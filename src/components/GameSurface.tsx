"use client";

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import type { PublicGameState } from "@/lib/game";
import { useGameStore } from "@/lib/state/game-store";
import { jeopardyPalette } from "@/lib/foundation/jeopardy-style";
import { Board } from "./Board";
import { ClueStage } from "./ClueStage";
import { ClueControls, PodiumClueButtons } from "./ClueControls";
import { Podium } from "./Podium";
import { RoundIntro } from "./RoundIntro";
import { TvClue } from "./TvClue";

interface GameSurfaceProps {
  /**
   * Whether this screen offers the controls at all. The server still decides
   * who may actually pick — this only stops a screen from showing a button
   * it knows would be refused.
   */
  interactive?: boolean;
  /**
   * Television layout: the board fills the screen, and the clue becomes a
   * card you click through — question, answer, board — with no timer, buzzer
   * or judging on it.
   */
  tv?: boolean;
}

/**
 * The game itself: the board, the clue that covers it, the round title card
 * and the row of lecterns.
 *
 * Room wraps it in a toolbar and chat; a display shows it alone on a
 * television. It lives here so those two are the same thing rather than two
 * drawings of it — a board that looks different on the TV to the one in your
 * hand is a board people argue about.
 */
export function GameSurface({ interactive = true, tv = false }: GameSurfaceProps) {
  const lobby = useGameStore((s) => s.lobby);
  const publicState = useGameStore((s) => s.publicState);
  const runtime = useGameStore((s) => s.runtime);
  const online = useGameStore((s) => s.online);
  const selfId = useGameStore((s) => s.selfId)();
  const reducedMotion = useGameStore((s) => s.preferences.reducedMotion);
  const [now, setNow] = useState(() => Date.now());

  // The round title card is time-boxed by the room, so tick while it shows.
  const introEndsAt = publicState?.roundIntroEndsAt;
  useEffect(() => {
    if (!introEndsAt) return;
    const id = setInterval(() => setNow(Date.now()), 120);
    return () => clearInterval(id);
  }, [introEndsAt]);
  const introVisible = Boolean(introEndsAt && now < introEndsAt);

  // Contestants only. A spectator — a display on a TV, or someone watching —
  // has no score to show and no buzzer to light, so a lectern for them is
  // just an empty seat on the set.
  const players = useMemo(
    () =>
      publicState && publicState.players.length > 0
        ? publicState.players.filter((player) => !player.spectator)
        : [
            {
              id: lobby.hostId,
              displayName: lobby.hostName,
              score: 0,
              connected: true,
              kind: "human" as const,
              spectator: false,
              emoji: lobby.hostEmoji,
              color: lobby.hostColor,
            },
            ...lobby.extraHumans.map((human) => ({
              id: human.id,
              displayName: human.name,
              score: 0,
              connected: true,
              kind: "human" as const,
              spectator: false,
              emoji: human.emoji,
              color: human.color,
            })),
            ...lobby.bots.map((bot) => ({
              id: bot.id,
              displayName: bot.name,
              score: 0,
              connected: true,
              kind: "ai-bot" as const,
              spectator: false,
              emoji: bot.emoji,
              color: bot.color,
            })),
          ],
    [publicState, lobby],
  );

  const previewState = useMemo<PublicGameState>(
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
        aiAvatarHostEnabled: true,
        voiceProfileId: "",
        avatarHostProfileId: "",
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

  const canPick =
    interactive && publicState
      ? (publicState.pickerId === selfId || publicState.settings.hostId === selfId) &&
        publicState.round !== "lobby" &&
        publicState.round !== "complete" &&
        !publicState.currentClue &&
        !introVisible
      : false;

  // Revealing and closing a clue are the host's, and a room with no host set
  // is open to whoever is standing at it. This is the same test the engine
  // applies, asked early so the screen doesn't offer a refused click.
  const canControl =
    interactive && publicState
      ? !publicState.settings.hostId || publicState.settings.hostId === selfId
      : false;

  return (
    <Box
      sx={{
        display: "grid",
        // A television shows the board and nothing else: no lecterns, no
        // names, no scores. Whoever is playing is in the room and knows
        // who they are; the screen is for the clues.
        gridTemplateRows: tv ? "minmax(0, 1fr)" : "minmax(0, 3fr) minmax(0, auto)",
        gap: tv ? 0 : 1.5,
        ...(tv ? { height: "100%", alignContent: "center" } : null),
      }}
    >
      <Box
        sx={{
          position: "relative",
          width: "100%",
          maxWidth: tv ? "none" : 1240,
          mx: "auto",
        }}
      >
        <Board
          state={publicState}
          canPick={canPick}
          fill={tv}
          onPick={(clueId) => {
            if (!interactive) return;
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
                {tv ? (
                  <TvClue
                    state={publicState}
                    canControl={canControl}
                    onCommand={(command) => runtime?.sendCommand(selfId, command)}
                  />
                ) : (
                  <ClueStage state={publicState} />
                )}
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

      {tv ? null : (
      <Box>
      {/* Over the lecterns, under the board: the board carries the clue,
          this strip carries the clock and everything anyone presses. A
          television has neither — it is only ever the clue. */}
      {publicState ? (
        <ClueControls state={publicState} currentClientId={selfId} />
      ) : null}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: { xs: 1.5, sm: 2 },
          justifyContent: "center",
          alignItems: "flex-end",
          // An avatar sits proud of its lectern by half its own height, so
          // the row needs headroom or the badge lands on the clock above it.
          pt: 2.5,
          pb: 0,
        }}
      >
        {players.map((player) => (
          <Box
            key={player.id}
            sx={{
              flex: "0 0 auto",
              width: tv ? { xs: 150, sm: 210 } : { xs: 130, sm: 168 },
            }}
          >
            <Podium
              player={player}
              state={publicState ?? previewState}
              isYou={player.id === selfId}
              emoji={player.emoji ?? avatarFor(lobby, player.id)?.emoji}
              color={player.color ?? avatarFor(lobby, player.id)?.color}
              controls={
                interactive && publicState && player.id === selfId ? (
                  <PodiumClueButtons state={publicState} currentClientId={selfId} />
                ) : undefined
              }
              reserveControls={interactive && Boolean(publicState?.currentClue)}
            />
          </Box>
        ))}
      </Box>
      </Box>
      )}
    </Box>
  );
}

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
