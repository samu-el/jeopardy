"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArrowForwardIcon from "@mui/icons-material/ArrowForwardOutlined";
import LoginIcon from "@mui/icons-material/LoginOutlined";
import { defaultPlayerName, useGameStore } from "@/lib/state/game-store";
import { ui } from "@/lib/foundation/jeopardy-style";
import { Wordmark } from "./Wordmark";

export function Landing() {
  const pendingRoomId = useGameStore((s) => s.pendingRoomId);
  const hostId = useGameStore((s) => s.lobby.hostId);
  const setPendingRoomId = useGameStore((s) => s.setPendingRoomId);
  const setHostName = useGameStore((s) => s.setHostName);
  const hostName = useGameStore((s) => s.lobby.hostName);
  const joinOnlineRoom = useGameStore((s) => s.joinOnlineRoom);
  const startRandomGame = useGameStore((s) => s.startRandomGame);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [dealing, setDealing] = useState(false);
  const [dealError, setDealError] = useState<string | null>(null);

  /** One click straight onto a board — no picker, no settings detour. */
  async function newGame() {
    setDealing(true);
    setDealError(null);
    const result = await startRandomGame();
    if (!result.ok) {
      setDealError(result.error ?? "Could not start a game.");
      setDealing(false);
      return;
    }
    // startRandomGame moves to the play screen itself; this component unmounts.
  }

  /**
   * The code box opens the join card rather than joining outright.
   *
   * It used to connect on the spot, which meant the only path that asked for
   * a name was the invite link — type a code and the room called you
   * "Player 4B2" with nowhere to say otherwise. One card, one place to be
   * asked, whichever way you arrived.
   */
  function openJoinCard(roomId: string) {
    const code = roomId.trim().toUpperCase();
    if (code.length < 3) return;
    setJoinError(null);
    setPendingRoomId(code);
  }

  async function joinRoom(roomId: string) {
    const code = roomId.trim().toUpperCase();
    if (!code) return;
    setJoining(true);
    setJoinError(null);
    try {
      const joined = await joinOnlineRoom(code);
      if (!joined) {
        setJoinError(
          "That room is not open. Ask the host for a fresh code or start your own.",
        );
        return;
      }
      setPendingRoomId(null);
    } catch (error) {
      setJoinError((error as Error).message || "Could not reach the room.");
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

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: ui.stage,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Container maxWidth="lg" sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Stack
          direction="row"
          sx={{
            py: 2,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Wordmark size="sm" />
        </Stack>

        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            py: { xs: 6, md: 8 },
          }}
        >
          <Stack spacing={{ xs: 3, md: 5 }} sx={{ maxWidth: 760 }}>
            <Wordmark size="xl" />
            {pendingRoomId ? (
              <Box
                role="dialog"
                aria-label="Join room"
                sx={{
                  background: ui.surface,
                  border: `1px solid ${ui.line}`,
                  borderRadius: 1,
                  p: 3,
                  maxWidth: 480,
                }}
              >
                <Typography variant="overline">Joining room</Typography>
                <Typography variant="h3" sx={{ mt: 0.5, mb: 2, letterSpacing: "0.12em" }}>
                  {pendingRoomId}
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Your name"
                    fullWidth
                    value={hostName}
                    onChange={(event) => setHostName(event.target.value)}
                  />
                  {joinError ? (
                    <Typography color="error" variant="caption">
                      {joinError}
                    </Typography>
                  ) : null}
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      startIcon={joining ? <CircularProgress size={16} /> : <LoginIcon />}
                      onClick={() => joinRoom(pendingRoomId)}
                      disabled={joining}
                    >
                      Join
                    </Button>
                    <Button
                      variant="text"
                      onClick={() => {
                        setPendingRoomId(null);
                        if (typeof window !== "undefined") {
                          const url = new URL(window.location.href);
                          url.searchParams.delete("room");
                          window.history.replaceState({}, "", url.toString());
                        }
                      }}
                    >
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
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  sx={{ alignItems: { sm: "center" } }}
                >
                  <Button
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
                    onClick={newGame}
                    sx={{ px: 4, alignSelf: { xs: "flex-start", sm: "auto" } }}
                  >
                    {dealing ? "Dealing…" : "New Game"}
                  </Button>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <TextField
                      size="small"
                      label="Room code"
                      value={codeInput}
                      slotProps={{
                        htmlInput: { maxLength: 6, "aria-label": "Room code" },
                      }}
                      onChange={(event) => setCodeInput(event.target.value.toUpperCase())}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          openJoinCard(codeInput);
                        }
                      }}
                      sx={{ width: 150, "& .MuiInputBase-root": { height: 48 } }}
                    />
                    <Button
                      variant="outlined"
                      size="large"
                      startIcon={<LoginIcon />}
                      onClick={() => openJoinCard(codeInput)}
                      disabled={codeInput.trim().length < 3}
                    >
                      Join
                    </Button>
                  </Stack>
                </Stack>
                {joinError || dealError ? (
                  <Typography color="error" variant="caption">
                    {joinError ?? dealError}
                  </Typography>
                ) : null}
              </>
            )}
          </Stack>
        </Box>

        <Box sx={{ py: { xs: 4, md: 6 }, borderTop: `1px solid ${ui.line}` }}>
          <Box
            sx={{
              display: "grid",
              gap: 4,
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" },
            }}
          >
            <LandingFeature
              title="Every clue read aloud"
              body="Turn sound on and the board reads itself."
            />
            <LandingFeature
              title="Bots that play"
              body="Four difficulty tiers. They buzz, answer and wager."
            />
            <LandingFeature
              title="Play with friends"
              body="Share the room code. Put the board on a TV."
            />
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

function LandingFeature({ title, body }: { title: string; body: string }) {
  return (
    <Stack spacing={1}>
      <Typography variant="h6" sx={{ fontSize: 17 }}>
        {title}
      </Typography>
      <Typography variant="body2">{body}</Typography>
    </Stack>
  );
}
