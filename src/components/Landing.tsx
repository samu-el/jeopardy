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
} from "@/lib/realtime/invite-code";
import {
  boardGradient,
  controls,
  displayType,
  jeopardyFonts,
  jeopardyPalette,
  jeopardyTextShadow,
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
  "That room isn’t open. Check the code with the host, or start your own game.";
const unreachableMessage =
  "Couldn’t reach the room service. Check your connection and try again.";
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
  const codeError = hasImpossibleCharacters(codeInput)
    ? "Codes never use I, O, 0 or 1"
    : undefined;

  /** Hands back a seat still held from an earlier room, staying on this page. */
  function leaveLingeringRoom() {
    if (!stillInRoom) return;
    leaveOnlineRoom();
    setScreen("landing");
  }

  /** One click straight onto a board: no picker, no settings detour. */
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
        sx={{ flex: 1, display: "flex", flexDirection: "column", py: { xs: 2, md: 4 } }}
      >
        {/* Wide screens: the board-blue field with the mark on the left, the
            ways in on the right. Phones: the field is a band on top. */}
        <Box
          component="section"
          aria-labelledby="landing-title"
          sx={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              md: "minmax(0, 1fr) minmax(0, 380px)",
            },
            columnGap: { md: 6, lg: 8 },
            rowGap: { xs: 3, md: 0 },
            alignItems: "stretch",
          }}
        >
          {/* The board itself, before a game is dealt: the mark across the
              category row, the five values under it. On a phone, only the mark. */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
              gridTemplateRows: { xs: "minmax(132px, auto)", md: "1.4fr repeat(5, 1fr)" },
              gap: { xs: 0, md: "6px" },
              p: { xs: 0, md: "6px" },
              minHeight: { md: 560 },
              borderRadius: `${ui.radiusPanel}px`,
              overflow: "hidden",
              background: jeopardyPalette.gap,
            }}
          >
            <Box
              sx={{
                gridColumn: "1 / -1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                px: 2,
                py: { xs: 3, md: 2 },
                background: boardGradient,
                borderRadius: { md: `${ui.radiusPanel - 6}px ${ui.radiusPanel - 6}px 0 0` },
              }}
            >
              <Typography component="h1" id="landing-title" sx={{ m: 0, lineHeight: 0 }}>
                {/* The mark is an image named "Jeopardy!", which names the heading. */}
                <Wordmark size="xl" tone="board" />
              </Typography>
            </Box>
            {boardValues.map((value) =>
              Array.from({ length: 6 }, (_, column) => (
                <Box
                  key={`${value}-${column}`}
                  aria-hidden
                  sx={{
                    display: { xs: "none", md: "flex" },
                    alignItems: "center",
                    justifyContent: "center",
                    background: boardGradient,
                    ...displayType({
                      fontWeight: 700,
                      fontSize: "clamp(18px, 2.1vw, 34px)",
                      color: jeopardyPalette.goldDeep,
                      textShadow: jeopardyTextShadow,
                    }),
                  }}
                >
                  ${value}
                </Box>
              )),
            )}
          </Box>

          <Stack
            spacing={3}
            sx={{
              width: "100%",
              maxWidth: { xs: 440, md: "none" },
              justifySelf: "center",
              justifyContent: "center",
              py: { md: 2 },
            }}
          >
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
                sx={{ textAlign: "left", width: "100%" }}
              >
                {sharedLink.error} Ask for a fresh link, or start a new game below.
              </Alert>
            ) : null}
            {stillInRoom && !pendingRoomId ? (
              <Alert
                severity="info"
                sx={{ textAlign: "left", width: "100%" }}
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
                className="landing-panel"
                sx={sectionSx}
              >
                <Typography component="h2" id="join-card-title" sx={headSx}>
                  Join a room
                </Typography>
                {/* The code as its own readout, the way the TV shows it. */}
                <Box
                  data-testid="join-card-code"
                  sx={{
                    ...controls.readout,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 56,
                    fontFamily: jeopardyFonts.display,
                    fontWeight: 700,
                    fontSize: 28,
                    color: ui.goldBright,
                    letterSpacing: "0.3em",
                    textIndent: "0.3em",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {pendingRoomId}
                </Box>
                <LandingField label="Your name" htmlFor="join-card-name">
                  <InputBase
                    id="join-card-name"
                    className="landing-field"
                    // What the room will call you if you say nothing. Cleared,
                    // the field stays cleared and this shows as the hint.
                    placeholder={defaultPlayerName(hostId)}
                    autoFocus
                    value={name.joinValue(defaultPlayerName(hostId))}
                    onChange={(event) => name.onChange(event.target.value)}
                    onBlur={name.commit}
                    onFocus={(event) => event.target.select()}
                    inputProps={{
                      maxLength: 40,
                      autoComplete: "nickname",
                      enterKeyHint: "go",
                      autoCapitalize: "words",
                    }}
                    sx={fieldSx}
                  />
                </LandingField>
                {joinError ? (
                  <Typography
                    variant="body2"
                    role="alert"
                    tabIndex={-1}
                    ref={joinErrorRef}
                    sx={errorSx}
                  >
                    {joinError}
                  </Typography>
                ) : null}
                <Stack spacing={1}>
                  <Button
                    type="submit"
                    disableElevation
                    className="landing-cta"
                    startIcon={
                      joining ? (
                        <CircularProgress size={18} sx={{ color: "inherit" }} />
                      ) : (
                        <LoginIcon />
                      )
                    }
                    disabled={joining}
                    sx={primaryCtaSx}
                  >
                    {joining ? "Joining…" : "Join"}
                  </Button>
                  <Button variant="text" onClick={cancelJoin} sx={{ minHeight: 44 }}>
                    Cancel
                  </Button>
                </Stack>
              </Box>
            ) : (
              <>
                <LandingPanel
                  title="Start a new game"
                  titleId="landing-host-title"
                  onSubmit={() => {
                    if (!dealing) void newGame();
                  }}
                >
                  <LandingField label="Player name" htmlFor="landing-player-name">
                    <InputBase
                      id="landing-player-name"
                      className="landing-field"
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
                    className="landing-cta"
                    sx={primaryCtaSx}
                  >
                    {dealing ? "Dealing…" : "New Game"}
                  </Button>
                  {dealError ? (
                    <Typography role="alert" variant="body2" sx={errorSx}>
                      {dealError}
                    </Typography>
                  ) : null}
                </LandingPanel>

                <LandingPanel
                  title="Join a room"
                  titleId="landing-join-title"
                  noValidate
                  ruled
                  onSubmit={openJoinCard}
                >
                  <LandingField
                    label="Room code"
                    htmlFor="landing-room-code"
                    error={codeError}
                    errorId="landing-room-code-error"
                  >
                    <InputBase
                      id="landing-room-code"
                      className="landing-code"
                      placeholder="ABCD"
                      value={codeInput}
                      onChange={(event) =>
                        setCodeInput(parseInviteInput(event.target.value))
                      }
                      error={Boolean(codeError)}
                      inputProps={{
                        "aria-describedby": codeError
                          ? "landing-room-code-error"
                          : undefined,
                        "aria-invalid": Boolean(codeError) || undefined,
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
                    className="landing-cta"
                    sx={secondaryCtaSx}
                  >
                    Join
                  </Button>
                </LandingPanel>
              </>
            )}

            <Box sx={{ borderTop: `1px solid ${ui.line}`, pt: 2 }}>
              <Button
                variant="text"
                startIcon={<EditNoteIcon />}
                onClick={() => {
                  setBuilderRequested(true);
                  setBuilderOpen(true);
                }}
                data-testid="landing-build"
                sx={{ minHeight: 44, ml: -1 }}
              >
                Build or import a game
              </Button>
            </Box>
          </Stack>
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

/** The first round's values, the way the show deals them. */
const boardValues = [200, 400, 600, 800, 1000];

const headSx = {
  fontFamily: jeopardyFonts.display,
  color: ui.ink,
  fontSize: { xs: 23, sm: 28 },
  fontWeight: 700,
  lineHeight: 1.05,
  textTransform: "uppercase",
  letterSpacing: "0.01em",
} as const;

const errorSx = {
  outline: "none",
  color: ui.onRed,
  background: ui.red,
  px: 1.5,
  py: 1,
  borderRadius: "6px",
} as const;

/** A field: the stage colour set into the page, a 3:1 edge, a gold ring on focus. */
const fieldSx = {
  ...controls.readout,
  width: "100%",
  height: 48,
  px: 1.5,
  color: ui.ink,
  fontSize: 16,
  outline: "2px solid transparent",
  outlineOffset: "1px",
  // No transition: the ring appears at once.
  "&:hover": { borderColor: ui.inkMuted },
  // `:focus-within` rather than MUI's focused class: CSS drops the ring the
  // moment focus leaves, with no render in between.
  "&:focus-within": { borderColor: ui.goldBright, outlineColor: ui.focus },
  "& input::placeholder": { color: ui.inkFaint, opacity: 1 },
} as const;

const codeFieldSx = {
  ...fieldSx,
  height: 56,
  "& input": {
    textAlign: "center",
    fontFamily: jeopardyFonts.display,
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: "0.3em",
    // The trailing letter-space would push the code off centre.
    textIndent: "0.3em",
    textTransform: "uppercase",
    fontVariantNumeric: "tabular-nums",
  },
  "&.Mui-error": { borderColor: ui.red },
} as const;

const ctaBase = {
  height: 48,
  width: "100%",
  borderRadius: `${ui.radius}px`,
  fontSize: 17,
  fontWeight: 700,
  whiteSpace: "nowrap",
  "&.Mui-disabled": { ...controls.keyOff, opacity: 0.8 },
} as const;

/** Gold, like the dollar values on the board: the one thing to press. */
const primaryCtaSx = { ...ctaBase, ...controls.keyPrimary } as const;

/** A second way in: the same size, a flat key. */
const secondaryCtaSx = { ...ctaBase, ...controls.key } as const;

const segmentedSx = {
  ...controls.readout,
  p: "4px",
  gap: "4px",
  "& .MuiToggleButton-root": {
    flex: 1,
    gap: 1,
    height: 40,
    border: 0,
    borderRadius: "6px !important",
    color: ui.inkMuted,
    fontSize: 15,
    fontWeight: 600,
    textTransform: "none",
    "&:hover": { background: ui.hoverTint, color: ui.ink },
    "&.Mui-selected": {
      background: ui.surfaceRaised,
      color: ui.ink,
      boxShadow: `inset 0 0 0 1px ${ui.lineStrong}`,
      "&:hover": { background: ui.surfaceRaised },
    },
  },
} as const;

/** One way in: a heading and its form, on the page itself (no card). */
const sectionSx = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  width: "100%",
  textAlign: "left",
} as const;

function LandingPanel({
  title,
  titleId,
  noValidate,
  ruled,
  onSubmit,
  children,
}: {
  title: string;
  titleId: string;
  noValidate?: boolean;
  /** A hairline above: the second form in the column. */
  ruled?: boolean;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <Box
      component="form"
      className="landing-panel"
      aria-labelledby={titleId}
      noValidate={noValidate}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      sx={{
        ...sectionSx,
        ...(ruled ? { borderTop: `1px solid ${ui.line}`, pt: 3 } : {}),
      }}
    >
      <Typography component="h2" id={titleId} sx={headSx}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

/** A visible label over its control, plus what's wrong with it when something is. */
function LandingField({
  label,
  htmlFor,
  id,
  error,
  errorId,
  children,
}: {
  label: string;
  htmlFor?: string;
  id?: string;
  error?: string;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      <Box
        component={htmlFor ? "label" : "span"}
        htmlFor={htmlFor}
        id={id}
        sx={{ color: ui.inkMuted, fontSize: 14, fontWeight: 600 }}
      >
        {label}
      </Box>
      {children}
      {error ? (
        <Typography id={errorId} variant="caption" sx={{ color: ui.red }}>
          {error}
        </Typography>
      ) : null}
    </Box>
  );
}
