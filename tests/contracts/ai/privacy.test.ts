import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("AI module isolation", () => {
  it("keeps src/lib/ai free of React, persistence, and realtime imports", () => {
    const aiDir = join(process.cwd(), "src", "lib", "ai");
    const files = walk(aiDir).filter((file) => file.endsWith(".ts"));
    const forbidden = [
      "react",
      "zustand",
      'from "ws"',
      "@/lib/realtime",
      "@/lib/state",
      "@/lib/persistence",
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const imports = source
        .split("\n")
        .filter((line) => line.trim().startsWith("import "))
        .join("\n");
      for (const pattern of forbidden) {
        expect(imports, `${file} imports ${pattern}`).not.toContain(pattern);
      }
    }
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
