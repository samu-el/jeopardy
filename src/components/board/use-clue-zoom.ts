"use client";

import { useEffect, type RefObject } from "react";

/**
 * Grows the clue panel out of the square that was picked, the way the set's
 * monitor expands the selected cell. Driven straight through the Web
 * Animations API so no render depends on a measurement.
 */
export function useClueZoom(
  containerRef: RefObject<HTMLDivElement | null>,
  overlayRef: RefObject<HTMLDivElement | null>,
  tileRefs: RefObject<Map<string, HTMLElement>>,
  activeClueId: string | null,
  reducedMotion: boolean,
) {
  useEffect(() => {
    if (!activeClueId || reducedMotion) return;
    const container = containerRef.current;
    const overlay = overlayRef.current;
    const tile = tileRefs.current?.get(activeClueId);
    if (!container || !overlay || !tile || typeof overlay.animate !== "function") return;

    const board = container.getBoundingClientRect();
    const cell = tile.getBoundingClientRect();
    if (board.width === 0 || board.height === 0 || cell.width === 0) return;

    const from = `translate(${cell.left - board.left}px, ${cell.top - board.top}px) scale(${
      cell.width / board.width
    }, ${cell.height / board.height})`;
    overlay.animate(
      [
        { transform: from, opacity: 0.85 },
        { transform: "translate(0px, 0px) scale(1, 1)", opacity: 1 },
      ],
      { duration: 380, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)", fill: "none" },
    );
  }, [activeClueId, reducedMotion, containerRef, overlayRef, tileRefs]);
}
