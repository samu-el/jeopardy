/**
 * A countdown as a clock face: `0:09`, `1:30`, `2:00`. Whole seconds in, so
 * the caller decides how to round; anything under zero reads as `0:00`.
 */
export function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}
