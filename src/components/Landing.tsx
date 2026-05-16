"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArrowForwardIcon from "@mui/icons-material/ArrowForwardOutlined";
import LoginIcon from "@mui/icons-material/LoginOutlined";
import { useGameStore } from "@/lib/state/game-store";
import { Wordmark } from "./Wordmark";

export function Landing() {
  const setScreen = useGameStore((s) => s.setScreen);
  const pendingRoomId = useGameStore((s) => s.pendingRoomId);
  const setPendingRoomId = useGameStore((s) => s.setPendingRoomId);
  const setHostName = useGameStore((s) => s.setHostName);
  const hostName = useGameStore((s) => s.lobby.hostName);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function joinRoom() {
    if (!pendingRoomId) return;
    setJoining(true);
    setJoinError(null);
    try {
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(pendingRoomId)}`,
      );
      const data = (await response.json()) as { exists?: boolean };
      if (!data.exists) {
        setJoinError(
          "Room not found. Ask the host for a fresh link or start a new room.",
        );
        return;
      }
      setScreen("play");
    } catch (error) {
      setJoinError((error as Error).message || "Could not check the room.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "#000",
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
                  background: "linear-gradient(180deg, #0e1530, #050a26)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 2,
                  p: 3,
                  maxWidth: 480,
                }}
              >
                <Typography
                  variant="overline"
                  sx={{ color: "#5b8cff", letterSpacing: 2 }}
                >
                  Joining room
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, mb: 2 }}>
                  #{pendingRoomId}
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
                      onClick={joinRoom}
                      disabled={joining}
                      sx={{ background: "#5b8cff", color: "#000", fontWeight: 700 }}
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
                  variant="h5"
                  sx={{
                    color: "rgba(255,255,255,0.7)",
                    fontWeight: 400,
                    maxWidth: 560,
                    lineHeight: 1.4,
                  }}
                >
                  Open the board. Buzz in. Play the categories — solo, with friends,
                  or against AI rivals.
                </Typography>
                <Stack direction="row" spacing={2}>
                  <Button
                    variant="contained"
                    size="large"
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => setScreen("play")}
                    sx={{
                      background: "#5b8cff",
                      color: "#000",
                      fontWeight: 700,
                      px: 4,
                      py: 1.5,
                      fontSize: 18,
                      borderRadius: 999,
                      textTransform: "none",
                      "&:hover": {
                        background: "#7da5ff",
                        boxShadow: "0 8px 32px rgba(91,140,255,0.35)",
                      },
                    }}
                  >
                    New room
                  </Button>
                </Stack>
              </>
            )}
          </Stack>
        </Box>

        <Box sx={{ py: { xs: 4, md: 6 }, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <Box
            sx={{
              display: "grid",
              gap: 4,
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" },
            }}
          >
            <LandingFeature
              eyebrow="Voice host"
              title="Reads every clue"
              body="Natural voices pick from your system. Picks a persona for you."
            />
            <LandingFeature
              eyebrow="Smart bots"
              title="Real opponents"
              body="Four difficulty tiers — they buzz, answer and wager on their own."
            />
            <LandingFeature
              eyebrow="No setup"
              title="Solo or shared"
              body="Play alone, pass-and-play, or invite friends to the same board."
            />
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

function LandingFeature({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <Stack spacing={1}>
      <Typography
        variant="overline"
        sx={{
          color: "#5b8cff",
          letterSpacing: 2,
          fontSize: 11,
        }}
      >
        {eyebrow}
      </Typography>
      <Typography sx={{ fontWeight: 700, fontSize: 18, color: "white" }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.55)" }}>
        {body}
      </Typography>
    </Stack>
  );
}
