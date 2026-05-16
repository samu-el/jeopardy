"use client";

import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import { useGameStore } from "@/lib/state/game-store";
import { usePersistedLobby } from "@/lib/state/use-persisted-lobby";
import { Lobby } from "./Lobby";
import { GameView } from "./GameView";

export function AppShell() {
  usePersistedLobby();
  const screen = useGameStore((s) => s.screen);
  return (
    <Box
      sx={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(59,108,255,0.12), transparent 60%), radial-gradient(circle at bottom right, rgba(255,195,74,0.06), transparent 60%)",
      }}
    >
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
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                background: "linear-gradient(135deg, #3b6cff, #ffc34a)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0c1224",
                fontWeight: 900,
              }}
            >
              J
            </Box>
            <Stack>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1 }}>
                Jeopardy Modern
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Live multiplayer board with AI bots & host
              </Typography>
            </Stack>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Chip
              label={screen === "play" ? "In game" : "Lobby"}
              color={screen === "play" ? "success" : "default"}
              variant="outlined"
              size="small"
            />
          </Stack>
        </Stack>
        {screen === "lobby" ? <Lobby /> : <GameView />}
      </Container>
    </Box>
  );
}
