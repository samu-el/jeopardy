"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  fetchEpisodeById,
  fetchEpisodeList,
  themeOptions,
  type ArchiveListing,
} from "@/lib/data";
import { useGameStore } from "@/lib/state/game-store";

interface EpisodeBrowserProps {
  open: boolean;
  onClose: () => void;
}

export function EpisodeBrowser({ open, onClose }: EpisodeBrowserProps) {
  const setLoadedEpisode = useGameStore((s) => s.setLoadedEpisode);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState("all");
  const [busy, setBusy] = useState(false);
  const [listings, setListings] = useState<ArchiveListing[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    let cancelled = false;
    debounceRef.current = setTimeout(async () => {
      if (cancelled) return;
      setBusy(true);
      try {
        const response = await fetchEpisodeList({
          theme,
          query: query.trim() || undefined,
          limit: 80,
        });
        if (cancelled) return;
        setListings(response.episodes);
        setTotal(response.total);
        setError(null);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, query, theme]);

  const themes = useMemo(() => themeOptions, []);

  async function load(id: string) {
    setBusy(true);
    try {
      const response = await fetchEpisodeById(id);
      setLoadedEpisode({
        id: response.id,
        title: response.episode.title ?? `Episode ${response.id}`,
        airDate: response.episode.airDate,
        info: response.episode.info,
        episode: response.episode,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Episodes
        <Typography variant="caption" sx={{ ml: 1, color: "text.secondary" }}>
          {total ? `${total.toLocaleString()} matches` : null}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="Search by number, air date, info"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            {themes.map((entry) => (
              <Chip
                key={entry.id}
                label={entry.label}
                color={entry.id === theme ? "primary" : "default"}
                variant={entry.id === theme ? "filled" : "outlined"}
                onClick={() => setTheme(entry.id)}
              />
            ))}
          </Stack>
          {busy ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">Loading…</Typography>
            </Stack>
          ) : null}
          <Stack spacing={1} sx={{ maxHeight: 480, overflow: "auto" }}>
            {listings.map((episode) => (
              <Paper key={episode.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  sx={{ alignItems: { sm: "center" } }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }}>#{episode.number}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {episode.airDate ?? ""}
                      {episode.info ? ` · ${episode.info}` : ""}
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => load(episode.id)}
                    disabled={busy}
                  >
                    Use
                  </Button>
                </Stack>
              </Paper>
            ))}
            {!busy && listings.length === 0 ? (
              <Typography variant="caption" color="text.secondary">—</Typography>
            ) : null}
          </Stack>
          {error ? (
            <Typography color="error" variant="caption">{error}</Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
