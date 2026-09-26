"use client";

import { useId, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
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
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import EditNoteIcon from "@mui/icons-material/EditNoteOutlined";
import ShuffleIcon from "@mui/icons-material/ShuffleOutlined";
import {
  decadeOptions,
  describeEmptyFilter,
  fetchArchiveStats,
  fetchDecadeCounts,
  fetchEpisodeById,
  fetchEpisodeList,
  fetchRandomEpisode,
  type ArchiveEpisodeResponse,
  type ArchiveListing,
} from "@/lib/data";
import { primeAudio, primeSpeech } from "@/lib/ai";
import { useGameStore } from "@/lib/state/game-store";
import { ConfirmDialog } from "./ConfirmDialog";
import { CustomGameBuilder } from "./CustomGameBuilder";
import {
  describeArchiveError,
  useArchiveThemes,
  useEpisodeChooser,
  useWhileOpen,
  type ArchiveProblem,
} from "./use-archive";
import { useRoomRole } from "./use-room-role";

interface GamePickerProps {
  open: boolean;
  onClose: () => void;
}

type Mode = "shuffle" | "browse" | "number";

const pageSize = 60;

/**
 * Choose a game: shuffle one, search the archive, type a number, or write
 * your own.
 *
 * Picking a game in the middle of one deals it for the whole room, after
 * asking; picking one before Begin stages it. Only the host changes the
 * board — anyone else is told so rather than shown controls that do nothing.
 */
export function GamePicker({ open, onClose }: GamePickerProps) {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down("sm"));
  const titleId = useId();
  const { isRoomHost, inGame } = useRoomRole();
  const [builderOpen, setBuilderOpen] = useState(false);

  return (
    <>
      <Dialog
        open={open && !builderOpen}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        fullScreen={phone}
        aria-labelledby={titleId}
      >
        {open ? (
          isRoomHost ? (
            <PickerBody
              titleId={titleId}
              inGame={inGame}
              onClose={onClose}
              onOpenBuilder={() => setBuilderOpen(true)}
            />
          ) : (
            <>
              <DialogTitle id={titleId}>Change game</DialogTitle>
              <DialogContent dividers>
                <Typography>
                  Only the host can change the game. Ask them to deal another board.
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button onClick={onClose} autoFocus>
                  Close
                </Button>
              </DialogActions>
            </>
          )
        ) : null}
      </Dialog>
      <CustomGameBuilder
        open={builderOpen}
        onClose={() => {
          setBuilderOpen(false);
          onClose();
        }}
      />
    </>
  );
}

