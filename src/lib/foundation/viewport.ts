/**
 * Viewport and safe-area tokens.
 *
 * `100vh` on a phone is the *large* viewport: it assumes the URL bar is
 * hidden, so anything sized from it starts partly below the fold and jumps
 * when the browser chrome collapses. And with `viewportFit: "cover"` plus a
 * `black-translucent` status bar, an installed iOS app draws under the notch
 * and the home indicator unless something pads for them.
 *
 * The global stylesheet (see `theme.ts`, `MuiCssBaseline`) defines the CSS
 * variables below with `vh` fallbacks for browsers without the new units.
 * Components should size from these rather than spelling `100vh` or
 * `env(...)` themselves:
 *
 *   sx={{ minHeight: appViewport.minHeight }}
 *   sx={{ position: "sticky", bottom: appViewport.safeBottom }}
 */

/** Names of the CSS custom properties, declared once on `:root`. */
export const viewportVars = {
  /** Dynamic viewport height: tracks the URL bar as it shows and hides. */
  dynamicHeight: "--app-dvh",
  /** Small viewport height: the height with the browser chrome showing. Stable; best for layout. */
  smallHeight: "--app-svh",
  safeTop: "--safe-top",
  safeRight: "--safe-right",
  safeBottom: "--safe-bottom",
  safeLeft: "--safe-left",
} as const;

/** Ready-to-use values for `sx` / CSS. */
export const appViewport = {
  /** A full-screen surface that follows the browser chrome (TV, clue stage). */
  fullHeight: `var(${viewportVars.dynamicHeight}, 100vh)`,
  /** A page's minimum height: never taller than what is visible with the URL bar shown. */
  minHeight: `var(${viewportVars.smallHeight}, 100vh)`,
  /** The visible height minus the top and bottom safe areas (what the shell's padding leaves). */
  contentHeight: `calc(var(${viewportVars.smallHeight}, 100vh) - var(${viewportVars.safeTop}, 0px) - var(${viewportVars.safeBottom}, 0px))`,
  safeTop: `var(${viewportVars.safeTop}, 0px)`,
  safeRight: `var(${viewportVars.safeRight}, 0px)`,
  safeBottom: `var(${viewportVars.safeBottom}, 0px)`,
  safeLeft: `var(${viewportVars.safeLeft}, 0px)`,
} as const;

/**
 * A height as a fraction of the small viewport, e.g. `viewportFraction(0.66)`
 * for what used to be `66vh`. Falls back to `vh` where `svh` is unknown.
 */
export function viewportFraction(fraction: number, unit: "svh" | "dvh" = "svh"): string {
  const pct = Math.round(fraction * 10000) / 100;
  const variable = unit === "svh" ? viewportVars.smallHeight : viewportVars.dynamicHeight;
  return `calc(var(${variable}, 100vh) * ${pct / 100})`;
}

/**
 * The global declarations behind the variables above. Exported so the theme
 * can inject them and a test can check the fallbacks are in place.
 */
export const viewportRootStyles = {
  [viewportVars.dynamicHeight]: "100vh",
  [viewportVars.smallHeight]: "100vh",
  [viewportVars.safeTop]: "env(safe-area-inset-top, 0px)",
  [viewportVars.safeRight]: "env(safe-area-inset-right, 0px)",
  [viewportVars.safeBottom]: "env(safe-area-inset-bottom, 0px)",
  [viewportVars.safeLeft]: "env(safe-area-inset-left, 0px)",
  "@supports (height: 100dvh)": {
    [viewportVars.dynamicHeight]: "100dvh",
    [viewportVars.smallHeight]: "100svh",
  },
} as const;
