"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addCategory as addCategoryTo,
  addClueRow,
  buildNormalizedGame,
  builderCsvTemplate,
  builderGameToCsv,
  builderGameToJSON,
  builderProgress,
  editTokenFor,
  emptyBuilderGame,
  importBuilderGame,
  isDraftTouched,
  publishGame,
  removeCategory as removeCategoryFrom,
  removeClueRow,
  roundsInDraft,
  sortColumn,
  validateBuilderGame,
  type BoardRound,
  type BuilderClue,
  type BuilderGame,
  type GameDataIssue,
} from "@/lib/data";
import { useGameStore } from "@/lib/state/game-store";

export type BuilderTab = BoardRound | "final";

/** The id of the input an issue is about, so the summary can jump to it. */
export function issueFieldId(issue: GameDataIssue): string | undefined {
  if (issue.field === "title") return "bf-title";
  if (issue.field?.startsWith("final.")) return `bf-final-${issue.field.slice(6)}`;
  if (issue.clueId && issue.field) return `bf-${issue.clueId}-${issue.field}`;
  if (issue.categoryId) return `bf-cat-${issue.categoryId}`;
  return undefined;
}

export function issueTab(issue: GameDataIssue): BuilderTab | undefined {
  if (issue.round === "final-jeopardy") return "final";
  return issue.round;
}

