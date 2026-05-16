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
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import ScienceIcon from "@mui/icons-material/Science";
import BuildIcon from "@mui/icons-material/BuildCircleOutlined";
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
            .join("; ") || "Could not parse CSV.",
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
    const result = normalizeCustomCsvGame(sampleCsv, { title: "Warmup pack" });
    if (result.ok) {
      setCustomGame(result.game, result.issues);
    }
  }

  return (
    <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", lg: "1.4fr 1fr" } }}>
      <Stack spacing={3}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h5" sx={{ mb: 2 }}>
              You
            </Typography>
            <TextField
              fullWidth
              label="Your name"
              value={lobby.hostName}
              onChange={(event) => setHostName(event.target.value)}
              helperText="You are the host. You'll pick clues, judge answers, and control pacing."
            />
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="h5" sx={{ mb: 2 }}>
              Game source
            </Typography>
            <FormControl fullWidth>
              <InputLabel id="game-source">Episode</InputLabel>
              <Select
                labelId="game-source"
                label="Episode"
                value={lobby.selectedGameId}
                onChange={(event) => selectGame(event.target.value)}
              >
                {sampleEpisodes.map((episode) => (
                  <MenuItem key={episode.id} value={episode.id}>
                    {episode.title}
                  </MenuItem>
                ))}
                {lobby.customGame ? (
                  <MenuItem value="custom">Custom: {lobby.customGame.title}</MenuItem>
                ) : null}
              </Select>
            </FormControl>
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ mt: 2, flexWrap: "wrap" }}
            >
              <Button
                component="label"
                variant="outlined"
                startIcon={<UploadFileIcon />}
              >
                Upload CSV
                <input
                  hidden
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
              </Button>
              <Button onClick={loadSampleCsv} variant="text" startIcon={<ScienceIcon />}>
                Try the sample warmup pack
              </Button>
              <Button
                onClick={() => setBuilderOpen(true)}
                variant="outlined"
                startIcon={<BuildIcon />}
              >
                Build my own
              </Button>
              <Button onClick={() => setBrowserOpen(true)} variant="text">
                Browse episodes
              </Button>
            </Stack>
            {uploadError ? (
              <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                {uploadError}
              </Typography>
            ) : null}
            {lobby.customGame ? (
              <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
                Custom game loaded: {lobby.customGame.clues.length} clues across rounds.
              </Typography>
            ) : null}
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack
              direction="row"
              sx={{ mb: 2, justifyContent: "space-between", alignItems: "center" }}
            >
              <Typography variant="h5">Players</Typography>
              <Chip
                label={`${totalPlayers} player${totalPlayers === 1 ? "" : "s"}`}
                color="primary"
                variant="outlined"
              />
            </Stack>

            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Bots
            </Typography>
            <Stack spacing={1}>
              {lobby.bots.map((bot) => (
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  key={bot.id}
                  sx={{ alignItems: { sm: "center" } }}
                >
                  <TextField
                    fullWidth
                    size="small"
                    value={bot.name}
                    onChange={(event) => renameBot(bot.id, event.target.value)}
                  />
                  <Chip
                    label={`${bot.profile.label} · ${Math.round(bot.profile.targetAccuracy * 100)}%`}
                    sx={{ alignSelf: "flex-start" }}
                    color="secondary"
                    variant="outlined"
                  />
                  <IconButton aria-label="remove bot" onClick={() => removeBot(bot.id)}>
                    <DeleteIcon />
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
                  onClick={() => addBot(profile)}
                >
                  Add {profile.label}
                </Button>
              ))}
            </Stack>

            <Divider sx={{ my: 3 }} />

            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Local human players (pass-and-play)
            </Typography>
            <Stack spacing={1}>
              {lobby.extraHumans.map((human) => (
                <Stack
                  direction="row"
                  spacing={1}
                  key={human.id}
                  sx={{ alignItems: "center" }}
                >
                  <Chip label={human.name} />
                  <Button size="small" color="error" onClick={() => removeHuman(human.id)}>
                    Remove
                  </Button>
                </Stack>
              ))}
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <TextField
                size="small"
                placeholder="Name"
                value={humanName}
                onChange={(event) => setHumanName(event.target.value)}
              />
              <Button
                variant="outlined"
                disabled={!humanName.trim()}
                onClick={() => {
                  addHuman(humanName);
                  setHumanName("");
                }}
              >
                Add player
              </Button>
            </Stack>

            <Divider sx={{ my: 3 }} />

            <Stack spacing={1}>
              <FormControlLabel
                control={
                  <Switch
                    checked={lobby.aiJudgeEnabled}
                    onChange={(_, value) => setAiJudge(value)}
                  />
                }
                label="AI judge — auto-judge answers using fuzzy matching"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={lobby.hostControlsAuto}
                    onChange={(_, value) => setHostControlsAuto(value)}
                  />
                }
                label="Auto-advance after each clue is judged"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={lobby.soloMode}
                    onChange={(_, value) => setSoloMode(value)}
                  />
                }
                label="Solo practice — adaptive bot difficulty between rounds"
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
          Start game
        </Button>
      </Stack>
      <SettingsPanel />
      <CustomGameBuilder open={builderOpen} onClose={() => setBuilderOpen(false)} />
      <EpisodeBrowser open={browserOpen} onClose={() => setBrowserOpen(false)} />
    </Box>
  );
}
