"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import ScienceIcon from "@mui/icons-material/Science";
import BuildIcon from "@mui/icons-material/BuildCircleOutlined";
import LibraryIcon from "@mui/icons-material/LibraryBooksOutlined";
import AddIcon from "@mui/icons-material/AddOutlined";
import { baselineBotProfiles } from "@/lib/foundation/game-contracts";
import { useGameStore } from "@/lib/state/game-store";
import { sampleEpisodes } from "@/lib/sample-games";
import { normalizeCustomCsvGame } from "@/lib/data";
import { SettingsPanel } from "./SettingsPanel";
import { CustomGameBuilder } from "./CustomGameBuilder";
import { EpisodeBrowser } from "./EpisodeBrowser";

const sampleCsv = `round,cat,q,a,dd
jeopardy,Warmup,The first month of the year.,January,false
jeopardy,Warmup,Sky color on a clear day.,blue,false
jeopardy,Warmup,Number of legs on an octopus.,eight,false
jeopardy,Warmup,Largest ocean.,Pacific,false
jeopardy,Warmup,Force that holds you to the ground.,gravity,false
final,Bonus,Smallest country in the world by area.,Vatican City,false`;

export function Lobby() {
  const lobby = useGameStore((s) => s.lobby);
  const setHostName = useGameStore((s) => s.setHostName);
  const selectGame = useGameStore((s) => s.selectGame);
  const setCustomGame = useGameStore((s) => s.setCustomGame);
  const addBot = useGameStore((s) => s.addBot);
  const removeBot = useGameStore((s) => s.removeBot);
  const renameBot = useGameStore((s) => s.renameBot);
  const addHuman = useGameStore((s) => s.addHuman);
  const removeHuman = useGameStore((s) => s.removeHuman);
  const setAiJudge = useGameStore((s) => s.setAiJudge);
  const setHostControlsAuto = useGameStore((s) => s.setHostControlsAuto);
  const startGame = useGameStore((s) => s.startGame);
  const setSoloMode = useGameStore((s) => s.setSoloMode);
  const [humanName, setHumanName] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);

  const totalPlayers = 1 + lobby.extraHumans.length + lobby.bots.length;
  const canStart =
    (lobby.selectedGameId !== "custom" || lobby.customGame) && totalPlayers >= 1;

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result ?? "");
      const result = normalizeCustomCsvGame(text, { title: file.name.replace(/\.csv$/i, "") });
      if (!result.ok) {
        setUploadError(
          result.issues
            .filter((issue) => issue.severity === "error")
            .slice(0, 3)
            .map((issue) => issue.message)
            .join("; ") || "Invalid CSV.",
        );
        setCustomGame(undefined, result.issues);
        return;
      }
      setUploadError(null);
      setCustomGame(result.game, result.issues);
    };
    reader.readAsText(file);
  }

  function loadSampleCsv() {
    const result = normalizeCustomCsvGame(sampleCsv, { title: "Warmup" });
    if (result.ok) {
      setCustomGame(result.game, result.issues);
    }
  }

  return (
    <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", lg: "1.4fr 1fr" } }}>
      <Stack spacing={3}>
        <Card variant="outlined">
          <CardContent>
            <TextField
              fullWidth
              label="Your name"
              value={lobby.hostName}
              onChange={(event) => setHostName(event.target.value)}
            />
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <FormControl fullWidth size="small">
              <InputLabel id="game-source">Game</InputLabel>
              <Select
                labelId="game-source"
                label="Game"
                value={lobby.selectedGameId}
                onChange={(event) => selectGame(event.target.value)}
              >
                {sampleEpisodes.map((episode) => (
                  <MenuItem key={episode.id} value={episode.id}>
                    {episode.title}
                  </MenuItem>
                ))}
                {lobby.customGame ? (
                  <MenuItem value="custom">{lobby.customGame.title}</MenuItem>
                ) : null}
              </Select>
            </FormControl>
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ mt: 1.5, flexWrap: "wrap" }}
            >
              <Tooltip title="Upload CSV">
                <IconButton component="label" size="small">
                  <UploadFileIcon />
                  <input
                    hidden
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) handleFile(file);
                    }}
                  />
                </IconButton>
              </Tooltip>
              <Tooltip title="Build">
                <IconButton size="small" onClick={() => setBuilderOpen(true)}>
                  <BuildIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Browse">
                <IconButton size="small" onClick={() => setBrowserOpen(true)}>
                  <LibraryIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Sample">
                <IconButton size="small" onClick={loadSampleCsv}>
                  <ScienceIcon />
                </IconButton>
              </Tooltip>
            </Stack>
            {uploadError ? (
              <Typography color="error" variant="caption" sx={{ display: "block", mt: 1 }}>
                {uploadError}
              </Typography>
            ) : null}
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack
              direction="row"
              sx={{ mb: 1.5, alignItems: "baseline", gap: 1 }}
            >
              <Typography variant="h6">Players</Typography>
              <Typography variant="caption" color="text.secondary">
                {totalPlayers}
              </Typography>
            </Stack>

            <Stack spacing={1}>
              {lobby.bots.map((bot) => (
                <Stack
                  direction="row"
                  spacing={1}
                  key={bot.id}
                  sx={{ alignItems: "center" }}
                >
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
              {lobby.extraHumans.map((human) => (
                <Stack
                  direction="row"
                  spacing={1}
                  key={human.id}
                  sx={{ alignItems: "center" }}
                >
                  <Chip label={human.name} sx={{ flex: 1, justifyContent: "flex-start" }} />
                  <IconButton aria-label="remove" size="small" onClick={() => removeHuman(human.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>

            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ mt: 2, flexWrap: "wrap" }}
            >
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

            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
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

            <Divider sx={{ my: 2.5 }} />

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
            </Stack>
          </CardContent>
        </Card>

        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={<PlayArrowIcon />}
          disabled={!canStart}
          onClick={startGame}
          sx={{ alignSelf: "flex-start", px: 4, py: 1.4 }}
        >
          Start
        </Button>
      </Stack>
      <SettingsPanel />
      <CustomGameBuilder open={builderOpen} onClose={() => setBuilderOpen(false)} />
      <EpisodeBrowser open={browserOpen} onClose={() => setBrowserOpen(false)} />
    </Box>
  );
}
