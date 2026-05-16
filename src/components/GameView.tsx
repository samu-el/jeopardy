"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LogoutIcon from "@mui/icons-material/LogoutOutlined";
import UndoIcon from "@mui/icons-material/UndoOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { useGameStore } from "@/lib/state/game-store";
import { Board } from "./Board";
import { Scoreboard } from "./Scoreboard";
import { ClueStage } from "./ClueStage";
import { Chat } from "./Chat";
import { ResultsView } from "./ResultsView";
import { AvatarHostController } from "./AvatarHostController";

const roundLabels: Record<string, string> = {
  lobby: "Lobby",
  jeopardy: "Jeopardy",
  "double-jeopardy": "Double Jeopardy",
  "triple-jeopardy": "Triple Jeopardy",
  "final-jeopardy": "Final Jeopardy",
  complete: "Game Complete",
};

export function GameView() {
  const publicState = useGameStore((s) => s.publicState);
  const runtime = useGameStore((s) => s.runtime);
  const lobby = useGameStore((s) => s.lobby);
  const exitToLobby = useGameStore((s) => s.exitToLobby);

  if (!publicState || !runtime) {
    return null;
  }

  const isHost = publicState.settings.hostId === lobby.hostId;
  const canPick =
    isHost &&
    publicState.round !== "lobby" &&
    publicState.round !== "complete" &&
    !publicState.currentClue;
  const showLobbyStart = publicState.round === "lobby";
  const showResults = publicState.round === "complete";

  if (showResults) {
    return (
      <ResultsView
        state={publicState}
        onPlayAgain={() => {
          exitToLobby();
        }}
        onExit={exitToLobby}
      />
    );
  }

  return (
    <Stack spacing={2}>
      <AvatarHostController />
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ alignItems: "center", flexWrap: "wrap" }}
        >
          <Chip
            color="primary"
            label={roundLabels[publicState.round] ?? publicState.round}
            sx={{ fontWeight: 700 }}
          />
          {publicState.pickerId ? (
            <Chip
              variant="outlined"
              label={`Picker: ${
                publicState.players.find((player) => player.id === publicState.pickerId)
                  ?.displayName ?? publicState.pickerId
              }`}
            />
          ) : null}
          <Chip
            variant="outlined"
            label={`${publicState.players.length} player${publicState.players.length === 1 ? "" : "s"}`}
          />
        </Stack>
        <Stack direction="row" spacing={1}>
          {isHost && (publicState.round === "lobby" || publicState.round === "complete") ? (
            <Button
              variant="contained"
              startIcon={<PlayArrowIcon />}
              onClick={() => runtime.sendCommand(lobby.hostId, { type: "start-game" })}
              disabled={!showLobbyStart}
            >
              {publicState.round === "lobby" ? "Begin" : "Game ended"}
            </Button>
          ) : null}
          {isHost ? (
            <Button
              variant="outlined"
              startIcon={<UndoIcon />}
              onClick={() => runtime.sendCommand(lobby.hostId, { type: "undo" })}
            >
              Undo
            </Button>
          ) : null}
          <Button
            color="error"
            variant="outlined"
            startIcon={<LogoutIcon />}
            onClick={exitToLobby}
          >
            Leave
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 2.2fr) minmax(260px, 1fr)" },
          gap: 2,
        }}
      >
        <Stack spacing={2}>
          <ClueStage state={publicState} currentClientId={lobby.hostId} />
          <Card variant="outlined">
            <CardContent sx={{ p: { xs: 1, sm: 2 } }}>
              {showLobbyStart ? (
                <Box sx={{ p: 4, textAlign: "center" }}>
                  <Typography variant="h5" sx={{ mb: 1 }}>
                    Ready to play
                  </Typography>
                  <Typography color="text.secondary">
                    Press Begin to deal the board.
                  </Typography>
                </Box>
              ) : showResults ? (
                <Box sx={{ p: 4, textAlign: "center" }}>
                  <Typography variant="h4" sx={{ mb: 1 }}>
                    Final scores
                  </Typography>
                  <Typography color="text.secondary" sx={{ mb: 3 }}>
                    {publicState.players[0]
                      ? `Winner: ${publicState.players[0].displayName} with $${publicState.players[0].score}`
                      : "Game over."}
                  </Typography>
                </Box>
              ) : (
                <Board
                  state={publicState}
                  canPick={canPick}
                  onPick={(clueId) =>
                    runtime.sendCommand(lobby.hostId, { type: "pick-clue", clueId })
                  }
                />
              )}
            </CardContent>
          </Card>
        </Stack>

        <Stack
          spacing={2}
          sx={{
            display: "flex",
            flexDirection: "column",
            height: { lg: "calc(100vh - 220px)" },
            minHeight: 480,
          }}
        >
          <Card variant="outlined" sx={{ flexShrink: 0 }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Scoreboard
              </Typography>
              <Scoreboard state={publicState} currentClientId={lobby.hostId} />
            </CardContent>
          </Card>
          <Box sx={{ flex: 1, minHeight: 200 }}>
            <Chat />
          </Box>
        </Stack>
      </Box>
    </Stack>
  );
}
