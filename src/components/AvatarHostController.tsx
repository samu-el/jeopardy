"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SpeakerNotesIcon from "@mui/icons-material/SpeakerNotesOutlined";
import { useGameStore } from "@/lib/state/game-store";
import {
  AvatarNarrator,
  findAvatarProfile,
  gameEventKey,
  spokenDurationEstimateMs,
} from "@/lib/runtime";
import {
  createVoiceAdapter,
  defaultAudioMix,
  installAudioUnlock,
  playSfx,
  setAudioMix,
  type AvatarHostCue,
} from "@/lib/ai";
import type { GameEvent, PublicGameState } from "@/lib/game";

const voiceAdapter = typeof window === "undefined" ? null : createVoiceAdapter();

/** The clue's own lines: dropped when the clue they belong to is gone. */
const clueLines: AvatarHostCue["type"][] = ["clue-selected", "clue-readout"];

/** How long a caption stays up after its line, so it doesn't sit over the podiums. */
const captionHoldMs = 6_000;

/** How many narrated event keys are remembered. */
const rememberedEvents = 200;

/**
 * Batches whose stings already sounded, and the events the host already
 * narrated. Kept at module scope: the controller remounts (results, display
 * mode), and a fresh instance must not replay what is still in the store.
 */
const processedBatches = new WeakSet<GameEvent[]>();
const narratedEvents = new Set<string>();

