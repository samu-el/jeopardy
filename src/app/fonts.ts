import localFont from "next/font/local";

/**
 * The board's webfonts, self-hosted through `next/font` so they are
 * preloaded with the page, work offline and in sandboxes that block Google,
 * and get a metric-matched fallback that avoids layout shift when they swap
 * in. Both are variable (one file per family, every weight) latin subsets
 * from Google Fonts, under the SIL Open Font License 1.1.
 *
 * The family names are exposed as CSS variables; `jeopardyFonts` in
 * `src/lib/foundation/jeopardy-style.ts` reads them.
 */
export const oswald = localFont({
  src: "./fonts/oswald-latin-variable.woff2",
  weight: "200 700",
  style: "normal",
  display: "swap",
  variable: "--font-oswald",
  fallback: ["Arial Narrow", "Impact", "sans-serif"],
  adjustFontFallback: "Arial",
});

export const bitter = localFont({
  src: "./fonts/bitter-latin-variable.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-bitter",
  fallback: ["Georgia", "serif"],
  adjustFontFallback: "Times New Roman",
});

/** Class names that declare both variables; put on `<html>`. */
export const fontVariables = `${oswald.variable} ${bitter.variable}`;
