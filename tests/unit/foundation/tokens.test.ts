import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, parseColor } from "@/lib/foundation/contrast";
import { controls, goldScale, jeopardyFonts, jeopardyPalette, ui } from "@/lib/foundation/jeopardy-style";
import { reducedMotionStyles, shouldReduceMotion } from "@/lib/foundation/motion";
import { appViewport, viewportFraction, viewportRootStyles } from "@/lib/foundation/viewport";

const AA = 4.5;
const surfaces = {
  stage: ui.stage,
  surface: ui.surface,
  surfaceRaised: ui.surfaceRaised,
  readout: controls.readout.background,
  keyOff: controls.keyOff.background,
};

describe("contrast maths", () => {
  it("parses hex and rgba", () => {
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor("rgba(255, 0, 0, 0.5)")).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
    expect(() => parseColor("tomato")).toThrow();
  });

  it("matches the WCAG reference values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    // The audit's measured failure, reproduced: white at 0.40 on the surface.
    expect(contrastRatio("rgba(255,255,255,0.40)", ui.surface)).toBeCloseTo(3.79, 1);
  });
});

describe("text tokens clear WCAG AA (4.5:1)", () => {
  const textTokens = {
    ink: ui.ink,
    inkMuted: ui.inkMuted,
    inkFaint: ui.inkFaint,
    blueText: ui.blueText,
    goldBright: ui.goldBright,
    goldDeep: ui.goldDeep,
    red: ui.red,
    green: ui.green,
  };
  for (const [textName, text] of Object.entries(textTokens)) {
    for (const [surfaceName, surface] of Object.entries(surfaces)) {
      it(`${textName} on ${surfaceName}`, () => {
        expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(AA);
      });
    }
  }

  it("text on filled keys", () => {
    expect(contrastRatio(ui.onRed, ui.red)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(jeopardyPalette.onIncorrect, jeopardyPalette.incorrect)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(ui.onGold, ui.goldBright)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(ui.onGold, ui.goldDeep)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(ui.onGreen, ui.green)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(ui.ink, ui.blueDeep)).toBeGreaterThanOrEqual(AA);
  });
});

describe("gold scale", () => {
  it("has one bright and one deep gold, named the same everywhere", () => {
    expect(ui.goldBright).toBe(goldScale.bright);
    expect(jeopardyPalette.goldBright).toBe(goldScale.bright);
    expect(ui.goldDeep).toBe(goldScale.deep);
    expect(jeopardyPalette.goldDeep).toBe(goldScale.deep);
  });

  it("keeps the legacy aliases' values so nothing changes on screen", () => {
    expect(jeopardyPalette.gold).toBe(goldScale.deep);
    expect(ui.gold).toBe(goldScale.bright);
  });
});

describe("fonts", () => {
  it("reads the self-hosted next/font variables with a fallback", () => {
    expect(jeopardyFonts.display).toContain('var(--font-oswald, "Oswald")');
    expect(jeopardyFonts.clue).toContain('var(--font-bitter, "Bitter")');
  });

  it("does not name a body webfont that is never loaded", () => {
    expect(jeopardyFonts.body).not.toMatch(/Inter/);
  });
});

describe("viewport tokens", () => {
  it("falls back to vh and upgrades to dvh/svh where supported", () => {
    expect(viewportRootStyles["--app-svh"]).toBe("100vh");
    expect(viewportRootStyles["@supports (height: 100dvh)"]["--app-svh"]).toBe("100svh");
    expect(viewportRootStyles["@supports (height: 100dvh)"]["--app-dvh"]).toBe("100dvh");
    expect(viewportRootStyles["--safe-bottom"]).toBe("env(safe-area-inset-bottom, 0px)");
    expect(appViewport.minHeight).toBe("var(--app-svh, 100vh)");
  });

  it("builds fractional heights", () => {
    expect(viewportFraction(0.66)).toBe("calc(var(--app-svh, 100vh) * 0.66)");
    expect(viewportFraction(0.5, "dvh")).toBe("calc(var(--app-dvh, 100vh) * 0.5)");
  });
});

describe("reduced motion", () => {
  it("honours the OS or the in-app switch", () => {
    expect(shouldReduceMotion(false, false)).toBe(false);
    expect(shouldReduceMotion(true, false)).toBe(true);
    expect(shouldReduceMotion(false, true)).toBe(true);
  });

  it("ships a global media-query safety net", () => {
    expect(Object.keys(reducedMotionStyles)).toContain("@media (prefers-reduced-motion: reduce)");
  });
});

describe("PWA manifest", () => {
  const manifest = JSON.parse(readFileSync(join(process.cwd(), "public/manifest.webmanifest"), "utf8")) as {
    theme_color: string;
    background_color: string;
    display: string;
    start_url: string;
    icons: { src: string; sizes: string; type: string; purpose: string }[];
  };

  it("uses the stage colour for theme and background", () => {
    expect(manifest.theme_color.toLowerCase()).toBe(ui.stage.toLowerCase());
    expect(manifest.background_color.toLowerCase()).toBe(ui.stage.toLowerCase());
  });

  it("is installable: standalone, start_url, 192/512 PNGs and a separate maskable icon", () => {
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    const png = manifest.icons.filter((icon) => icon.type === "image/png");
    expect(png.some((icon) => icon.sizes === "192x192" && icon.purpose === "any")).toBe(true);
    expect(png.some((icon) => icon.sizes === "512x512" && icon.purpose === "any")).toBe(true);
    expect(png.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable")).toBe(true);
    expect(manifest.icons.every((icon) => !icon.purpose.includes(" "))).toBe(true);
  });

  it("every referenced icon exists", () => {
    for (const icon of manifest.icons) {
      expect(() => readFileSync(join(process.cwd(), "public", icon.src))).not.toThrow();
    }
    for (const file of ["apple-touch-icon.png", "favicon.ico", "og-image.png", "offline.html", "sw.js"]) {
      expect(() => readFileSync(join(process.cwd(), "public", file))).not.toThrow();
    }
  });
});