export function AvatarHostController() {
  const events = useGameStore((s) => s.lastEvents);
  const preferences = useGameStore((s) => s.preferences);
  const setLastCue = useGameStore((s) => s.setLastCue);
  const lastCue = useGameStore((s) => s.lastCue);
  const runtime = useGameStore((s) => s.runtime);
  const publicState = useGameStore((s) => s.publicState);
  const screen = useGameStore((s) => s.screen);

  const narratorRef = useRef<AvatarNarrator | null>(null);
  const mountedRef = useRef(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    if (narratorRef.current == null && typeof window !== "undefined") {
      narratorRef.current = new AvatarNarrator({
        voice: voiceAdapter,
        getProfile: () =>
          findAvatarProfile(useGameStore.getState().preferences.avatarHostProfileId),
        getMode: () => useGameStore.getState().preferences.avatarHostMode,
        getVoiceProfileId: () => useGameStore.getState().preferences.voiceProfileId,
        getSoundEnabled: () => useGameStore.getState().preferences.soundEnabled,
        getSpeechRate: () => useGameStore.getState().preferences.speechRate,
        // The buzzer follows the voice, not a guess made when the clue was
        // picked. Cues queue, so "Math, for 200" is still being said when the
        // estimate would otherwise open the buzzer — every cue that runs
        // ahead of the clue holds it shut.
        //
        // Held from the moment the cue is handed to the voice, not from when
        // it starts: a cue waiting its turn hasn't been read either, and a
        // buzzer that opened during that wait would be open before the clue.
        onCueQueued: (cue) => holdBuzzerFor(cue, "queued"),
        onCueStarted: (cue) => holdBuzzerFor(cue, "started"),
        onSpeakingChange: setSpeaking,
        // Only the clue itself finishing opens the buzzer.
        onCueSpoken: (cue) => {
          if (cue.type !== "clue-readout") return;
          const target = readoutTarget();
          if (!target) return;
          target.runtime.sendCommand(target.selfId, {
            type: "readout-complete",
            clueId: target.clueId,
          });
        },
      });
    }
    const removeUnlock = installAudioUnlock();
    return () => {
      removeUnlock();
      mountedRef.current = false;
      // Cancelling synchronously here would also fire during React
      // StrictMode's rehearsal unmount, and a synth.cancel() at that moment
      // can wedge Microsoft SAPI voices. Deferred a tick, a remount wins; a
      // real departure (Home, leaving the room) silences the host.
      setTimeout(() => {
        if (mountedRef.current) return;
        const state = useGameStore.getState();
        if (!state.runtime || state.screen === "landing" || !state.publicState) {
          narratorRef.current?.cancel();
        }
      }, 0);
    };
  }, []);

  // The player's sound settings drive the whole mix: mute, and a level each
  // for voice, effects and music.
  useEffect(() => {
    setAudioMix({
      muted: !preferences.soundEnabled,
      voice: preferences.voiceVolume ?? defaultAudioMix.voice,
      effects: preferences.effectsVolume ?? defaultAudioMix.effects,
      music: preferences.musicVolume ?? defaultAudioMix.music,
    });
  }, [
    preferences.soundEnabled,
    preferences.voiceVolume,
    preferences.effectsVolume,
    preferences.musicVolume,
  ]);

  // Muting, or turning the host off, stops the voice at once — not at the
  // end of the sentence.
  const soundEnabled = preferences.soundEnabled;
  const hostMode = preferences.avatarHostMode;
  const previousAudio = useRef({ soundEnabled, hostMode });
  useEffect(() => {
    const previous = previousAudio.current;
    previousAudio.current = { soundEnabled, hostMode };
    const narrator = narratorRef.current;
    if (!narrator) return;
    const muted = previous.soundEnabled && !soundEnabled;
    const hostOff = previous.hostMode !== "off" && hostMode === "off";
    if (muted || hostOff) narrator.cancel();
  }, [soundEnabled, hostMode]);

  // Leaving the room, or going back to the landing page, silences the host.
  useEffect(() => {
    if (runtime && screen !== "landing") return;
    narratorRef.current?.cancel();
  }, [runtime, screen]);

  // The room publishes its events and then its state. Stings play once per
  // batch, the moment it lands — never again when the state catches up. The
  // host's lines need that state (the clue's text arrives with it), so an
  // event that couldn't be narrated yet is retried when the state changes,
  // and one that was narrated is never said twice.
  useEffect(() => {
    const narrator = narratorRef.current;
    if (!narrator) return;
    const firstTime = !processedBatches.has(events);
    processedBatches.add(events);
    const soundOn = useGameStore.getState().preferences.soundEnabled;
    const playedInBatch = new Set<string>();
    for (const event of events) {
      const key = gameEventKey(event);
      if (firstTime) {
        if (event.type === "game-started" || event.type === "undo-applied") {
          narrator.resetEvents();
          narratedEvents.clear();
        }
        if (event.type === "clue-completed" || event.type === "round-advanced") {
          narrator.cancelIfSpeaking(clueLines);
        }
        const sfx = soundOn ? sfxForEvent(event) : null;
        // One batch can carry a timeout per player; the cue plays once.
        if (sfx && !playedInBatch.has(sfx)) {
          playedInBatch.add(sfx);
          playSfx(sfx);
        }
      }
      if (narratedEvents.has(key)) continue;
      const cue = handleEvent(narrator, event, publicState, key);
      if (!cue) continue;
      rememberKey(narratedEvents, key);
      // The stage already shows the clue; a caption of it would only cover
      // the podiums.
      if (cue.text && cue.type !== "clue-readout") setLastCue(cue);
    }
  }, [events, publicState, setLastCue]);

  const captionVisible = useCaptionTimer(lastCue, speaking);

  if (preferences.avatarHostMode === "off") return null;
  const showAvatar = preferences.avatarHostMode === "avatar-and-voice";
  const showCaption = preferences.subtitlesEnabled && Boolean(lastCue) && captionVisible;
  if (!showAvatar && !showCaption) return null;

  return (
    <Box
      data-testid="host-overlay"
      sx={{
        position: "fixed",
        // Phones: docked at the top, clear of the podiums and the buzzer.
        // Wider screens: the bottom corner, beside the board.
        top: { xs: "calc(env(safe-area-inset-top, 0px) + 8px)", sm: "auto" },
        bottom: { xs: "auto", sm: 16 },
        left: { xs: 8, sm: "auto" },
        right: { xs: 8, sm: 16 },
        maxWidth: { xs: "none", sm: 380 },
        zIndex: 1300,
        pointerEvents: "none",
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: "center",
          ...(showCaption
            ? {
                background: "linear-gradient(135deg, rgba(14,21,48,0.96), rgba(31,63,191,0.5))",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 2,
                p: { xs: 1, sm: 1.5 },
                boxShadow: 6,
              }
            : {}),
        }}
      >
        {showAvatar ? (
          <HostAvatar
            hint={lastCue?.animationHint ?? "idle"}
            speaking={speaking}
            reducedMotion={preferences.reducedMotion}
            label={findAvatarProfile(preferences.avatarHostProfileId).label}
          />
        ) : (
          <SpeakerNotesIcon fontSize="small" color="secondary" />
        )}
        {showCaption && lastCue ? (
          <Typography
            role="status"
            aria-live="polite"
            variant="body2"
            sx={{ color: "text.primary", fontSize: { xs: 13, sm: 14 } }}
          >
            {lastCue.text}
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}

/**
 * The avatar host: a small presenter badge that talks when the voice does
 * and reacts to the ruling. It's what makes "Avatar" more than "Voice".
 */
function HostAvatar({
  hint,
  speaking,
  reducedMotion,
  label,
}: {
  hint: NonNullable<AvatarHostCue["animationHint"]>;
  speaking: boolean;
  reducedMotion: boolean;
  label: string;
}) {
  const face = hint === "applaud" ? "😄" : hint === "thoughtful" ? "🤔" : hint === "lean-in" ? "🧐" : "🙂";
  const moving = !reducedMotion;
  return (
    <Box
      role="img"
      aria-label={`${label}${speaking ? ", speaking" : ""}`}
      data-testid="host-avatar"
      data-speaking={speaking ? "true" : "false"}
      data-hint={hint}
      sx={{
        width: 44,
        height: 44,
        flex: "0 0 auto",
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        fontSize: 26,
        lineHeight: 1,
        background: "radial-gradient(circle at 35% 30%, #3a5bd9, #0e1530 75%)",
        border: "2px solid",
        borderColor: speaking ? "secondary.main" : "rgba(255,255,255,0.25)",
        boxShadow: speaking ? "0 0 0 3px rgba(255,204,0,0.25)" : 2,
        transition: moving ? "border-color 150ms, box-shadow 150ms" : undefined,
        "@keyframes host-talk": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.06)" },
        },
        "@keyframes host-cheer": {
          "0%, 100%": { transform: "translateY(0)" },
          "40%": { transform: "translateY(-4px)" },
        },
        animation: moving
          ? speaking
            ? "host-talk 0.45s ease-in-out infinite"
            : hint === "applaud"
              ? "host-cheer 0.6s ease-out 2"
              : undefined
          : undefined,
      }}
    >
      <span aria-hidden>{face}</span>
    </Box>
  );
}

