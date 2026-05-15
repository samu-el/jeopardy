import { describe, expect, it } from "vitest";
import {
  featureBacklog,
  foundationHarnesses,
  hasPlannedFeature,
  toolchain,
  upstreamReference,
} from "@/lib/foundation/project";

describe("foundation project metadata", () => {
  it("pins the intended modern stack", () => {
    expect(toolchain).toEqual({
      manager: "proto",
      runtime: "bun",
      framework: "nextjs-app-router",
      ui: "material-ui",
      state: "zustand",
    });
  });

  it("captures key upstream capabilities", () => {
    expect(upstreamReference.inheritedCapabilities).toContain("timed buzzing");
    expect(upstreamReference.inheritedCapabilities).toContain(
      "text-to-speech clue readout",
    );
    expect(upstreamReference.inheritedCapabilities).toContain(
      "experimental AI judging",
    );
  });

  it("tracks the required new feature directions", () => {
    expect(hasPlannedFeature("voice-selection")).toBe(true);
    expect(hasPlannedFeature("ai-bot-opponents")).toBe(true);
    expect(featureBacklog.length).toBeGreaterThanOrEqual(6);
  });

  it("names executable harnesses future agents must preserve", () => {
    expect(foundationHarnesses).toContain("typescript-typecheck");
    expect(foundationHarnesses).toContain("vitest-unit-and-contract-tests");
    expect(foundationHarnesses).toContain("playwright-health-smoke");
  });
});
