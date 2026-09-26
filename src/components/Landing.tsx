"use client";

import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import dynamic from "next/dynamic";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import InputBase from "@mui/material/InputBase";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import ArrowForwardIcon from "@mui/icons-material/ArrowForwardOutlined";
import EditNoteIcon from "@mui/icons-material/EditNoteOutlined";
import LoginIcon from "@mui/icons-material/LoginOutlined";
import PersonIcon from "@mui/icons-material/PersonOutlined";
import SmartToyIcon from "@mui/icons-material/SmartToyOutlined";
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
import {
  controls,
  jeopardyFonts,
  jeopardyPalette,
  ui,
} from "@/lib/foundation/jeopardy-style";
import { appViewport } from "@/lib/foundation/viewport";
import { Wordmark } from "./Wordmark";

// The builder is a big form most visitors never open: load it on demand.
const CustomGameBuilder = dynamic(
  () => import("./CustomGameBuilder").then((m) => m.CustomGameBuilder),
  { ssr: false },
);

const notOpenMessage =
  "That room isn't open. Check the code with the host, or start your own game.";
const unreachableMessage =
  "Couldn't reach the room service. Check your connection and try again.";
const slowMessage =
  "The room service is taking too long to answer. Try again in a moment.";
const joinTimeoutMs = 12_000;

/** The bot a first game gets when asked for one: the middle of the four tiers. */
const defaultBotProfile =
  baselineBotProfiles.find((profile) => profile.id === "casual") ??
  baselineBotProfiles[0];

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
  /**
   * The join card starts out showing the name the room would give you, so
   * leaving it alone is no surprise. It is only a starting value: once the
   * field is cleared it stays cleared (the room still falls back to it).
   */
  const joinValue = (fallback: string) => draft ?? (stored || fallback);
  function commit() {
    if (draft === null) return;
    setHostName(draft);
    // An emptied field stays empty rather than snapping back to a default.
    setDraft(draft.trim() ? null : "");
  }
  return { value, joinValue, onChange: setDraft, commit };
}

const noSubscription = () => () => undefined;

/**
 * True while the address carries an invite (`?room=`) the shell hasn't turned
 * into a join card yet. For that first moment the page shows neither form,
 * so nothing typed lands in the New Game name field just before the join
 * card replaces it.
 */
function useInviteArriving(pendingRoomId: string | null): boolean {
  const urlHasRoom = useSyncExternalStore(
    noSubscription,
    () => new URLSearchParams(window.location.search).has("room"),
    () => false,
  );
  return urlHasRoom && !pendingRoomId;
}

