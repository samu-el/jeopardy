import { describe, expect, it } from "vitest";
import {
  getBlockingPreUiItems,
  getPreUiItemsByArea,
  preUiReadinessChecklist,
  type PreUiReadinessArea,
} from "@/lib/foundation/pre-ui-readiness";

const expectedAreas: PreUiReadinessArea[] = [
  "game-engine",
  "state-contracts",
  "realtime",
  "persistence",
  "data",
  "ai",
  "voice",
  "avatar-host",
  "client-state",
  "accessibility",
  "responsive",
  "testing",
];

describe("pre-UI readiness checklist", () => {
  it("covers every required readiness area", () => {
    for (const area of expectedAreas) {
      expect(getPreUiItemsByArea(area).length, area).toBeGreaterThan(0);
    }
  });

  it("gives every item concrete acceptance criteria", () => {
    for (const item of preUiReadinessChecklist) {
      expect(item.id).toBeTruthy();
      expect(item.ownerModule).toBeTruthy();
      expect(item.acceptanceCriteria.length, item.id).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps optional AI services from blocking all UI preparation", () => {
    const avatarHost = getPreUiItemsByArea("avatar-host")[0];
    const aiJudge = preUiReadinessChecklist.find(
      (item) => item.id === "ai-judge-adapter",
    );

    expect(avatarHost.blocksUi).toBe(false);
    expect(aiJudge?.blocksUi).toBe(false);
    expect(getBlockingPreUiItems().length).toBeGreaterThan(8);
  });
});
