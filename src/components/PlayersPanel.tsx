"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import AddIcon from "@mui/icons-material/AddOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import { baselineBotProfiles } from "@/lib/foundation/game-contracts";
import { useGameStore } from "@/lib/state/game-store";
import { ui } from "@/lib/foundation/jeopardy-style";
import { AvatarPicker } from "./AvatarPicker";

export function PlayersPanel() {
  const lobby = useGameStore((s) => s.lobby);
  const online = useGameStore((s) => s.online);
  const publicState = useGameStore((s) => s.publicState);
  const selfId = useGameStore((s) => s.selfId)();
  const runtime = useGameStore((s) => s.runtime);
  const setHostName = useGameStore((s) => s.setHostName);
  const addBot = useGameStore((s) => s.addBot);
  const removeBot = useGameStore((s) => s.removeBot);
  const renameBot = useGameStore((s) => s.renameBot);
  const addHuman = useGameStore((s) => s.addHuman);
  const removeHuman = useGameStore((s) => s.removeHuman);
  const setAiJudge = useGameStore((s) => s.setAiJudge);
  const setHostControlsAuto = useGameStore((s) => s.setHostControlsAuto);
  const setSoloMode = useGameStore((s) => s.setSoloMode);
  const setHostSpectator = useGameStore((s) => s.setHostSpectator);
  const [humanName, setHumanName] = useState("");

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <AvatarPicker
          playerId={lobby.hostId}
          emoji={lobby.hostEmoji}
          color={lobby.hostColor}
          label="Your avatar"
        />
        <TextField
          size="small"
          label="Your name"
          value={lobby.hostName}
          onChange={(event) => setHostName(event.target.value)}
          fullWidth
        />
      </Stack>

      <Box>
        <Stack spacing={1}>
          {lobby.bots.map((bot) => (
            <Stack
              key={bot.id}
              direction="row"
              spacing={1}
              sx={{ alignItems: "center" }}
            >
              <AvatarPicker
                playerId={bot.id}
                emoji={bot.emoji}
                color={bot.color}
                size={32}
              />
              <TextField
                fullWidth
                size="small"
                value={bot.name}
                onChange={(event) => renameBot(bot.id, event.target.value)}
              />
              <Chip
                label={`${Math.round(bot.profile.targetAccuracy * 100)}%`}
                size="small"
                color="secondary"
                variant="outlined"
              />
              <IconButton aria-label="remove" size="small" onClick={() => removeBot(bot.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          {online
            ? (publicState?.players ?? [])
                .filter((player) => player.kind === "human" && player.id !== selfId)
                .map((player) => (
                  <Stack
                    key={player.id}
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    <Box
                      aria-hidden
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: player.color ?? ui.surfaceRaised,
                      }}
                    >
                      {player.emoji ?? ""}
                    </Box>
                    <Chip
                      label={player.displayName}
                      sx={{ flex: 1, justifyContent: "flex-start" }}
                      variant={player.connected ? "filled" : "outlined"}
                    />
                    {publicState?.settings.hostId === selfId ? (
                      <IconButton
                        size="small"
                        aria-label={`Remove ${player.displayName}`}
                        onClick={() =>
                          runtime?.sendCommand(selfId, {
                            type: "leave-game",
                            targetPlayerId: player.id,
                          })
                        }
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    ) : null}
                  </Stack>
                ))
            : lobby.extraHumans.map((human) => (
                <Stack
                  key={human.id}
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center" }}
                >
                  <AvatarPicker
                    playerId={human.id}
                    emoji={human.emoji}
                    color={human.color}
                    size={32}
                  />
                  <Chip label={human.name} sx={{ flex: 1, justifyContent: "flex-start" }} />
                  <IconButton size="small" onClick={() => removeHuman(human.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
        </Stack>

        <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1.5, flexWrap: "wrap" }}>
          {baselineBotProfiles.map((profile) => (
            <Button
              key={profile.id}
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => addBot(profile)}
            >
              {profile.label}
            </Button>
          ))}
        </Stack>

        <Stack
          direction="row"
          spacing={1}
          sx={{ mt: 1.5, display: online ? "none" : "flex" }}
        >
          <TextField
            size="small"
            placeholder="Add player"
            value={humanName}
            onChange={(event) => setHumanName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && humanName.trim()) {
                event.preventDefault();
                addHuman(humanName);
                setHumanName("");
              }
            }}
            fullWidth
          />
          <IconButton
            size="small"
            color="primary"
            disabled={!humanName.trim()}
            onClick={() => {
              addHuman(humanName);
              setHumanName("");
            }}
          >
            <AddIcon />
          </IconButton>
        </Stack>
      </Box>

      <Divider />

      <Stack spacing={0.5}>
        <FormControlLabel
          control={
            <Switch
              checked={lobby.aiJudgeEnabled}
              onChange={(_, value) => setAiJudge(value)}
            />
          }
          label="AI judge"
        />
        <FormControlLabel
          control={
            <Switch
              checked={lobby.hostControlsAuto}
              onChange={(_, value) => setHostControlsAuto(value)}
            />
          }
          label="Auto-advance"
        />
        <FormControlLabel
          control={
            <Switch
              checked={lobby.soloMode}
              onChange={(_, value) => setSoloMode(value)}
            />
          }
          label="Solo practice"
        />
        <FormControlLabel
          control={
            <Switch
              checked={Boolean(lobby.hostSpectator)}
              onChange={(_, value) => setHostSpectator(value)}
            />
          }
          label="Watch only"
        />
      </Stack>
    </Stack>
  );
}
