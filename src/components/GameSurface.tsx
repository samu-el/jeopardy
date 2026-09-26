"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import { createEmptyStats, type PublicGameState } from "@/lib/game";
import { buzzOrder, seatOrder } from "@/lib/game/clue-turn";
import { useGameStore } from "@/lib/state/game-store";
import { jeopardyPalette } from "@/lib/foundation/jeopardy-style";
import { Board } from "./Board";
import { ClueStage } from "./ClueStage";
import { ClueControls, PodiumClueButtons } from "./ClueControls";
import { Podium } from "./Podium";
import { RoundIntro } from "./RoundIntro";
import { TvClue } from "./TvClue";
import { GameAnnouncer } from "./GameAnnouncer";
import { mayTakeFocus } from "./clue/keyboard";
import { useReducedMotion } from "./use-reduced-motion";
import { useCompactPlay } from "./use-compact-play";

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
  const reducedMotion = useReducedMotion();
  const compact = useCompactPlay();
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
  const unordered = useMemo(
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

  // Lecterns stay where they were seated. The room sends players sorted by
  // score, which made a lectern jump sideways the moment a ruling landed.
  const [firstSeen, setFirstSeen] = useState<string[]>([]);
  const unseen = unordered.filter((player) => !firstSeen.includes(player.id));
  if (unseen.length > 0) setFirstSeen([...firstSeen, ...unseen.map((player) => player.id)]);
  const players = useMemo(() => seatOrder(unordered, firstSeen), [unordered, firstSeen]);
  const order = buzzOrder(publicState?.currentClue);

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
      stats: createEmptyStats(),
    }),
    [players, lobby.hostId, lobby.aiJudgeEnabled, lobby.bots.length, online?.roomId],
  );

  // Only whoever has the board picks. The host may stand in for a picker who
  // has dropped off — never for a bot, whose pick is already on its way.
  const picker = publicState?.players.find((player) => player.id === publicState.pickerId);
  const hostMayPick =
    publicState?.settings.hostId === selfId &&
    (!picker || (picker.kind === "human" && !picker.connected));
  const canPick =
    interactive && publicState
      ? (publicState.pickerId === selfId || hostMayPick) &&
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

  // Focus follows the clue: into it when it opens (unless you are typing
  // somewhere else), and back to the board when it closes.
  const clueRegionRef = useRef<HTMLDivElement | null>(null);
  const openClueId = publicState?.currentClue?.clueId;
  useEffect(() => {
    if (!openClueId || !interactive || tv) return;
    if (mayTakeFocus()) clueRegionRef.current?.focus({ preventScroll: true });
  }, [openClueId, interactive, tv]);

  const currentClue = publicState?.currentClue;
  const clueName = currentClue
    ? currentClue.round === "final-jeopardy"
      ? `Final Jeopardy: ${currentClue.category}`
      : currentClue.dailyDouble
        ? `${currentClue.category}, Daily Double`
        : `${currentClue.category}, $${currentClue.value}`
    : "Clue";
  const showBar = compact && interactive && !tv && Boolean(publicState?.currentClue);

  return (
    <Box
      data-game-surface
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
          returnFocus={interactive && !tv}
          onPick={(clueId) => {
            if (!interactive) return;
            runtime?.sendCommand(selfId, { type: "pick-clue", clueId });
          }}
          overlay={
            publicState?.currentClue ? (
              <Box
                ref={clueRegionRef}
                role="region"
                aria-label={clueName}
                tabIndex={-1}
                data-testid="clue-region"
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  background: jeopardyPalette.board,
                  outline: "none",
                  "&:focus-visible": { boxShadow: `inset 0 0 0 3px ${jeopardyPalette.goldBright}` },
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
      {publicState && interactive ? <GameAnnouncer state={publicState} selfId={selfId} /> : null}
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
                interactive && publicState && player.id === selfId && !compact ? (
                  <PodiumClueButtons state={publicState} currentClientId={selfId} />
                ) : undefined
              }
              reserveControls={interactive && !compact}
              buzzPosition={order.length > 1 && order.includes(player.id) ? order.indexOf(player.id) + 1 : undefined}
            />
          </Box>
        ))}
      </Box>
      {showBar && publicState ? (
        <>
          {/* Room under the last lectern, so the bar never covers it. */}
          <Box aria-hidden sx={{ height: "calc(84px + env(safe-area-inset-bottom, 0px))" }} />
          <Box
            data-testid="buzz-bar"
            sx={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1100,
              px: "max(12px, env(safe-area-inset-left, 0px))",
              pt: 1,
              pb: "max(10px, env(safe-area-inset-bottom, 0px))",
              background: "linear-gradient(180deg, rgba(3,4,20,0.6) 0%, rgba(3,4,20,0.96) 30%)",
              borderTop: "1px solid rgba(255,255,255,0.08)",
              // The keyboard is up and the answer is being typed: the bar
              // would only float over the field.
              "html[data-keyboard-open] &": { display: "none" },
              "&:empty": { display: "none" },
            }}
          >
            <PodiumClueButtons state={publicState} currentClientId={selfId} variant="bar" />
          </Box>
        </>
      ) : null}
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
