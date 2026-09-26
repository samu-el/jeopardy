"use client";

import { useEffect, useState } from "react";
import {
  ArchiveError,
  archiveOfflineMessage,
  fetchThemeCounts,
  themeOptions,
  type ArchiveEpisodeResponse,
} from "@/lib/data";
import { useGameStore } from "@/lib/state/game-store";

/**
 * Runs a fetch while a dialog is open, and throws the answer away if the
 * dialog closed first. A failure goes to `fail` instead of becoming an
 * unhandled rejection behind a screen that says "Nothing matched".
 */
export function useWhileOpen<T>(
  open: boolean,
  load: () => Promise<T>,
  apply: (value: T) => void,
  deps: unknown[] = [],
  debounceMs = 0,
  fail?: (error: unknown) => void,
) {
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const run = () => {
      load().then(
        (value) => {
          if (!cancelled) apply(value);
        },
        (error: unknown) => {
          if (!cancelled) fail?.(error);
        },
      );
    };
    const timer = debounceMs > 0 ? setTimeout(run, debounceMs) : (run(), undefined);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // The caller names what this depends on; `load` and `apply` are closures
    // rebuilt every render and would otherwise re-run it forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, debounceMs, ...deps]);
}

/** The themes the archive actually has episodes for. */
export function useArchiveThemes(open: boolean) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  useWhileOpen(open, fetchThemeCounts, setCounts);
  return Object.keys(counts).length === 0
    ? { themes: themeOptions, counts }
    : {
        themes: themeOptions.filter(
          (entry) => entry.id === "all" || (counts[entry.id] ?? 0) > 0,
        ),
        counts,
      };
}

/** A failure in words a person can act on, and whether Retry makes sense. */
export interface ArchiveProblem {
  message: string;
  retryable: boolean;
}

export function describeArchiveError(error: unknown): ArchiveProblem {
  if (error instanceof ArchiveError) {
    return { message: error.message, retryable: error.retryable };
  }
  return { message: archiveOfflineMessage, retryable: true };
}

/**
 * Puts an episode on the lobby's board, with the busy-and-error bookkeeping
 * every way of choosing one needs: shuffle, pick by number, pick from a list.
 */
export function useEpisodeChooser(onChosen: () => void) {
  const setLoadedEpisode = useGameStore((s) => s.setLoadedEpisode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ArchiveProblem | null>(null);
  const [lastAttempt, setLastAttempt] = useState<(() => void) | null>(null);

  async function choose(
    fetchEpisode: () => Promise<ArchiveEpisodeResponse>,
    after?: () => void,
  ) {
    setBusy(true);
    setError(null);
    setLastAttempt(() => () => void choose(fetchEpisode, after));
    try {
      const response = await fetchEpisode();
      setLoadedEpisode({
        id: response.id,
        title: response.episode.title ?? `Episode ${response.id}`,
        airDate: response.episode.airDate,
        info: response.episode.info,
        episode: response.episode,
      });
      after?.();
      onChosen();
    } catch (err) {
      setError(describeArchiveError(err));
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, setError, choose, retry: lastAttempt };
}
