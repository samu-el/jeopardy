"use client";

import { useEffect, useState } from "react";
import { fetchThemeCounts, themeOptions, type ArchiveEpisodeResponse } from "@/lib/data";
import { useGameStore } from "@/lib/state/game-store";

/**
 * Runs a fetch while a dialog is open, and throws the answer away if the
 * dialog closed first.
 *
 * Both archive dialogs had their own copy of the cancelled-flag dance, four
 * times over between them.
 */
export function useWhileOpen<T>(
  open: boolean,
  load: () => Promise<T>,
  apply: (value: T) => void,
  deps: unknown[] = [],
  debounceMs = 0,
) {
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const run = () => {
      load().then((value) => {
        if (!cancelled) apply(value);
      });
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

/**
 * Puts an episode on the lobby's board, with the busy-and-error bookkeeping
 * every way of choosing one needs: shuffle, pick by number, pick from a list.
 */
export function useEpisodeChooser(onChosen: () => void) {
  const setLoadedEpisode = useGameStore((s) => s.setLoadedEpisode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(fetchEpisode: () => Promise<ArchiveEpisodeResponse>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetchEpisode();
      setLoadedEpisode({
        id: response.id,
        title: response.episode.title ?? `Episode ${response.id}`,
        airDate: response.episode.airDate,
        info: response.episode.info,
        episode: response.episode,
      });
      onChosen();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return { busy, setBusy, error, setError, choose };
}
