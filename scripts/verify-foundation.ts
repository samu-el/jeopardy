/**
 * The layering guard.
 *
 * The rules of Jeopardy, the archive parser and the room are pure: given the
 * same input they give the same answer, on a server, in a browser tab, or in
 * a test with a fake clock. That is only true while they import nothing that
 * drags a React tree, a store, a socket or a speech engine behind them — so
 * this checks, on every `bun run verify`, that they still don't.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

/** Anything that would make a pure module need a browser, a server or a network. */
const impure = ["react", "zustand", "socket.io", "ioredis", "openai", "next/"];

const pureModules = [
  "src/lib/game/engine.ts",
  "src/lib/game/clue-flow.ts",
  "src/lib/game/room-flow.ts",
  "src/lib/game/projection.ts",
  "src/lib/game/rules.ts",
  "src/lib/game/board-layout.ts",
  "src/lib/data/normalize.ts",
  "src/lib/realtime/in-memory-room.ts",
];

const failures: string[] = [];

for (const path of pureModules) {
  let source: string;
  try {
    source = readFileSync(join(root, path), "utf8");
  } catch {
    continue; // A module that no longer exists cannot import anything.
  }
  const imports = source
    .split("\n")
    .filter((line) => line.trim().startsWith("import "))
    .join("\n");
  for (const forbidden of impure) {
    if (imports.includes(forbidden)) {
      failures.push(`${path} must not import ${forbidden}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Layering check failed:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}

console.log(`Layering check passed: ${pureModules.length} modules stayed pure.`);