/** Keeps a caption up while it's being said and for a moment after. */
function useCaptionTimer(cue: AvatarHostCue | null, speaking: boolean): boolean {
  const [expiredFor, setExpiredFor] = useState<string | null>(null);
  const cueId = cue?.id ?? null;
  useEffect(() => {
    if (!cueId || speaking) return;
    const timer = setTimeout(() => setExpiredFor(cueId), captionHoldMs);
    return () => clearTimeout(timer);
  }, [cueId, speaking]);
  return cueId !== null && expiredFor !== cueId;
}

function rememberKey(set: Set<string>, key: string) {
  set.add(key);
  if (set.size > rememberedEvents) {
    const oldest = set.values().next().value;
    if (oldest !== undefined) set.delete(oldest);
  }
}

/**
 * How long a queued cue may take to reach the voice before the buzzer stops
 * waiting on it. Deliberately short: a browser with no installed voices
 * accepts `speak()` and then never says anything, and holding that for the
 * length of the clue would be seconds of dead air with a shut buzzer.
 */
const cueStartGraceMs = 2_500;

/**
 * Keeps the ring-in window shut for as long as this cue can still be talking
 * about the clue on screen. Only the clue's own cues count: the buzzer has to
 * stay shut while the host says "Math, for 200" and while the clue is read,
 * and `readout-complete` brings the deadline back to the real ending.
 */
function holdBuzzerFor(cue: AvatarHostCue, phase: "queued" | "started") {
  if (cue.type !== "clue-selected" && cue.type !== "clue-readout") return;
  const target = readoutTarget();
  if (!target) return;
  const holdMs =
    phase === "started"
      ? spokenDurationEstimateMs(cue.text, useGameStore.getState().preferences.speechRate)
      : cueStartGraceMs;
  target.runtime.sendCommand(target.selfId, {
    type: "extend-readout",
    clueId: target.clueId,
    endsAt: Date.now() + holdMs,
  });
}

/**
 * Only the room host paces the readout: every client speaks the clue at its
 * own rate, and the window has to open once, for everyone, at the same time.
 */
function readoutTarget() {
  const store = useGameStore.getState();
  const runtime = store.runtime;
  const clueId = store.publicState?.currentClue?.clueId;
  if (!runtime || !clueId) return null;
  const selfId = store.selfId();
  if (store.publicState?.settings.hostId !== selfId) return null;
  return { runtime, selfId, clueId };
}

function handleEvent(
  narrator: AvatarNarrator,
  event: GameEvent,
  state: PublicGameState | null,
  eventId: string,
): AvatarHostCue | null {
  if (!state) return null;
  switch (event.type) {
    case "game-started":
      return narrator.emit({ type: "intro" }, { eventId });
    case "round-advanced": {
      if (event.round === "final-jeopardy") {
        return narrator.emit({ type: "final-prompt" }, { eventId });
      }
      if (event.round === "complete") {
        const winner = [...state.players].sort((a, b) => b.score - a.score)[0];
        return narrator.emit(
          { type: "game-complete", context: { playerName: winner?.displayName } },
          { eventId },
        );
      }
      const categories = uniqueCategories(state);
      return narrator.emit(
        { type: "intro-categories", context: { round: event.round, categories } },
        { eventId },
      );
    }
    case "clue-picked": {
      // Real Jeopardy: host echoes "Science, four hundred" when the
      // player makes a selection — before reading the clue itself.
      const active = state.currentClue;
      // The state that names this clue hasn't arrived yet: try again when it does.
      if (active?.clueId !== event.clueId) return null;
      const category = active?.category;
      const value = active?.value;
      if (!category) return null;
      // Whatever the host was still saying is dropped: cues queue, so a pick
      // made during the category rundown would otherwise leave the clue
      // waiting behind it — read to a board whose buzzer already opened.
      return narrator.emit(
        { type: "clue-selected", context: { category, value } },
        { interruptQueue: true, eventId },
      );
    }
    case "clue-revealed": {
      const active = state.currentClue;
      if (active?.clueId !== event.clueId || !active.clue) return null;
      return narrator.emit(
        { type: "clue-readout", context: { clueText: active.clue, category: active.category } },
        { eventId },
      );
    }
    case "answer-judged": {
      const player = state.players.find((p) => p.id === event.targetPlayerId);
      if (event.correct === null) return null;
      return narrator.emit(
        {
          type: event.correct ? "answer-correct" : "answer-incorrect",
          context: { playerName: player?.displayName },
        },
        { eventId },
      );
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
