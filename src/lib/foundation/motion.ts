/**
 * Reduced motion, app-wide.
 *
 * Components that animate from JS (the clue zoom, the Daily Double splash)
 * read `preferences.reducedMotion` from the store. That misses two cases:
 * a viewer whose OS asks for reduced motion but who never opened Settings,
 * and every CSS keyframe that nobody remembered to gate (podium pulses, score
 * shakes). This is the safety net for both: one global rule that collapses
 * CSS animations and transitions when either the OS asks
 * (`prefers-reduced-motion: reduce`) or the in-app switch is on (the shell
 * mirrors it onto `<html data-reduced-motion="reduce">`).
 *
 * The in-app switch can only *add* reduction: its stored default is `false`,
 * which cannot be told apart from "the viewer turned it off", so an OS-level
 * request is always honoured.
 */

export const reducedMotionAttribute = "data-reduced-motion";
export const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

const collapse = {
  animationDuration: "0.01ms !important",
  animationDelay: "0ms !important",
  animationIterationCount: "1 !important",
  transitionDuration: "0.01ms !important",
  transitionDelay: "0ms !important",
  scrollBehavior: "auto !important",
} as const;

const everything = "*, *::before, *::after";

/** Global styles for `MuiCssBaseline`. */
export const reducedMotionStyles = {
  [`@media ${reducedMotionQuery}`]: {
    [everything]: collapse,
  },
  [`html[${reducedMotionAttribute}="reduce"], html[${reducedMotionAttribute}="reduce"] *, html[${reducedMotionAttribute}="reduce"] *::before, html[${reducedMotionAttribute}="reduce"] *::after`]:
    collapse,
} as const;

/** Whether motion should be reduced, given the OS preference and the in-app switch. */
export function shouldReduceMotion(osPrefersReduced: boolean, appSetting: boolean): boolean {
  return osPrefersReduced || appSetting;
}
