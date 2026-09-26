"use client";

import { useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArrowForwardIcon from "@mui/icons-material/ArrowForwardOutlined";
import EditNoteIcon from "@mui/icons-material/EditNoteOutlined";
import LoginIcon from "@mui/icons-material/LoginOutlined";
import { baselineBotProfiles } from "@/lib/ai/profiles";
import { primeAudio, primeSpeech } from "@/lib/ai";
import { defaultPlayerName, useGameStore } from "@/lib/state/game-store";
import { useSharedGameLink } from "@/lib/state/shared-game-link";
import {
  hasImpossibleCharacters,
  isCompleteRoomCode,
  parseInviteInput,
  roomCodeLength,
} from "@/lib/realtime/invite-code";
import { ui } from "@/lib/foundation/jeopardy-style";
import { CustomGameBuilder } from "./CustomGameBuilder";
import { Wordmark } from "./Wordmark";

const notOpenMessage = "That room isn't open. Check the code with the host, or start your own game.";
const unreachableMessage =
  "Couldn't reach the room service. Check your connection and try again.";
const slowMessage = "The room service is taking too long to answer. Try again in a moment.";
const joinTimeoutMs = 12_000;

/** The bot a first game gets when asked for one: the middle of the four tiers. */
const defaultBotProfile =
  baselineBotProfiles.find((profile) => profile.id === "casual") ?? baselineBotProfiles[0];

const visuallyHidden = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

/**
 * The name field shows what's typed until it's left, and only then stores
 * it: the store trims, and trimming per keystroke ate every space.
 */
function useNameField() {
  const hostName = useGameStore((s) => s.lobby.hostName);
  const setHostName = useGameStore((s) => s.setHostName);
  const [draft, setDraft] = useState<string | null>(null);
  const stored = hostName.trim() === "You" ? "" : hostName;
  const value = draft ?? stored;
  function commit() {
    if (draft === null) return;
    setHostName(draft);
    setDraft(null);
  }
  return { value, onChange: setDraft, commit };
}

export function Landing() {
  const pendingRoomId = useGameStore((s) => s.pendingRoomId);
  const hostId = useGameStore((s) => s.lobby.hostId);
  const hostName = useGameStore((s) => s.lobby.hostName);
  const bots = useGameStore((s) => s.lobby.bots);
  const online = useGameStore((s) => s.online);
  const setPendingRoomId = useGameStore((s) => s.setPendingRoomId);
  const setHostName = useGameStore((s) => s.setHostName);
  const setScreen = useGameStore((s) => s.setScreen);
  const leaveOnlineRoom = useGameStore((s) => s.leaveOnlineRoom);
  const addBot = useGameStore((s) => s.addBot);
  const removeBot = useGameStore((s) => s.removeBot);
  const joinOnlineRoom = useGameStore((s) => s.joinOnlineRoom);
  const startRandomGame = useGameStore((s) => s.startRandomGame);
  const sharedLink = useSharedGameLink();
  const name = useNameField();
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [dealing, setDealing] = useState(false);
  const [dealError, setDealError] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const joinErrorRef = useRef<HTMLDivElement>(null);

  const stillInRoom = online && online.status !== "rejected" ? online : null;
  const codeReady = isCompleteRoomCode(codeInput);
  const codeHint = hasImpossibleCharacters(codeInput)
    ? "Codes never use I, O, 0 or 1"
    : codeInput.length > 0 && codeInput.length < roomCodeLength
      ? `${roomCodeLength} characters`
      : " ";

  /** Hands back a seat still held from an earlier room, staying on this page. */
  function leaveLingeringRoom() {
    if (!stillInRoom) return;
    leaveOnlineRoom();
    setScreen("landing");
  }

  /** One click straight onto a board — no picker, no settings detour. */
  async function newGame() {
    primeAudio();
    primeSpeech();
    name.commit();
    // A new game is a new room, not a re-deal over whoever is left in the old one.
    leaveLingeringRoom();
    setDealing(true);
    setDealError(null);
    const result = await startRandomGame();
    if (!result.ok) {
      setDealError(result.error ?? "Could not start a game. Try again in a moment.");
      setDealing(false);
      return;
    }
    // startRandomGame moves to the play screen itself; this component unmounts.
  }

  function toggleBot(on: boolean) {
    if (on && bots.length === 0) addBot(defaultBotProfile);
    if (!on) for (const bot of bots) removeBot(bot.id);
  }

  /**
   * The code box opens the join card rather than joining outright, so the
   * one place that asks for a name is the same whichever way you arrived.
   */
  function openJoinCard() {
    if (!codeReady) return;
    setJoinError(null);
    setPendingRoomId(codeInput);
  }

  function cancelJoin() {
    setPendingRoomId(null);
    setJoinError(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("room");
      window.history.replaceState({}, "", url.toString());
    }
  }

  async function joinRoom(roomId: string) {
    const code = roomId.trim().toUpperCase();
    if (!code) return;
    primeAudio();
    primeSpeech();
    name.commit();
    setJoining(true);
    setJoinError(null);
    try {
      const outcome = await Promise.race([
        joinOnlineRoom(code),
        new Promise<"slow">((resolve) => setTimeout(() => resolve("slow"), joinTimeoutMs)),
      ]);
      if (outcome === "slow") {
        setJoinError(slowMessage);
        return;
      }
      if (!outcome) {
        // The store says why: a lookup that answered "no", or one that failed.
        const reason = useGameStore.getState().online?.error ?? "";
        setJoinError(/not open/i.test(reason) ? notOpenMessage : unreachableMessage);
        return;
      }
      setPendingRoomId(null);
    } catch {
      setJoinError(unreachableMessage);
    } finally {
      setJoining(false);
    }
  }

  // What the room will call you if you say nothing. Showing it beats a field
  // reading "You" over a room that calls you something else entirely.
  useEffect(() => {
    if (!pendingRoomId) return;
    const current = hostName.trim();
    if (!current || current === "You") setHostName(defaultPlayerName(hostId));
  }, [pendingRoomId, hostName, hostId, setHostName]);

  // A failed join moves focus to the reason, so it is heard as well as seen.
  useEffect(() => {
    if (joinError) joinErrorRef.current?.focus();
  }, [joinError]);

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        background: ui.stage,
        display: "flex",
        flexDirection: "column",
        pt: "env(safe-area-inset-top)",
        pb: "env(safe-area-inset-bottom)",
        pl: "env(safe-area-inset-left)",
        pr: "env(safe-area-inset-right)",
      }}
    >
      <Container maxWidth="lg" sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Everything on the centre line: the mark, the line under it, the
            keys, the three notes at the foot. */}
        <Box
          component="main"
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            py: { xs: 6, md: 8 },
          }}
        >
          <Stack spacing={{ xs: 3, md: 5 }} sx={{ maxWidth: 760, width: "100%", alignItems: "center" }}>
            <Typography component="h1" sx={{ m: 0, lineHeight: 0 }}>
              <Box component="span" sx={visuallyHidden}>
                Jeopardy!
              </Box>
              <Box component="span" aria-hidden="true">
                <Wordmark size="xl" />
              </Box>
            </Typography>

            {sharedLink.status === "loading" ? (
              <Alert severity="info" icon={<CircularProgress size={18} />} role="status">
                Loading shared game…
              </Alert>
            ) : null}
            {sharedLink.status === "error" ? (
              <Alert
                severity="error"
                role="alert"
                onClose={sharedLink.dismiss}
                data-testid="shared-game-error"
                sx={{ textAlign: "left", width: "100%", maxWidth: 560 }}
              >
                {sharedLink.error} Ask for a fresh link, or start a new game below.
              </Alert>
            ) : null}
            {stillInRoom && !pendingRoomId ? (
              <Alert
                severity="info"
                sx={{ textAlign: "left", width: "100%", maxWidth: 560 }}
                action={
                  <Stack direction="row" spacing={1}>
                    <Button color="inherit" size="small" onClick={() => setScreen("play")}>
                      Return
                    </Button>
                    <Button color="inherit" size="small" onClick={leaveLingeringRoom}>
                      Leave
                    </Button>
                  </Stack>
                }
              >
                You&rsquo;re still in room {stillInRoom.roomId}.
              </Alert>
            ) : null}

            {pendingRoomId ? (
              <Box
                component="form"
                role="dialog"
                aria-labelledby="join-card-title"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!joining) void joinRoom(pendingRoomId);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelJoin();
                  }
                }}
                sx={{
                  background: ui.surface,
                  border: `1px solid ${ui.line}`,
                  borderRadius: 1,
                  p: 3,
                  width: "100%",
                  maxWidth: 480,
                }}
              >
                <Typography variant="overline" component="h2" id="join-card-title">
                  Joining room
                </Typography>
                <Typography
                  component="p"
                  variant="h3"
                  sx={{ mt: 0.5, mb: 2, letterSpacing: "0.12em" }}
                >
                  {pendingRoomId}
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Your name"
                    fullWidth
                    autoFocus
                    value={name.value}
                    onChange={(event) => name.onChange(event.target.value)}
                    onBlur={name.commit}
                    onFocus={(event) => event.target.select()}
                    slotProps={{
                      htmlInput: {
                        maxLength: 40,
                        autoComplete: "nickname",
                        enterKeyHint: "go",
                        autoCapitalize: "words",
                      },
                    }}
                  />
                  {joinError ? (
                    <Typography
                      color="error"
                      variant="body2"
                      role="alert"
                      tabIndex={-1}
                      ref={joinErrorRef}
                      sx={{ outline: "none" }}
                    >
                      {joinError}
                    </Typography>
                  ) : null}
                  <Stack direction="row" spacing={1} sx={{ justifyContent: "center" }}>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={joining ? <CircularProgress size={16} /> : <LoginIcon />}
                      disabled={joining}
                    >
                      {joining ? "Joining…" : "Join"}
                    </Button>
                    <Button variant="text" onClick={cancelJoin}>
                      Cancel
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            ) : (
              <>
                <Typography
                  sx={{
                    color: ui.inkMuted,
                    fontSize: { xs: 18, md: 22 },
                    maxWidth: 560,
                    lineHeight: 1.4,
                  }}
                >
                  Play Jeopardy from the archive.
                </Typography>
                <Stack spacing={1.5} sx={{ alignItems: "center", width: "100%", maxWidth: 520 }}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    sx={{ alignItems: "center", justifyContent: "center", width: "100%" }}
                    component="form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!dealing) void newGame();
                    }}
                  >
                    <TextField
                      size="small"
                      label="Your name"
                      placeholder={defaultPlayerName(hostId)}
                      value={name.value}
                      onChange={(event) => name.onChange(event.target.value)}
                      onBlur={name.commit}
                      slotProps={{
                        htmlInput: {
                          maxLength: 40,
                          autoComplete: "nickname",
                          enterKeyHint: "go",
                          autoCapitalize: "words",
                        },
                        inputLabel: { shrink: true },
                      }}
                      sx={{ width: { xs: "100%", sm: 200 }, "& .MuiInputBase-root": { height: 48 } }}
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      data-testid="new-game"
                      endIcon={
                        dealing ? (
                          <CircularProgress size={18} sx={{ color: "inherit" }} />
                        ) : (
                          <ArrowForwardIcon />
                        )
                      }
                      disabled={dealing}
                      sx={{ px: 4, minHeight: 48, width: { xs: "100%", sm: "auto" } }}
                    >
                      {dealing ? "Dealing…" : "New Game"}
                    </Button>
                  </Stack>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={bots.length > 0}
                        onChange={(_, checked) => toggleBot(checked)}
                      />
                    }
                    label={
                      bots.length > 1
                        ? `Play against bots (${bots.length})`
                        : "Play against a bot"
                    }
                  />
                </Stack>

                <Box
                  component="form"
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    openJoinCard();
                  }}
                  sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}
                >
                  <TextField
                    size="small"
                    label="Room code"
                    value={codeInput}
                    helperText={codeHint}
                    error={hasImpossibleCharacters(codeInput)}
                    slotProps={{
                      htmlInput: {
                        "aria-label": "Room code",
                        autoCapitalize: "characters",
                        autoCorrect: "off",
                        autoComplete: "off",
                        spellCheck: false,
                        enterKeyHint: "go",
                      },
                    }}
                    onChange={(event) => setCodeInput(parseInviteInput(event.target.value))}
                    sx={{
                      width: 170,
                      "& .MuiInputBase-root": { height: 48 },
                      "& input": { letterSpacing: "0.2em", textTransform: "uppercase" },
                    }}
                  />
                  <Button
                    type="submit"
                    variant="outlined"
                    size="large"
                    startIcon={<LoginIcon />}
                    disabled={!codeReady}
                    sx={{ minHeight: 48 }}
                  >
                    Join
                  </Button>
                </Box>
                {dealError ? (
                  <Typography color="error" variant="body2" role="alert">
                    {dealError}
                  </Typography>
                ) : null}
                <Button
                  variant="text"
                  startIcon={<EditNoteIcon />}
                  onClick={() => setBuilderOpen(true)}
                  data-testid="landing-build"
                >
                  Build or import a game
                </Button>
              </>
            )}
          </Stack>
        </Box>

        <Box
          component="footer"
          sx={{ py: { xs: 4, md: 6 }, borderTop: `1px solid ${ui.line}` }}
        >
          <Box
            sx={{
              display: "grid",
              gap: 4,
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" },
              textAlign: "center",
            }}
          >
            <LandingFeature
              title="Every clue read aloud"
              body="Turn Sound on in Settings and the host reads the board."
            />
            <LandingFeature
              title="Bots that play"
              body="Tick “Play against a bot”, or add any of four tiers from Players. They buzz, answer and wager."
            />
            <LandingFeature
              title="Play with friends"
              body="Share the room code. Put the board on a TV."
            />
          </Box>
        </Box>
      </Container>
      <CustomGameBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onBeforeDeal={leaveLingeringRoom}
      />
    </Box>
  );
}

function LandingFeature({ title, body }: { title: string; body: string }) {
  return (
    <Stack spacing={1} sx={{ alignItems: "center" }}>
      <Typography variant="h6" component="h2" sx={{ fontSize: 17 }}>
        {title}
      </Typography>
      <Typography variant="body2">{body}</Typography>
    </Stack>
  );
}
