"use client";

import { useEffect, useMemo, useRef } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SpeakerNotesIcon from "@mui/icons-material/SpeakerNotesOutlined";
import { useGameStore } from "@/lib/state/game-store";
import { AvatarNarrator, findAvatarProfile } from "@/lib/runtime";
import { createVoiceAdapter, type AvatarHostCue } from "@/lib/ai";
import type { GameEvent, PublicGameState } from "@/lib/game";

const voiceAdapter = typeof window === "undefined" ? null : createVoiceAdapter();

export function AvatarHostController() {
  const events = useGameStore((s) => s.lastEvents);
  const preferences = useGameStore((s) => s.preferences);
  const publicState = useGameStore((s) => s.publicState);
  const setLastCue = useGameStore((s) => s.setLastCue);
  const lastCue = useGameStore((s) => s.lastCue);
  const profile = useMemo(
    () => findAvatarProfile(preferences.avatarHostProfileId),
    [preferences.avatarHostProfileId],
  );

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
      });
    }
    return () => {
      narratorRef.current?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!narratorRef.current) return;
    if (preferences.avatarHostMode === "off") return;
    for (const event of events) {
      const cue = handleEvent(narratorRef.current, event, publicState);
      if (cue) setLastCue(cue);
    }
  }, [events, preferences.avatarHostMode, publicState, setLastCue]);

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
      <Box
        sx={{
          background: "linear-gradient(135deg, rgba(14,21,48,0.96), rgba(31,63,191,0.5))",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 2,
          p: 1.5,
          boxShadow: 6,
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
          <SpeakerNotesIcon fontSize="small" color="secondary" />
          <Chip
            label={profile.label}
            size="small"
            sx={{ fontWeight: 700 }}
            color="secondary"
            variant="outlined"
          />
          <Typography variant="caption" color="text.secondary">
            {preferences.avatarHostMode === "voice-only" ? "voice" : "avatar"}
          </Typography>
        </Stack>
        <Typography variant="body2" sx={{ color: "text.primary" }}>
          {lastCue.text}
        </Typography>
      </Box>
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
    case "round-advanced":
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
      return narrator.emit({
        type: "round-advance",
        context: { round: event.round },
      });
    case "clue-revealed": {
      const active = state.currentClue;
      if (!active?.clue) return null;
      return narrator.emit({
        type: "clue-readout",
        context: { clueText: active.clue, category: active.category },
      });
    }
    case "buzz-accepted": {
      const player = state.players.find((p) => p.id === event.actorId);
      const first = Object.keys(state.currentClue?.buzzes ?? {}).length === 1;
      if (!first) return null;
      return narrator.emit({
        type: "buzzer-unlocked",
        context: { playerName: player?.displayName },
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