export function Landing() {
  const pendingRoomId = useGameStore((s) => s.pendingRoomId);
  const hostId = useGameStore((s) => s.lobby.hostId);
  const bots = useGameStore((s) => s.lobby.bots);
  const online = useGameStore((s) => s.online);
  const setPendingRoomId = useGameStore((s) => s.setPendingRoomId);
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
  const [builderRequested, setBuilderRequested] = useState(false);
  const joinErrorRef = useRef<HTMLDivElement>(null);

  const inviteArriving = useInviteArriving(pendingRoomId);
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
        new Promise<"slow">((resolve) =>
          setTimeout(() => resolve("slow"), joinTimeoutMs),
        ),
      ]);
      if (outcome === "slow") {
        setJoinError(slowMessage);
        return;
      }
      if (!outcome) {
        // The store says which: no such room, or no answer from the server.
        const { online: failed } = useGameStore.getState();
        setJoinError(
          failed?.error ??
            (failed?.problem === "unreachable" ? unreachableMessage : notOpenMessage),
        );
        return;
      }
      setPendingRoomId(null);
    } catch {
      setJoinError(unreachableMessage);
    } finally {
      setJoining(false);
    }
  }

  // A failed join moves focus to the reason, so it is heard as well as seen.
  useEffect(() => {
    if (joinError) joinErrorRef.current?.focus();
  }, [joinError]);

  return (
    <Box
      sx={{
        // The shell owns <main> and the safe-area padding; this fills what's left.
        minHeight: appViewport.contentHeight,
        background: ui.stage,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Container
        maxWidth="lg"
        sx={{ flex: 1, display: "flex", flexDirection: "column" }}
      >
        {/* Everything on the centre line: the mark, the line under it, the
            keys, the three notes at the foot. */}
        <Box
          component="section"
          aria-labelledby="landing-title"
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
          <Stack
            spacing={{ xs: 3, md: 5 }}
            sx={{ maxWidth: 760, width: "100%", alignItems: "center" }}
          >
            <Typography component="h1" id="landing-title" sx={{ m: 0, lineHeight: 0 }}>
              {/* The mark is an image named "Jeopardy!", which names the heading. */}
              <Wordmark size="xl" />
            </Typography>

            {sharedLink.status === "loading" ? (
              <Alert
                severity="info"
                icon={<CircularProgress size={18} />}
                role="status"
              >
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
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => setScreen("play")}
                    >
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

            {inviteArriving ? null : pendingRoomId ? (
              <Box
                component="form"
                role="dialog"
                aria-label="Join room"
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
                    // What the room will call you if you say nothing. Cleared,
                    // the field stays cleared and this shows as the hint.
                    placeholder={defaultPlayerName(hostId)}
                    fullWidth
                    autoFocus
                    value={name.joinValue(defaultPlayerName(hostId))}
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
                      inputLabel: { shrink: true },
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
                      startIcon={
                        joining ? <CircularProgress size={16} /> : <LoginIcon />
                      }
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
                    fontSize: { xs: 17, md: 20 },
                    maxWidth: 560,
                    lineHeight: 1.45,
                  }}
                >
                  Thousands of real games from the archive. Play solo, against bots, or
                  with a room full of friends.
                </Typography>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr auto 1fr" },
                    gap: { xs: 2, md: 3 },
                    width: "100%",
                    maxWidth: 880,
                    alignItems: "stretch",
                    textAlign: "left",
                  }}
                >
                  <LandingPanel
                    tone="board"
                    eyebrow="Host"
                    title="Start a new game"
                    titleId="landing-host-title"
                    onSubmit={() => {
                      if (!dealing) void newGame();
                    }}
                  >
                    <LandingField label="Player name" htmlFor="landing-player-name">
                      <InputBase
                        id="landing-player-name"
                        placeholder={defaultPlayerName(hostId)}
                        value={name.value}
                        onChange={(event) => name.onChange(event.target.value)}
                        onBlur={name.commit}
                        inputProps={{
                          maxLength: 40,
                          autoComplete: "nickname",
                          enterKeyHint: "go",
                          autoCapitalize: "words",
                        }}
                        sx={fieldSx}
                      />
                    </LandingField>

                    <LandingField label="Opponents" id="landing-opponents-label">
                      <ToggleButtonGroup
                        exclusive
                        fullWidth
                        aria-labelledby="landing-opponents-label"
                        value={bots.length > 0 ? "bots" : "solo"}
                        onChange={(_, value: "solo" | "bots" | null) => {
                          if (value) toggleBot(value === "bots");
                        }}
                        sx={segmentedSx}
                      >
                        <ToggleButton value="solo" disableRipple>
                          <PersonIcon fontSize="small" />
                          Just me
                        </ToggleButton>
                        <ToggleButton value="bots" disableRipple>
                          <SmartToyIcon fontSize="small" />
                          {bots.length > 1 ? `${bots.length} bots` : "Add a bot"}
                        </ToggleButton>
                      </ToggleButtonGroup>
                    </LandingField>

                    <Button
                      type="submit"
                      data-testid="new-game"
                      disableElevation
                      disabled={dealing}
                      endIcon={
                        dealing ? (
                          <CircularProgress size={20} sx={{ color: "inherit" }} />
                        ) : (
                          <ArrowForwardIcon />
                        )
                      }
                      sx={goldCtaSx}
                    >
                      {dealing ? "Dealing…" : "New Game"}
                    </Button>
                    {dealError ? (
                      <Typography
                        role="alert"
                        variant="body2"
                        sx={{
                          color: ui.onRed,
                          background: ui.red,
                          px: 1.5,
                          py: 1,
                          borderRadius: "6px",
                        }}
                      >
                        {dealError}
                      </Typography>
                    ) : null}
                  </LandingPanel>

                  <Box
                    aria-hidden
                    sx={{
                      display: "flex",
                      flexDirection: { xs: "row", md: "column" },
                      alignItems: "center",
                      gap: 1.5,
                      color: ui.inkFaint,
                      fontFamily: jeopardyFonts.display,
                      fontSize: 14,
                      letterSpacing: "0.16em",
                    }}
                  >
                    <Box sx={dividerLineSx} />
                    OR
                    <Box sx={dividerLineSx} />
                  </Box>

                  <LandingPanel
                    tone="surface"
                    eyebrow="Join"
                    title="Join a room"
                    titleId="landing-join-title"
                    noValidate
                    onSubmit={openJoinCard}
                  >
                    <LandingField
                      label="Room code"
                      htmlFor="landing-room-code"
                      hint={
                        codeHint.trim()
                          ? codeHint
                          : "Ask the host for their 4-character code."
                      }
                      hintId="landing-room-code-hint"
                      error={hasImpossibleCharacters(codeInput)}
                    >
                      <InputBase
                        id="landing-room-code"
                        placeholder="ABCD"
                        value={codeInput}
                        onChange={(event) =>
                          setCodeInput(parseInviteInput(event.target.value))
                        }
                        error={hasImpossibleCharacters(codeInput)}
                        inputProps={{
                          "aria-describedby": "landing-room-code-hint",
                          "aria-invalid":
                            hasImpossibleCharacters(codeInput) || undefined,
                          autoCapitalize: "characters",
                          autoCorrect: "off",
                          autoComplete: "off",
                          spellCheck: false,
                          enterKeyHint: "go",
                        }}
                        sx={codeFieldSx}
                      />
                    </LandingField>
                    <Button
                      type="submit"
                      disableElevation
                      startIcon={<LoginIcon />}
                      disabled={!codeReady}
                      sx={joinCtaSx}
                    >
                      Join
                    </Button>
                  </LandingPanel>
                </Box>

                <Button
                  variant="text"
                  startIcon={<EditNoteIcon />}
                  onClick={() => {
                    setBuilderRequested(true);
                    setBuilderOpen(true);
                  }}
                  data-testid="landing-build"
                  sx={{
                    color: ui.inkMuted,
                    "&:hover": { color: ui.ink, background: ui.blueTint },
                  }}
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
              body="Pick “Add a bot”, or add any of four tiers from Players. They buzz, answer and wager."
            />
            <LandingFeature
              title="Play with friends"
              body="Share the room code. Put the board on a TV."
            />
          </Box>
        </Box>
      </Container>
      {builderRequested ? (
        <CustomGameBuilder
          open={builderOpen}
          onClose={() => setBuilderOpen(false)}
          onBeforeDeal={leaveLingeringRoom}
        />
      ) : null}
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

const focusRing = {
  outline: `3px solid ${ui.goldBright}`,
  outlineOffset: "2px",
} as const;

const fieldSx = {
  ...controls.readout,
  width: "100%",
  height: 52,
  px: 1.75,
  color: ui.ink,
  fontSize: 17,
  transition: "border-color 120ms, box-shadow 120ms",
  "&.Mui-focused": {
    borderColor: ui.goldBright,
    boxShadow: `inset 0 2px 6px rgba(0,0,0,0.65), 0 0 0 3px ${ui.goldTint}`,
  },
  "& input::placeholder": { color: ui.inkFaint, opacity: 1 },
} as const;

const codeFieldSx = {
  ...fieldSx,
  height: 64,
  "& input": {
    textAlign: "center",
    fontFamily: jeopardyFonts.display,
    fontSize: 32,
    fontWeight: 700,
    letterSpacing: "0.42em",
    // The trailing letter-space would push the code off centre.
    textIndent: "0.42em",
    textTransform: "uppercase",
  },
  "&.Mui-error": { borderColor: ui.red },
} as const;

const ctaBase = {
  height: 56,
  width: "100%",
  borderRadius: "10px",
  fontFamily: jeopardyFonts.display,
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  "&:focus-visible": focusRing,
  "&.Mui-disabled": { ...controls.keyOff, color: ui.inkFaint },
} as const;

/** Gold, like the dollar values on the board: the one thing to press. */
const goldCtaSx = {
  ...ctaBase,
  color: ui.onGold,
  background: `linear-gradient(180deg, ${ui.goldBright} 0%, ${ui.goldDeep} 100%)`,
  border: "1px solid rgba(255,230,160,0.6)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45), 0 6px 18px rgba(242,193,78,0.22)",
  "&:hover": {
    background: `linear-gradient(180deg, #FFD36A 0%, ${ui.goldBright} 100%)`,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 24px rgba(242,193,78,0.32)",
  },
  "&:active": { transform: "translateY(1px)" },
} as const;

const joinCtaSx = {
  ...ctaBase,
  ...controls.keyPrimary,
  "&.Mui-disabled": { ...controls.keyOff, color: ui.inkFaint },
} as const;

const segmentedSx = {
  ...controls.readout,
  p: "4px",
  gap: "4px",
  "& .MuiToggleButton-root": {
    flex: 1,
    gap: 1,
    height: 44,
    border: 0,
    borderRadius: "6px !important",
    color: ui.inkMuted,
    fontSize: 15,
    fontWeight: 600,
    textTransform: "none",
    "&:hover": { background: "rgba(255,255,255,0.06)", color: ui.ink },
    "&:focus-visible": focusRing,
    "&.Mui-selected": {
      ...controls.key,
      color: ui.ink,
      "&:hover": controls.key["&:hover"],
    },
  },
} as const;

const dividerLineSx = {
  flex: 1,
  width: { xs: "auto", md: "1px" },
  height: { xs: "1px", md: "auto" },
  background: ui.line,
} as const;

/** One of the two ways in: a card with its own form. */
function LandingPanel({
  tone,
  eyebrow,
  title,
  titleId,
  noValidate,
  onSubmit,
  children,
}: {
  tone: "board" | "surface";
  eyebrow: string;
  title: string;
  titleId: string;
  noValidate?: boolean;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <Box
      component="form"
      aria-labelledby={titleId}
      noValidate={noValidate}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 2.25,
        p: { xs: 2.5, sm: 3.5 },
        borderRadius: "16px",
        border: `1px solid ${tone === "board" ? "rgba(140,150,255,0.35)" : ui.line}`,
        background:
          tone === "board"
            ? `radial-gradient(120% 90% at 0% 0%, ${jeopardyPalette.board} 0%, ${jeopardyPalette.boardDeep} 45%, ${jeopardyPalette.boardShade} 100%)`
            : `linear-gradient(180deg, ${ui.surfaceRaised} 0%, ${ui.surface} 100%)`,
        boxShadow:
          tone === "board"
            ? "inset 0 1px 0 rgba(255,255,255,0.14), 0 20px 50px rgba(6,12,233,0.25)"
            : "inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
    >
      <Box>
        <Typography
          sx={{
            fontFamily: jeopardyFonts.display,
            color: ui.goldBright,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </Typography>
        <Typography
          component="h2"
          id={titleId}
          sx={{
            fontFamily: jeopardyFonts.display,
            color: ui.ink,
            fontSize: { xs: 26, sm: 30 },
            fontWeight: 700,
            lineHeight: 1.1,
            textTransform: "uppercase",
            letterSpacing: "0.02em",
          }}
        >
          {title}
        </Typography>
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2.25,
          flex: 1,
          justifyContent: "flex-end",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

/** A visible label over its control, plus an optional hint under it. */
function LandingField({
  label,
  htmlFor,
  id,
  hint,
  hintId,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  id?: string;
  hint?: string;
  hintId?: string;
  error?: boolean;
  children: ReactNode;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      <Box
        component={htmlFor ? "label" : "span"}
        htmlFor={htmlFor}
        id={id}
        sx={{
          color: ui.inkMuted,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </Box>
      {children}
      {hint ? (
        <Typography
          id={hintId}
          variant="caption"
          sx={{ color: error ? ui.red : ui.inkFaint, minHeight: "1.25em" }}
        >
          {hint}
        </Typography>
      ) : null}
    </Box>
  );
}
