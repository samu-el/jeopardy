"use client";

import type { GameCommand, GameEvent } from "@/lib/game";

const STORAGE_KEY = "jeopardy.replay.v1";
const MAX_ENTRIES = 4_000;

export interface ReplayEntry {
  t: number;
  cmd?: GameCommand;
  events?: GameEvent[];
}

export interface ReplayLog {
  roomId: string;
  startedAt: number;
  entries: ReplayEntry[];
}

let active: ReplayLog | null = null;

export function beginReplayLog(roomId: string) {
  active = { roomId, startedAt: Date.now(), entries: [] };
}

export function recordCommand(command: GameCommand) {
  if (!active) return;
  active.entries.push({ t: Date.now(), cmd: command });
  if (active.entries.length > MAX_ENTRIES) {
    active.entries = active.entries.slice(-MAX_ENTRIES);
  }
}

export function recordEvents(events: GameEvent[]) {
  if (!active) return;
  active.entries.push({ t: Date.now(), events });
  if (active.entries.length > MAX_ENTRIES) {
    active.entries = active.entries.slice(-MAX_ENTRIES);
  }
}

export function persistReplayLog(): void {
  if (typeof window === "undefined" || !active) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(active));
  } catch {
    // ignore quota issues
  }
}

export function loadLastReplay(): ReplayLog | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ReplayLog;
  } catch {
    return null;
  }
}

export function clearReplayLog() {
  active = null;
}
