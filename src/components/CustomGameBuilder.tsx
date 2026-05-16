"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/DownloadOutlined";
import UploadIcon from "@mui/icons-material/UploadFileOutlined";
import {
  buildNormalizedGame,
  builderGameToJSON,
  emptyBuilderGame,
  parseBuilderGame,
  type BuilderClue,
  type BuilderGame,
} from "@/lib/data";
import { useGameStore } from "@/lib/state/game-store";
import type { PlayableRound } from "@/lib/game";

interface CustomGameBuilderProps {
  open: boolean;
  onClose: () => void;
}

const rounds: { id: PlayableRound; label: string }[] = [
  { id: "jeopardy", label: "Jeopardy" },
  { id: "double-jeopardy", label: "Double Jeopardy" },
];

export function CustomGameBuilder({ open, onClose }: CustomGameBuilderProps) {
  const setCustomGame = useGameStore((s) => s.setCustomGame);
  const initial = useGameStore((s) => s.lobby.builderDraft) ?? emptyBuilderGame();
  const saveDraft = useGameStore((s) => s.saveBuilderDraft);
  const [draft, setDraft] = useState<BuilderGame>(initial);
  const [tab, setTab] = useState<PlayableRound>("jeopardy");
  const [error, setError] = useState<string | null>(null);

  const cluesByCategory = useMemo(() => {
    const map = new Map<string, BuilderClue[]>();
    for (const clue of draft.clues) {
      if (clue.round !== tab) continue;
      const list = map.get(clue.categoryId) ?? [];
      list.push(clue);
      map.set(clue.categoryId, list);
    }
    return map;
  }, [draft, tab]);

  function updateClue(id: string, patch: Partial<BuilderClue>) {
    setDraft((current) => ({
      ...current,
      clues: current.clues.map((clue) =>
        clue.id === id ? { ...clue, ...patch } : clue,
      ),
    }));
  }

  function updateCategoryName(id: string, name: string) {
    setDraft((current) => ({
      ...current,
      categories: current.categories.map((cat) =>
        cat.id === id ? { ...cat, name } : cat,
      ),
    }));
  }

  function exportJson() {
    const blob = new Blob([builderGameToJSON(draft)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${draft.title || "custom-game"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseBuilderGame(String(reader.result ?? ""));
      if (!parsed) {
        setError("Could not parse JSON.");
        return;
      }
      setError(null);
      setDraft(parsed);
    };
    reader.readAsText(file);
  }

  function commit() {
    const result = buildNormalizedGame(draft);
    if (!result.ok) {
      setError(
        result.issues
          .filter((issue) => issue.severity === "error")
          .slice(0, 3)
          .map((issue) => issue.message)
          .join("; ") || "Validation failed.",
      );
      return;
    }
    setError(null);
    saveDraft(draft);
    setCustomGame(result.game, result.issues);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Build a custom game</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label="Game title"
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            fullWidth
          />

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Categories
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "1fr 1fr",
                    md: "repeat(3, 1fr)",
                  },
                }}
              >
                {draft.categories.map((cat, index) => (
                  <TextField
                    key={cat.id}
                    size="small"
                    label={`Category ${index + 1}`}
                    value={cat.name}
                    onChange={(event) => updateCategoryName(cat.id, event.target.value)}
                  />
                ))}
              </Box>
            </CardContent>
          </Card>

          <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable">
            {rounds.map((round) => (
              <Tab key={round.id} value={round.id} label={round.label} />
            ))}
          </Tabs>

          <Stack spacing={2}>
            {draft.categories.map((cat) => {
              const clues = (cluesByCategory.get(cat.id) ?? []).sort(
                (a, b) => a.value - b.value,
              );
              return (
                <Card key={cat.id} variant="outlined">
                  <CardContent>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", mb: 2 }}
                    >
                      <Chip
                        label={cat.name || "Untitled"}
                        color="primary"
                        variant="outlined"
                      />
                    </Stack>
                    <Stack spacing={1.5}>
                      {clues.map((clue) => (
                        <Box
                          key={clue.id}
                          sx={{
                            display: "grid",
                            gap: 1,
                            gridTemplateColumns: {
                              xs: "1fr",
                              md: "100px 1fr 1fr auto",
                            },
                            alignItems: "center",
                          }}
                        >
                          <TextField
                            size="small"
                            type="number"
                            label="$"
                            value={clue.value}
                            onChange={(event) =>
                              updateClue(clue.id, {
                                value: Number(event.target.value) || 0,
                              })
                            }
                          />
                          <TextField
                            size="small"
                            label="Clue"
                            value={clue.clue}
                            onChange={(event) =>
                              updateClue(clue.id, { clue: event.target.value })
                            }
                          />
                          <TextField
                            size="small"
                            label="Answer"
                            value={clue.correctResponse}
                            onChange={(event) =>
                              updateClue(clue.id, {
                                correctResponse: event.target.value,
                              })
                            }
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={clue.dailyDouble}
                                onChange={(_, value) =>
                                  updateClue(clue.id, { dailyDouble: value })
                                }
                              />
                            }
                            label="DD"
                          />
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>

          <Divider />

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Final Jeopardy (optional)
              </Typography>
              <Stack spacing={1}>
                <TextField
                  size="small"
                  label="Category"
                  value={draft.finalClue?.category ?? ""}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      finalClue: {
                        category: event.target.value,
                        clue: draft.finalClue?.clue ?? "",
                        correctResponse: draft.finalClue?.correctResponse ?? "",
                      },
                    })
                  }
                />
                <TextField
                  size="small"
                  label="Clue"
                  value={draft.finalClue?.clue ?? ""}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      finalClue: {
                        category: draft.finalClue?.category ?? "",
                        clue: event.target.value,
                        correctResponse: draft.finalClue?.correctResponse ?? "",
                      },
                    })
                  }
                />
                <TextField
                  size="small"
                  label="Answer"
                  value={draft.finalClue?.correctResponse ?? ""}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      finalClue: {
                        category: draft.finalClue?.category ?? "",
                        clue: draft.finalClue?.clue ?? "",
                        correctResponse: event.target.value,
                      },
                    })
                  }
                />
              </Stack>
            </CardContent>
          </Card>

          {error ? (
            <Typography color="error">{error}</Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1, flexWrap: "wrap" }}>
        <IconButton
          component="label"
          aria-label="Import JSON"
          title="Import JSON"
        >
          <UploadIcon />
          <input
            hidden
            type="file"
            accept="application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importJson(file);
            }}
          />
        </IconButton>
        <IconButton aria-label="Export JSON" onClick={exportJson} title="Export JSON">
          <DownloadIcon />
        </IconButton>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={commit}>
          Save & use
        </Button>
      </DialogActions>
    </Dialog>
  );
}
