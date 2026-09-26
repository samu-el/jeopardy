/**
 * Money, the way the set writes it: `$400`, `-$400`, never `$-400`.
 *
 * One formatter so the podium, the results and the TV agree on a negative
 * score. `signed` adds a `+` to gains, for a score change rather than a score.
 */
export function formatMoney(amount: number, options: { signed?: boolean } = {}): string {
  const whole = Math.round(amount);
  const magnitude = `$${Math.abs(whole)}`;
  if (whole < 0) return `-${magnitude}`;
  if (options.signed && whole > 0) return `+${magnitude}`;
  return magnitude;
}
