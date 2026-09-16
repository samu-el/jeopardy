"use client";

import { useMemo, useState } from "react";
import {
  buildNormalizedGame,
  builderGameToJSON,
  emptyBuilderGame,
  parseBuilderGame,
  publishGame,
  type BuilderClue,
  type BuilderGame,
} from "@/lib/data";
import type { PlayableRound } from "@/lib/game";
import { useGameStore } from "@/lib/state/game-store";

/** The first few blocking problems, in the order the builder lists them. */
function firstProblems(issues: { severity: string; message: string }[]): string {
  return (
    issues
      .filter((issue) => issue.severity === "error")
      .slice(0, 3)
      .map((issue) => issue.message)
      .join("; ") || "Validation failed."
  );
}

/**
 * The game being written, and everything that can be done to it.
 *
 * Kept out of the dialog so the dialog is only layout: a 347-line component
 * where the state, the file handling, the publishing and the markup were all
 * one function is a component nobody can read the middle of.
 */
export function useBuilderDraft(onClose: () => void) {
  const setCustomGame = useGameStore((s) => s.setCustomGame);
  const saveDraft = useGameStore((s) => s.saveBuilderDraft);
  const initial = useGameStore((s) => s.lobby.builderDraft) ?? emptyBuilderGame();

  const [draft, setDraft] = useState<BuilderGame>(initial);
  const [round, setRound] = useState<PlayableRound>("jeopardy");
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const cluesByCategory = useMemo(() => {
    const map = new Map<string, BuilderClue[]>();
    for (const clue of draft.clues) {
      if (clue.round !== round) continue;
      map.set(clue.categoryId, [...(map.get(clue.categoryId) ?? []), clue]);
    }
    return map;
  }, [draft, round]);

  function updateClue(id: string, patch: Partial<BuilderClue>) {
    setDraft((current) => ({
      ...current,
      clues: current.clues.map((clue) => (clue.id === id ? { ...clue, ...patch } : clue)),
    }));
  }

  function updateCategoryName(id: string, name: string) {
    setDraft((current) => ({
      ...current,
      categories: current.categories.map((cat) => (cat.id === id ? { ...cat, name } : cat)),
    }));
  }

  /** The three Final fields edit one object, so they share one setter. */
  function updateFinal(patch: Partial<NonNullable<BuilderGame["finalClue"]>>) {
    setDraft((current) => ({
      ...current,
      finalClue: {
        category: current.finalClue?.category ?? "",
        clue: current.finalClue?.clue ?? "",
        correctResponse: current.finalClue?.correctResponse ?? "",
        ...patch,
      },
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

  /** Validates, saves and stages the game; returns false when it won't build. */
  function stage(): boolean {
    const result = buildNormalizedGame(draft);
    if (!result.ok) {
      setError(firstProblems(result.issues));
      return false;
    }
    setError(null);
    saveDraft(draft);
    setCustomGame(result.game, result.issues);
    return true;
  }

  function commit() {
    if (stage()) onClose();
  }

  /**
   * Saves the game and puts it where other people can open it. A game that
   * only exists in this browser can't be played with anyone, which is the
   * reason to build one.
   */
  async function publish() {
    const result = buildNormalizedGame(draft);
    if (!result.ok) {
      setError(firstProblems(result.issues));
      return;
    }
    setError(null);
    setPublishing(true);
    try {
      const published = await publishGame({
        title: draft.title || "Custom game",
        clues: result.game.clues,
      });
      if (!published.ok) {
        setError(published.error ?? "Could not publish that game.");
        return;
      }
      // Keep playing it here too: publishing is sharing, not exporting.
      stage();
      setShareUrl(published.shareUrl ?? null);
    } finally {
      setPublishing(false);
    }
  }

  return {
    draft,
    setDraft,
    round,
    setRound,
    cluesByCategory,
    error,
    publishing,
    shareUrl,
    updateClue,
    updateCategoryName,
    updateFinal,
    exportJson,
    importJson,
    commit,
    publish,
  };
}
