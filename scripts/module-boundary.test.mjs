import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve("src/modules");

function filesIn(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...filesIn(full));
    else if (/\.(ts|tsx)$/.test(entry)) found.push(full);
  }
  return found;
}

test("modules only import another module through its index", () => {
  const modules = readdirSync(root).filter((name) => {
    if (name.startsWith("_")) return false;
    return statSync(path.join(root, name)).isDirectory();
  });
  const violations = [];
  for (const mod of modules) {
    for (const file of filesIn(path.join(root, mod))) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/from\s+["']([^"']+)["']/g)) {
        const spec = match[1];
        if (spec.startsWith("@/modules/")) {
          const rest = spec.slice("@/modules/".length);
          const [other, ...deep] = rest.split("/");
          if (other !== mod && deep.length > 0) violations.push(`${path.relative(root, file)} -> ${spec}`);
        }
        if (spec.startsWith("../")) {
          const parts = spec.split("/");
          if (parts.length > 2) violations.push(`${path.relative(root, file)} -> ${spec}`);
        }
      }
    }
  }
  assert.deepEqual(violations, []);
});
