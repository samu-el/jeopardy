"use client";

import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SpeakerNotesIcon from "@mui/icons-material/SpeakerNotesOutlined";
import { useGameStore } from "@/lib/state/game-store";
import { AvatarNarrator, findAvatarProfile } from "@/lib/runtime";
import { createVoiceAdapter, playSfx, type AvatarHostCue } from "@/lib/ai";
import type { GameEvent, PublicGameState } from "@/lib/game";

const voiceAdapter = typeof window === "undefined" ? null : createVoiceAdapter();

export function AvatarHostController() {
  const events = useGameStore((s) => s.lastEvents);
  const preferences = useGameStore((s) => s.preferences);
  const publicState = useGameStore((s) => s.publicState);
  const setLastCue = useGameStore((s) => s.setLastCue);
  const lastCue = useGameStore((s) => s.lastCue);

  const narratorRef = useRef<AvatarNarrator | null>(null);

  useEffect(() => {
    if (narratorRef.current == null && typeof window !== "undefined") {
      narratorRef.current = new AvatarNarrator({
        voice: voiceAdapter,
        getProfile: () =>
          findAvatarProfile(useGameStore.getState().preferences.avatarHostProfileId),
        getMode: () => useGameStore.getState().preferences.avatarHostMode,
        getVoiceProfileId: () => useGameStore.getState().preferences.voiceProfileId,
        getSoundEnabled: () => useGameStore.getState().preferences.soundEnabled,
        onCueSpoken: (cue) => {
          if (cue.type !== "clue-readout") return;
          const store = useGameStore.getState();
          const runtime = store.runtime;
          const currentClueId = store.publicState?.currentClue?.clueId;
          if (!runtime || !currentClueId) return;
          // Only the room host opens the buzzer early: every client reads the
          // clue at its own pace, and the window must open once for everyone.
          const selfId = store.selfId();
          if (store.publicState?.settings.hostId !== selfId) return;
          runtime.sendCommand(selfId, {
            type: "readout-complete",
            clueId: currentClueId,
          });
        },
      });
    }
    // Intentionally no cleanup: calling synth.cancel() during React StrictMode's
    // double-invoked cleanup can leave Microsoft SAPI voices in a wedged state
    // where subsequent speak() calls play silently. The queue drains naturally.
  }, []);

  useEffect(() => {
    if (!narratorRef.current) return;
    const soundEnabled = preferences.soundEnabled;
    const playedCues = new Set<string>();
    for (const event of events) {
      if (soundEnabled) {
        const sfx = sfxForEvent(event);
        // One batch can carry a timeout per player; the cue plays once.
        if (sfx && !playedCues.has(sfx)) {
          playedCues.add(sfx);
          playSfx(sfx);
        }
      }
      if (preferences.avatarHostMode === "off") continue;
      const cue = handleEvent(narratorRef.current, event, publicState);
      if (cue) setLastCue(cue);
    }
  }, [
    events,
    preferences.avatarHostMode,
    preferences.soundEnabled,
    publicState,
    setLastCue,
  ]);

  if (preferences.avatarHostMode === "off") return null;
  if (!lastCue) return null;

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        position: "fixed",
        bottom: 16,
        right: 16,
        maxWidth: 360,
        zIndex: 1300,
        pointerEvents: "none",
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: "flex-start",
          background: "linear-gradient(135deg, rgba(14,21,48,0.96), rgba(31,63,191,0.5))",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 2,
          p: 1.5,
          boxShadow: 6,
        }}
      >
        <SpeakerNotesIcon fontSize="small" color="secondary" />
        <Typography variant="body2" sx={{ color: "text.primary" }}>
          {lastCue.text}
        </Typography>
      </Stack>
    </Box>
  );
}

function handleEvent(
  narrator: AvatarNarrator,
  event: GameEvent,
  state: PublicGameState | null,
): AvatarHostCue | null {
  if (!state) return null;
  switch (event.type) {
    case "game-started":
      return narrator.emit({ type: "intro" });
    case "round-advanced": {
      if (event.round === "final-jeopardy") {
        return narrator.emit({ type: "final-prompt" });
      }
      if (event.round === "complete") {
        const winner = [...state.players].sort((a, b) => b.score - a.score)[0];
        return narrator.emit({
          type: "game-complete",
          context: { playerName: winner?.displayName },
        });
      }
      const categories = uniqueCategories(state);
      return narrator.emit({
        type: "intro-categories",
        context: { round: event.round, categories },
      });
    }
    case "clue-picked": {
      // Real Jeopardy: host echoes "Science, four hundred" when the
      // player makes a selection — before reading the clue itself.
      const active = state.currentClue;
      const category = active?.category;
      const value = active?.value;
      if (!category) return null;
      return narrator.emit({
        type: "clue-selected",
        context: { category, value },
      });
    }
    case "clue-revealed": {
      const active = state.currentClue;
      if (!active?.clue) return null;
      return narrator.emit({
        type: "clue-readout",
        context: { clueText: active.clue, category: active.category },
      });
    }
    case "answer-judged": {
      const player = state.players.find((p) => p.id === event.targetPlayerId);
      if (event.correct === true) {
        return narrator.emit({
          type: "answer-correct",
          context: { playerName: player?.displayName },
        });
      }
      if (event.correct === false) {
        return narrator.emit({
          type: "answer-incorrect",
          context: { playerName: player?.displayName },
        });
      }
      return null;
    }
    default:
      return null;
  }
}

function sfxForEvent(event: GameEvent): Parameters<typeof playSfx>[0] | null {
  switch (event.type) {
    case "buzz-accepted":
      return "buzz";
    case "answer-judged":
      if (event.correct === true) return "correct";
      if (event.correct === false) return "incorrect";
      return null;
    case "buzz-window-closed":
    case "answer-timed-out":
      return "timeout";
    case "round-advanced":
      return event.round === "complete" ? "applause" : "round-start";
    default:
      return null;
  }
}

function uniqueCategories(state: PublicGameState): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  for (const clue of state.board) {
    if (seen.has(clue.category)) continue;
    seen.add(clue.category);
    order.push(clue.category);
  }
  return order;
}
