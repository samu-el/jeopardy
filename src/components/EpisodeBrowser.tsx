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
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { sampleEpisodes } from "@/lib/sample-games";
import { useGameStore } from "@/lib/state/game-store";

interface EpisodeBrowserProps {
  open: boolean;
  onClose: () => void;
}

export function EpisodeBrowser({ open, onClose }: EpisodeBrowserProps) {
  const selectGame = useGameStore((s) => s.selectGame);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return sampleEpisodes;
    return sampleEpisodes.filter((episode) => {
      if (episode.title.toLowerCase().includes(term)) return true;
      if (episode.data.info?.toLowerCase().includes(term)) return true;
      if (episode.data.airDate?.includes(term)) return true;
      const categories = (episode.data.jeopardy ?? []).flatMap((row) =>
        row.cat || row.category ? [(row.cat ?? row.category)!.toLowerCase()] : [],
      );
      return categories.some((cat) => cat.includes(term));
    });
  }, [query]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Episodes</DialogTitle>
      <DialogContent dividers>
        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          sx={{ mb: 2 }}
        />
        <Stack spacing={1.5}>
          {filtered.map((episode) => {
            const data = episode.data;
            const categories = new Set<string>();
            for (const row of data.jeopardy ?? []) {
              const name = row.cat ?? row.category;
              if (name) categories.add(name);
            }
            return (
              <Paper key={episode.id} variant="outlined" sx={{ p: 2 }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  sx={{ alignItems: { sm: "center" } }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }}>{episode.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {data.airDate ?? ""} {data.info ? `· ${data.info}` : ""}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={0.5}
                      useFlexGap
                      sx={{ mt: 1, flexWrap: "wrap" }}
                    >
                      {Array.from(categories)
                        .slice(0, 6)
                        .map((cat) => (
                          <Chip key={cat} size="small" label={cat} variant="outlined" />
                        ))}
                    </Stack>
                  </Box>
                  <Button
                    variant="contained"
                    onClick={() => {
                      selectGame(episode.id);
                      onClose();
                    }}
                  >
                    Use
                  </Button>
                </Stack>
              </Paper>
            );
          })}
          {filtered.length === 0 ? (
            <Typography color="text.secondary" variant="caption">—</Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
