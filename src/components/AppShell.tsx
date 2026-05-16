"use client";

import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import HomeIcon from "@mui/icons-material/HomeOutlined";
import { useGameStore } from "@/lib/state/game-store";
import { usePersistedLobby } from "@/lib/state/use-persisted-lobby";
import { Lobby } from "./Lobby";
import { GameView } from "./GameView";
import { Landing } from "./Landing";
import { Wordmark } from "./Wordmark";

export function AppShell() {
  usePersistedLobby();
  const screen = useGameStore((s) => s.screen);
  const setScreen = useGameStore((s) => s.setScreen);

  if (screen === "landing") {
    return <Landing />;
  }

  return (
    <Box sx={{ minHeight: "100vh", background: "#000" }}>
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 3 } }}>
        <Stack
          direction="row"
          sx={{
            mb: { xs: 2, md: 3 },
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <IconButton size="small" onClick={() => setScreen("landing")} aria-label="Home">
              <HomeIcon />
            </IconButton>
            <Wordmark size="sm" />
          </Stack>
        </Stack>
        {screen === "lobby" ? <Lobby /> : <GameView />}
      </Container>
    </Box>
  );
}
