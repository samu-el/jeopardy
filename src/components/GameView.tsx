"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import LogoutIcon from "@mui/icons-material/LogoutOutlined";
import UndoIcon from "@mui/icons-material/UndoOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { useGameStore } from "@/lib/state/game-store";
import { Board } from "./Board";
import { ClueStage } from "./ClueStage";
import { Chat } from "./Chat";
import { ResultsView } from "./ResultsView";
import { AvatarHostController } from "./AvatarHostController";
import { Podium } from "./Podium";

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
        sx={{
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box>
          {isHost && showLobbyStart ? (
            <Button
              variant="contained"
              startIcon={<PlayArrowIcon />}
              onClick={() => runtime.sendCommand(lobby.hostId, { type: "start-game" })}
            >
              Begin
            </Button>
          ) : null}
        </Box>
        <Stack direction="row" spacing={1}>
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

      {/* 75/25 vertical split — board on top, podiums on bottom */}
      <Box
        sx={{
          display: "grid",
          gridTemplateRows: "minmax(0, 3fr) minmax(0, 1fr)",
          gap: 2,
          minHeight: { md: "calc(100vh - 160px)" },
        }}
      >
        <Box sx={{ position: "relative", minHeight: 320 }}>
          <Box sx={{ width: "100%", maxWidth: 1200, mx: "auto" }}>
            <Board
              state={publicState}
              canPick={canPick}
              onPick={(clueId) =>
                runtime.sendCommand(lobby.hostId, { type: "pick-clue", clueId })
              }
            />
          </Box>
          {publicState.currentClue ? (
            <Box
              role="dialog"
              aria-modal="false"
              sx={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(180deg, #060d2a 0%, #02061b 100%)",
                zIndex: 2,
                display: "flex",
                flexDirection: "column",
                borderRadius: 1,
              }}
            >
              <ClueStage state={publicState} currentClientId={lobby.hostId} />
            </Box>
          ) : null}
        </Box>

        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: `repeat(${Math.max(1, publicState.players.length)}, minmax(0, 1fr))`,
            alignItems: "end",
          }}
        >
          {publicState.players.map((player) => (
            <Podium
              key={player.id}
              player={player}
              state={publicState}
              isYou={player.id === lobby.hostId}
            />
          ))}
        </Box>
      </Box>

      <Chat />
    </Stack>
  );
}
