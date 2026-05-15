import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function fail(message: string): never {
  console.error(`Foundation verification failed: ${message}`);
  process.exit(1);
}

function assert(condition: unknown, message: string) {
  if (!condition) {
    fail(message);
  }
}

function readJson(path: string) {
  return JSON.parse(readFileSync(join(root, path), "utf8")) as Record<
    string,
    unknown
  >;
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stats = statSync(path);
    return stats.isDirectory() ? walk(path) : [path];
  });
}

const requiredFiles = [
  ".prototools",
  "AGENTS.md",
  "README.md",
  "package.json",
  "docs/01-product-brief.md",
  "docs/02-architecture.md",
  "docs/03-agent-playbook.md",
  ".codex/skills/jeopardy-modern-app/SKILL.md",
  "src/app/api/health/route.ts",
  "src/lib/state/app-store.ts",
  "src/lib/state/use-app-store.ts",
  "tests/unit/foundation.test.ts",
  "tests/unit/app-store.test.ts",
  "tests/contracts/game-contracts.test.ts",
  "tests/e2e/health.spec.ts",
];

for (const file of requiredFiles) {
  assert(existsSync(join(root, file)), `missing required file ${file}`);
}

const protoTools = readFileSync(join(root, ".prototools"), "utf8");
assert(protoTools.includes('bun = "1.3.6"'), ".prototools must pin Bun");
assert(protoTools.includes('node = "22.22.0"'), ".prototools must pin Node");
assert(!existsSync(join(root, "proto")), "protobuf-style proto/ directory is out of scope");

const protoFiles = walk(root).filter((file) => file.endsWith(".proto"));
assert(protoFiles.length === 0, "protobuf .proto files are out of scope");

const packageJson = readJson("package.json");
const scripts = packageJson.scripts as Record<string, string> | undefined;
const dependencies = packageJson.dependencies as Record<string, string> | undefined;
assert(scripts?.verify?.includes("foundation:verify"), "verify script must run foundation verifier");
assert(scripts?.typecheck === "tsc --noEmit", "typecheck script should use tsc");
assert(packageJson.packageManager === "bun@1.3.6", "packageManager must pin Bun");
assert(dependencies?.zustand, "Zustand must be installed as the client state layer");

const productBrief = readFileSync(join(root, "docs/01-product-brief.md"), "utf8");
assert(productBrief.includes("voice selection"), "product brief must mention voice selection");
assert(productBrief.includes("AI bot"), "product brief must mention AI bot opponents");

console.log("Foundation verification passed.");