function PickerBody({
  titleId,
  inGame,
  onClose,
  onOpenBuilder,
}: {
  titleId: string;
  inGame: boolean;
  onClose: () => void;
  onOpenBuilder: () => void;
}) {
  const startGame = useGameStore((s) => s.startGame);
  const hasRoomBoard = useGameStore((s) =>
    Boolean(s.runtime && s.publicState && s.publicState.round !== "lobby"),
  );
  const { busy, error, choose, retry } = useEpisodeChooser(onClose);
  const { themes } = useArchiveThemes(true);
  const [mode, setMode] = useState<Mode>("shuffle");
  const [theme, setTheme] = useState("all");
  const [chosenDecade, setDecade] = useState("all");
  const [query, setQuery] = useState("");
  const [numberInput, setNumberInput] = useState("");
  const [listings, setListings] = useState<ArchiveListing[]>([]);
  const [total, setTotal] = useState(0);
  const [listState, setListState] = useState<"loading" | "ready" | "more">("loading");
  const [listError, setListError] = useState<ArchiveProblem | null>(null);
  const [listNonce, setListNonce] = useState(0);
  const [stats, setStats] = useState<{ total: number } | null>(null);
  const [decadeCounts, setDecadeCounts] = useState<Record<string, number>>({});
  const [confirming, setConfirming] = useState<(() => Promise<ArchiveEpisodeResponse>) | null>(
    null,
  );

  useWhileOpen(true, fetchArchiveStats, setStats);
  // The eras on offer follow the theme, so a pair of chips never leads nowhere.
  useWhileOpen(true, () => fetchDecadeCounts(theme), setDecadeCounts, [theme]);

  const decades = useMemo(
    () =>
      Object.keys(decadeCounts).length === 0
        ? decadeOptions
        : decadeOptions.filter(
            (entry) => entry.id === "all" || (decadeCounts[entry.id] ?? 0) > 0,
          ),
    [decadeCounts],
  );
  // An era the chosen theme doesn't have falls back to all of them.
  const decade = decades.some((entry) => entry.id === chosenDecade) ? chosenDecade : "all";

  const trimmedQuery = query.trim();
  // Typing shouldn't fire a request per keystroke.
  useWhileOpen(
    mode === "browse",
    () => {
      setListState("loading");
      setListError(null);
      return fetchEpisodeList({ theme, decade, query: trimmedQuery || undefined, limit: pageSize });
    },
    (response) => {
      setListings(response.episodes);
      setTotal(response.total);
      setListState("ready");
    },
    [mode, theme, decade, trimmedQuery, listNonce],
    250,
    (err) => {
      setListError(describeArchiveError(err));
      setListState("ready");
    },
  );

  async function loadMore() {
    setListState("more");
    setListError(null);
    try {
      const response = await fetchEpisodeList({
        theme,
        decade,
        query: trimmedQuery || undefined,
        limit: pageSize,
        offset: listings.length,
      });
      setListings((current) => [...current, ...response.episodes]);
      setTotal(response.total);
    } catch (err) {
      setListError(describeArchiveError(err));
    } finally {
      setListState("ready");
    }
  }


  /** Mid-game, a new board ends the current one for everyone: ask first. */
  function pick(fetchEpisode: () => Promise<ArchiveEpisodeResponse>) {
    primeAudio();
    primeSpeech();
    if (inGame) {
      setConfirming(() => fetchEpisode);
      return;
    }
    // A room showing results deals the new board straight away; a lobby
    // waits for Begin.
    void choose(fetchEpisode, hasRoomBoard ? startGame : undefined);
  }

  const pickById = (id: string) => pick(() => fetchEpisodeById(id));
  const filterNote = describeEmptyFilter(theme, decade);

  return (
    <>
      <DialogTitle id={titleId}>
        Change game
        {stats && stats.total > 0 ? (
          <Typography variant="caption" sx={{ ml: 1, color: "text.secondary" }}>
            {stats.total.toLocaleString()} episodes
          </Typography>
        ) : null}
      </DialogTitle>
      <DialogContent dividers>
        {inGame ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            A game is in progress. Choosing a new one replaces the board for everyone.
          </Typography>
        ) : null}
        <Tabs
          value={mode}
          onChange={(_, value) => setMode(value)}
          variant="fullWidth"
          sx={{ mb: 2 }}
          aria-label="How to choose"
        >
          <Tab value="shuffle" label="Shuffle" />
          <Tab value="browse" label="Browse" />
          <Tab value="number" label="Number" />
        </Tabs>

        <Stack spacing={2}>
          {mode !== "number" ? (
            <ChipRow label="Theme" options={themes} selected={theme} onSelect={setTheme} />
          ) : null}
          {mode !== "number" ? (
            <ChipRow label="Era" options={decades} selected={decade} onSelect={setDecade} small />
          ) : null}

          {mode === "shuffle" ? (
            <Button
              startIcon={busy ? <CircularProgress size={16} /> : <ShuffleIcon />}
              variant="contained"
              onClick={() => pick(() => fetchRandomEpisode(theme, decade))}
              disabled={busy}
              sx={{ alignSelf: "flex-start" }}
            >
              {busy ? "Dealing…" : "Shuffle"}
            </Button>
          ) : null}

          {mode === "browse" ? (
            <>
              <TextField
                size="small"
                label="Search categories, dates and events"
                placeholder="e.g. potent potables, 1999, college"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                fullWidth
                slotProps={{ htmlInput: { enterKeyHint: "search" } }}
              />
              <Typography variant="caption" color="text.secondary" aria-live="polite">
                {listState === "loading"
                  ? "Loading episodes…"
                  : listError
                    ? " "
                    : total === 0
                      ? "No episodes"
                      : `Showing ${listings.length.toLocaleString()} of ${total.toLocaleString()}`}
              </Typography>
              <Stack spacing={1} sx={{ maxHeight: { xs: "none", sm: 360 }, overflow: "auto" }}>
                {listState === "loading" ? (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                    <CircularProgress size={24} aria-label="Loading episodes" />
                  </Box>
                ) : (
                  listings.map((episode) => (
                    <EpisodeRow
                      key={episode.id}
                      episode={episode}
                      busy={busy}
                      onUse={() => pickById(episode.id)}
                    />
                  ))
                )}
                {listState !== "loading" && !listError && listings.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {trimmedQuery
                      ? `Nothing matched “${trimmedQuery}”${theme !== "all" || decade !== "all" ? " with these filters" : ""}. Try another word${theme !== "all" || decade !== "all" ? " or set Theme and Era back to All" : ""}.`
                      : filterNote}
                  </Typography>
                ) : null}
                {listState !== "loading" && listings.length < total ? (
                  <Button
                    onClick={loadMore}
                    disabled={listState === "more"}
                    startIcon={listState === "more" ? <CircularProgress size={16} /> : undefined}
                    sx={{ alignSelf: "center" }}
                  >
                    Show {Math.min(pageSize, total - listings.length)} more
                  </Button>
                ) : null}
              </Stack>
              {listError ? (
                <Alert
                  severity="error"
                  action={
                    listError.retryable ? (
                      <Button color="inherit" size="small" onClick={() => setListNonce((n) => n + 1)}>
                        Retry
                      </Button>
                    ) : undefined
                  }
                >
                  {listError.message}
                </Alert>
              ) : null}
            </>
          ) : null}

          {mode === "number" ? (
            <>
              <TextField
                size="small"
                label="Episode number"
                value={numberInput}
                onChange={(event) => setNumberInput(event.target.value.replace(/[^\d]/g, ""))}
                fullWidth
                slotProps={{ htmlInput: { inputMode: "numeric", enterKeyHint: "go" } }}
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
            <Alert
              severity="error"
              role="alert"
              action={
                error.retryable && retry ? (
                  <Button color="inherit" size="small" onClick={retry}>
                    Retry
                  </Button>
                ) : undefined
              }
            >
              {error.message}
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: "space-between" }}>
        <Button startIcon={<EditNoteIcon />} onClick={onOpenBuilder} data-testid="picker-build">
          Build your own
        </Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>

      <ConfirmDialog
        open={Boolean(confirming)}
        title="Replace the board for everyone?"
        confirmLabel="Replace and play"
        cancelLabel="Keep playing"
        destructive
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          const fetchEpisode = confirming;
          setConfirming(null);
          if (fetchEpisode) void choose(fetchEpisode, startGame);
        }}
      >
        <Typography variant="body2">
          The game in progress ends and every score goes back to zero. The new board is dealt
          straight away.
        </Typography>
      </ConfirmDialog>
    </>
  );
}

function ChipRow({
  label,
  options,
  selected,
  onSelect,
  small,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
  small?: boolean;
}) {
  return (
    <Stack
      direction="row"
      spacing={1}
      useFlexGap
      sx={{ flexWrap: "wrap" }}
      role="group"
      aria-label={label}
    >
      {options.map((entry) => (
        <Chip
          key={entry.id}
          label={entry.label}
          size={small ? "small" : "medium"}
          color={entry.id === selected ? "primary" : "default"}
          variant={entry.id === selected ? "filled" : "outlined"}
          aria-pressed={entry.id === selected}
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
        <Typography variant="caption" color="text.secondary" noWrap component="p">
          {episode.airDate ?? ""}
          {episode.info ? ` · ${episode.info}` : ""}
        </Typography>
      </Box>
      <Button
        variant="contained"
        size="small"
        onClick={onUse}
        disabled={busy}
        aria-label={`Play episode ${episode.number}`}
      >
        Use
      </Button>
    </Paper>
  );
}
