"use client";

import { useMemo, useState } from "react";
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
  type ArchiveListing,
} from "@/lib/data";
import { useArchiveThemes, useEpisodeChooser, useWhileOpen } from "./use-archive";

interface GamePickerProps {
  open: boolean;
  onClose: () => void;
}

type Mode = "shuffle" | "browse" | "number";

/**
 * Choose a game: shuffle one, search the archive, or type a number.
 *
 * This used to be two dialogs behind two different menu items — one that
 * shuffled and one that searched — with their own copies of the theme chips,
 * the episode list and the fetch bookkeeping.
 */
export function GamePicker({ open, onClose }: GamePickerProps) {
  const { busy, setBusy, error, setError, choose } = useEpisodeChooser(onClose);
  const { themes } = useArchiveThemes(open);
  const [mode, setMode] = useState<Mode>("shuffle");
  const [theme, setTheme] = useState("all");
  const [decade, setDecade] = useState("all");
  const [query, setQuery] = useState("");
  const [numberInput, setNumberInput] = useState("");
  const [listings, setListings] = useState<ArchiveListing[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<{ total: number } | null>(null);
  const [decadeCounts, setDecadeCounts] = useState<Record<string, number>>({});

  useWhileOpen(open, fetchArchiveStats, setStats);
  useWhileOpen(open, fetchDecadeCounts, setDecadeCounts);
  // Typing shouldn't fire a request per keystroke.
  useWhileOpen(
    open && mode === "browse",
    () => fetchEpisodeList({ theme, decade, query: query.trim() || undefined, limit: 60 }),
    (response) => {
      setListings(response.episodes);
      setTotal(response.total);
      setBusy(false);
      setError(null);
    },
    [mode, theme, decade, query],
    250,
  );

  const decades = useMemo(
    () =>
      Object.keys(decadeCounts).length === 0
        ? decadeOptions
        : decadeOptions.filter(
            (entry) => entry.id === "all" || (decadeCounts[entry.id] ?? 0) > 0,
          ),
    [decadeCounts],
  );

  const pickById = (id: string) => choose(() => fetchEpisodeById(id));

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
          <Tab value="shuffle" label="Shuffle" />
          <Tab value="browse" label="Browse" />
          <Tab value="number" label="By number" />
        </Tabs>

        <Stack spacing={2}>
          {mode !== "number" ? (
            <ChipRow options={themes} selected={theme} onSelect={setTheme} />
          ) : null}
          {mode !== "number" ? (
            <ChipRow options={decades} selected={decade} onSelect={setDecade} small />
          ) : null}

          {mode === "shuffle" ? (
            <Button
              startIcon={busy ? <CircularProgress size={16} /> : <ShuffleIcon />}
              variant="contained"
              onClick={() => choose(() => fetchRandomEpisode(theme, decade))}
              disabled={busy}
              sx={{ alignSelf: "flex-start" }}
            >
              Shuffle
            </Button>
          ) : null}

          {mode === "browse" ? (
            <>
              <TextField
                size="small"
                label="Search categories and episodes"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                fullWidth
              />
              <Typography variant="caption" color="text.secondary">
                {busy ? "Loading…" : `${total.toLocaleString()} matching`}
              </Typography>
              <Stack spacing={1} sx={{ maxHeight: 360, overflow: "auto" }}>
                {listings.map((episode) => (
                  <EpisodeRow
                    key={episode.id}
                    episode={episode}
                    busy={busy}
                    onUse={() => pickById(episode.id)}
                  />
                ))}
                {!busy && listings.length === 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    Nothing matched.
                  </Typography>
                ) : null}
              </Stack>
            </>
          ) : null}

          {mode === "number" ? (
            <>
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
            </>
          ) : null}

          {error ? (
            <Typography color="error" variant="caption">
              {error}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function ChipRow({
  options,
  selected,
  onSelect,
  small,
}: {
  options: { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
  small?: boolean;
}) {
  return (
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
      {options.map((entry) => (
        <Chip
          key={entry.id}
          label={entry.label}
          size={small ? "small" : "medium"}
          color={entry.id === selected ? "primary" : "default"}
          variant={entry.id === selected ? "filled" : "outlined"}
          onClick={() => onSelect(entry.id)}
        />
      ))}
    </Stack>
  );
}

function EpisodeRow({
  episode,
  busy,
  onUse,
}: {
  episode: ArchiveListing;
  busy: boolean;
  onUse: () => void;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 2 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700 }}>#{episode.number}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {episode.airDate ?? ""}
          {episode.info ? ` · ${episode.info}` : ""}
        </Typography>
      </Box>
      <Button variant="contained" size="small" onClick={onUse} disabled={busy}>
        Use
      </Button>
    </Paper>
  );
}