function download(name: string, type: string, body: string) {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function safeFileName(title: string) {
  return (title.trim() || "custom-game").replace(/[^\w\- ]+/g, "").trim() || "custom-game";
}

export interface PendingImport {
  fileName: string;
  game: BuilderGame;
  issues: GameDataIssue[];
}

/**
 * The game being written, and everything that can be done to it.
 *
 * The draft is saved as it is typed, whether or not it would play yet: an
 * unfinished board is exactly the one worth keeping over a refresh.
 */
export function useBuilderDraft() {
  const saveDraft = useGameStore((s) => s.saveBuilderDraft);
  const [draft, setDraftState] = useState<BuilderGame>(
    () => useGameStore.getState().lobby.builderDraft ?? emptyBuilderGame(),
  );
  const [tab, setTab] = useState<BuilderTab>("jeopardy");
  /** Errors are shown on every field once someone has tried to use the game. */
  const [attempted, setAttempted] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<{
    ok: boolean;
    fileName: string;
    issues: GameDataIssue[];
  } | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Autosave, debounced, and flushed when the dialog closes.
  const latest = useRef(draft);
  const dirty = useRef(false);
  useEffect(() => {
    latest.current = draft;
    if (!dirty.current) return;
    const timer = setTimeout(() => {
      saveDraft(draft);
      dirty.current = false;
      setSavedAt(Date.now());
    }, 400);
    return () => clearTimeout(timer);
  }, [draft, saveDraft]);
  useEffect(
    () => () => {
      if (dirty.current) saveDraft(latest.current);
    },
    [saveDraft],
  );

  function setDraft(update: BuilderGame | ((current: BuilderGame) => BuilderGame)) {
    dirty.current = true;
    setDraftState(update);
  }

  const issues = useMemo(() => validateBuilderGame(draft), [draft]);
  const errors = useMemo(() => issues.filter((issue) => issue.severity === "error"), [issues]);
  const warnings = useMemo(
    () => issues.filter((issue) => issue.severity === "warning"),
    [issues],
  );
  const progress = useMemo(() => builderProgress(draft), [draft]);
  const rounds = useMemo(() => roundsInDraft(draft), [draft]);

  /** Field id → message, for the inputs themselves. */
  const fieldErrors = useMemo(() => {
    const map = new Map<string, string>();
    // Some problems are worth saying while typing; the rest wait for a try.
    const live = new Set(["too-long", "duplicate-category", "invalid-value"]);
    for (const issue of errors) {
      if (!attempted && !live.has(issue.code)) continue;
      const id = issueFieldId(issue);
      if (id && !map.has(id)) map.set(id, issue.message.replace(/^.*?: /, ""));
    }
    return map;
  }, [errors, attempted]);

  const hasPublishedLink = Boolean(draft.publishedId && editTokenFor(draft.publishedId));

  function updateClue(id: string, patch: Partial<BuilderClue>) {
    setDraft((current) => ({
      ...current,
      clues: current.clues.map((clue) => (clue.id === id ? { ...clue, ...patch } : clue)),
    }));
  }

  /** A value is committed on blur, and only then does its column re-sort. */
  function commitValue(id: string, value: number) {
    setDraft((current) => {
      const clue = current.clues.find((entry) => entry.id === id);
      if (!clue) return current;
      const updated = {
        ...current,
        clues: current.clues.map((entry) => (entry.id === id ? { ...entry, value } : entry)),
      };
      return sortColumn(updated, clue.categoryId, clue.round);
    });
  }

  function updateCategoryName(id: string, name: string) {
    setDraft((current) => ({
      ...current,
      categories: current.categories.map((cat) => (cat.id === id ? { ...cat, name } : cat)),
    }));
  }

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

  const addCategory = (round: BoardRound) => setDraft((current) => addCategoryTo(current, round));
  const removeCategory = (id: string, round: BoardRound) =>
    setDraft((current) => removeCategoryFrom(current, id, round));
  const addRow = (categoryId: string, round: BoardRound) =>
    setDraft((current) => addClueRow(current, categoryId, round));
  const removeRow = (clueId: string) => setDraft((current) => removeClueRow(current, clueId));

  function resetDraft() {
    setDraft(emptyBuilderGame());
    setAttempted(false);
    setShareUrl(null);
    setPublishError(null);
    setImportReport(null);
    setTab("jeopardy");
  }

  function exportJson() {
    download(`${safeFileName(draft.title)}.json`, "application/json", builderGameToJSON(draft));
  }

  function exportCsv() {
    download(`${safeFileName(draft.title)}.csv`, "text/csv", builderGameToCsv(draft));
  }

  function downloadTemplate() {
    download("jeopardy-template.csv", "text/csv", builderCsvTemplate());
  }

  function acceptImport(pending: PendingImport) {
    setDraft(pending.game);
    setPendingImport(null);
    setAttempted(false);
    setShareUrl(null);
    setTab(roundsInDraft(pending.game)[0] ?? "jeopardy");
    setImportReport({ ok: true, fileName: pending.fileName, issues: pending.issues });
  }

  /** Reads a JSON or CSV file; asks before replacing a draft that has work in it. */
  function importFile(file: File) {
    const reader = new FileReader();
    reader.onerror = () =>
      setImportReport({
        ok: false,
        fileName: file.name,
        issues: [{ severity: "error", code: "empty-input", message: "The file couldn't be read." }],
      });
    reader.onload = () => {
      const result = importBuilderGame(String(reader.result ?? ""), file.name);
      if (!result.ok) {
        setImportReport({ ok: false, fileName: file.name, issues: result.issues });
        return;
      }
      const pending = { fileName: file.name, game: result.game, issues: result.issues };
      if (isDraftTouched(latest.current)) setPendingImport(pending);
      else acceptImport(pending);
    };
    reader.readAsText(file);
  }

  /** The game ready to play, or null (with errors now shown) when it won't build. */
  function build() {
    setAttempted(true);
    const result = buildNormalizedGame(draft);
    return result.ok ? result.game : null;
  }

  /**
   * Puts the game where other people can open it. A game published from this
   * browser before is updated in place, so the link already sent keeps working.
   */
  async function publish(asNew = false) {
    const game = build();
    if (!game) return false;
    setPublishError(null);
    setPublishing(true);
    try {
      const existingId = !asNew && hasPublishedLink ? draft.publishedId : undefined;
      const published = await publishGame(
        { title: draft.title.trim() || "Custom game", clues: game.clues },
        existingId,
      );
      if (!published.ok) {
        setPublishError(published.error ?? "Could not publish that game.");
        return false;
      }
      setDraft((current) => ({ ...current, publishedId: published.id }));
      setShareUrl(published.shareUrl ?? null);
      return true;
    } finally {
      setPublishing(false);
    }
  }

  return {
    draft,
    setDraft,
    tab,
    setTab,
    rounds,
    issues,
    errors,
    warnings,
    progress,
    attempted,
    fieldErrors,
    publishing,
    publishError,
    shareUrl,
    savedAt,
    hasPublishedLink,
    importReport,
    dismissImportReport: () => setImportReport(null),
    pendingImport,
    acceptImport,
    cancelImport: () => setPendingImport(null),
    updateClue,
    commitValue,
    updateCategoryName,
    updateFinal,
    addCategory,
    removeCategory,
    addRow,
    removeRow,
    resetDraft,
    exportJson,
    exportCsv,
    downloadTemplate,
    importFile,
    build,
    publish,
  };
}

export type BuilderDraft = ReturnType<typeof useBuilderDraft>;
