"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
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
  "final-jeopardy": "Final",
  complete: "Complete",
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
        onPlayAgain={exitToLobby}
        onExit={exitToLobby}
      />
    );
  }

  return (
    <Stack spacing={2}>
      <AvatarHostController />
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <Chip
          color="primary"
          label={roundLabels[publicState.round] ?? publicState.round}
          sx={{ fontWeight: 700 }}
        />
        <Stack direction="row" spacing={1}>
          {isHost && showLobbyStart ? (
            <Button
              variant="contained"
              startIcon={<PlayArrowIcon />}
              onClick={() => runtime.sendCommand(lobby.hostId, { type: "start-game" })}
            >
              Begin
            </Button>
          ) : null}
          {isHost ? (
            <Tooltip title="Undo">
              <IconButton
                onClick={() => runtime.sendCommand(lobby.hostId, { type: "undo" })}
              >
                <UndoIcon />
              </IconButton>
            </Tooltip>
          ) : null}
          <Tooltip title="Leave">
            <IconButton color="error" onClick={exitToLobby}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>
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
              <Board
                state={publicState}
                canPick={canPick}
                onPick={(clueId) =>
                  runtime.sendCommand(lobby.hostId, { type: "pick-clue", clueId })
                }
              />
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
