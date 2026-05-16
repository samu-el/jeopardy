"use client";

import { useEffect, useMemo, useState } from "react";
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
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ShuffleIcon from "@mui/icons-material/ShuffleOutlined";
import {
  decadeOptions,
  fetchArchiveStats,
  fetchDecadeCounts,
  fetchEpisodeById,
  fetchEpisodeList,
  fetchRandomEpisode,
  fetchThemeCounts,
  themeOptions,
  type ArchiveListing,
} from "@/lib/data";
import { useGameStore } from "@/lib/state/game-store";

interface GamePickerProps {
  open: boolean;
  onClose: () => void;
}

type Mode = "random" | "theme" | "number";

export function GamePicker({ open, onClose }: GamePickerProps) {
  const setLoadedEpisode = useGameStore((s) => s.setLoadedEpisode);
  const [mode, setMode] = useState<Mode>("random");
  const [theme, setTheme] = useState("all");
  const [decade, setDecade] = useState("all");
  const [numberInput, setNumberInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listings, setListings] = useState<ArchiveListing[]>([]);
  const [stats, setStats] = useState<{ total: number } | null>(null);
  const [themeCountMap, setThemeCountMap] = useState<Record<string, number>>({});
  const [decadeCountMap, setDecadeCountMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchArchiveStats().then((value) => {
      if (!cancelled) setStats(value);
    });
    fetchThemeCounts().then((value) => {
      if (!cancelled) setThemeCountMap(value);
    });
    fetchDecadeCounts().then((value) => {
      if (!cancelled) setDecadeCountMap(value);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || mode !== "theme") return;
    let cancelled = false;
    const id = setTimeout(() => {
      if (cancelled) return;
      setBusy(true);
      setError(null);
      fetchEpisodeList({ theme, decade, limit: 30 })
        .then((response) => {
          if (cancelled) return;
          setListings(response.episodes);
        })
        .catch((err: Error) => {
          if (!cancelled) setError(err.message);
        })
        .finally(() => {
          if (!cancelled) setBusy(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [open, mode, theme, decade]);

  async function pickRandom() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetchRandomEpisode(theme, decade);
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

  async function pickById(id: string) {
    setBusy(true);
    setError(null);
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

  const themesAvailable = useMemo(() => {
    if (Object.keys(themeCountMap).length === 0) return themeOptions;
    return themeOptions.filter(
      (entry) => entry.id === "all" || (themeCountMap[entry.id] ?? 0) > 0,
    );
  }, [themeCountMap]);

  const decadesAvailable = useMemo(() => {
    if (Object.keys(decadeCountMap).length === 0) return decadeOptions;
    return decadeOptions.filter(
      (entry) => entry.id === "all" || (decadeCountMap[entry.id] ?? 0) > 0,
    );
  }, [decadeCountMap]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        New game
        {stats ? (
          <Typography variant="caption" sx={{ ml: 1, color: "text.secondary" }}>
            {stats.total.toLocaleString()} episodes
          </Typography>
        ) : null}
      </DialogTitle>
      <DialogContent dividers>
        <Tabs value={mode} onChange={(_, value) => setMode(value)} sx={{ mb: 2 }}>
          <Tab value="random" label="Random" />
          <Tab value="theme" label="Theme" />
          <Tab value="number" label="By number" />
        </Tabs>

        {mode === "random" ? (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
              {themesAvailable.map((entry) => (
                <Chip
                  key={entry.id}
                  label={entry.label}
                  color={entry.id === theme ? "primary" : "default"}
                  onClick={() => setTheme(entry.id)}
                  variant={entry.id === theme ? "filled" : "outlined"}
                />
              ))}
            </Stack>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
              {decadesAvailable.map((entry) => (
                <Chip
                  key={entry.id}
                  label={entry.label}
                  size="small"
                  color={entry.id === decade ? "secondary" : "default"}
                  onClick={() => setDecade(entry.id)}
                  variant={entry.id === decade ? "filled" : "outlined"}
                />
              ))}
            </Stack>
            <Button
              startIcon={busy ? <CircularProgress size={16} /> : <ShuffleIcon />}
              variant="contained"
              onClick={pickRandom}
              disabled={busy}
              sx={{ alignSelf: "flex-start" }}
            >
              Shuffle
            </Button>
          </Stack>
        ) : null}

        {mode === "theme" ? (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
              {themesAvailable.map((entry) => (
                <Chip
                  key={entry.id}
                  label={entry.label}
                  color={entry.id === theme ? "primary" : "default"}
                  onClick={() => setTheme(entry.id)}
                  variant={entry.id === theme ? "filled" : "outlined"}
                />
              ))}
            </Stack>
            {busy ? (
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <CircularProgress size={18} />
                <Typography variant="caption" color="text.secondary">Loading…</Typography>
              </Stack>
            ) : null}
            <Stack spacing={1} sx={{ maxHeight: 360, overflow: "auto" }}>
              {listings.map((episode) => (
                <Paper
                  key={episode.id}
                  variant="outlined"
                  sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 2 }}
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
                    onClick={() => pickById(episode.id)}
                    disabled={busy}
                  >
                    Use
                  </Button>
                </Paper>
              ))}
              {!busy && listings.length === 0 ? (
                <Typography variant="caption" color="text.secondary">—</Typography>
              ) : null}
            </Stack>
          </Stack>
        ) : null}

        {mode === "number" ? (
          <Stack spacing={2}>
            <TextField
              size="small"
              label="Episode number"
              type="number"
              value={numberInput}
              onChange={(event) => setNumberInput(event.target.value)}
              fullWidth
              onKeyDown={(event) => {
                if (event.key === "Enter" && numberInput.trim()) {
                  event.preventDefault();
                  pickById(numberInput.trim());
                }
              }}
            />
            <Button
              variant="contained"
              disabled={!numberInput.trim() || busy}
              onClick={() => pickById(numberInput.trim())}
              sx={{ alignSelf: "flex-start" }}
              startIcon={busy ? <CircularProgress size={16} /> : undefined}
            >
              Find
            </Button>
          </Stack>
        ) : null}

        {error ? (
          <Typography color="error" variant="caption" sx={{ mt: 2, display: "block" }}>
            {error}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
