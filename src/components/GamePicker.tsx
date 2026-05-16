"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ShuffleIcon from "@mui/icons-material/ShuffleOutlined";
import {
  pickRandomEpisode,
  sampleEpisodes,
  themeLabels,
  type SampleTheme,
} from "@/lib/sample-games";
import { useGameStore } from "@/lib/state/game-store";

interface GamePickerProps {
  open: boolean;
  onClose: () => void;
}

type Mode = "random" | "theme" | "number";

const themes: SampleTheme[] = [
  "standard",
  "kids-week",
  "teen-tournament",
  "college-championship",
  "tournament-of-champions",
];

export function GamePicker({ open, onClose }: GamePickerProps) {
  const selectGame = useGameStore((s) => s.selectGame);
  const [mode, setMode] = useState<Mode>("random");
  const [theme, setTheme] = useState<SampleTheme>("standard");
  const [numberInput, setNumberInput] = useState("");

  const byTheme = useMemo(() => {
    return sampleEpisodes.filter((episode) => episode.theme === theme);
  }, [theme]);

  function applyEpisodeId(id: string) {
    selectGame(id);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>New game</DialogTitle>
      <DialogContent dividers>
        <Tabs value={mode} onChange={(_, value) => setMode(value)} sx={{ mb: 2 }}>
          <Tab value="random" label="Random" />
          <Tab value="theme" label="Theme" />
          <Tab value="number" label="By number" />
        </Tabs>

        {mode === "random" ? (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Pick a board you have not seen.
            </Typography>
            <Button
              startIcon={<ShuffleIcon />}
              variant="contained"
              onClick={() => applyEpisodeId(pickRandomEpisode().id)}
              sx={{ alignSelf: "flex-start" }}
            >
              Shuffle
            </Button>
          </Stack>
        ) : null}

        {mode === "theme" ? (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
              {themes.map((entry) => (
                <Chip
                  key={entry}
                  label={themeLabels[entry]}
                  color={entry === theme ? "primary" : "default"}
                  onClick={() => setTheme(entry)}
                  variant={entry === theme ? "filled" : "outlined"}
                />
              ))}
            </Stack>
            <Stack spacing={1}>
              {byTheme.map((episode) => (
                <Paper
                  key={episode.id}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 700 }}>{episode.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      #{episode.number}
                    </Typography>
                  </Box>
                  <Button variant="contained" onClick={() => applyEpisodeId(episode.id)}>
                    Use
                  </Button>
                </Paper>
              ))}
              {byTheme.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  No boards yet for this theme.
                </Typography>
              ) : null}
            </Stack>
          </Stack>
        ) : null}

        {mode === "number" ? (
          <Stack spacing={2}>
            <TextField
              size="small"
              label="Game number"
              type="number"
              value={numberInput}
              onChange={(event) => setNumberInput(event.target.value)}
              fullWidth
            />
            <Button
              variant="contained"
              disabled={!numberInput.trim()}
              onClick={() => {
                const found = sampleEpisodes.find(
                  (episode) => String(episode.number) === numberInput.trim(),
                );
                if (found) {
                  applyEpisodeId(found.id);
                }
              }}
              sx={{ alignSelf: "flex-start" }}
            >
              Find
            </Button>
            <Typography variant="caption" color="text.secondary">
              Try {sampleEpisodes.map((episode) => episode.number).join(", ")}.
            </Typography>
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
