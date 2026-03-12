import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function topLevelFunctionDeclarations(filePath) {
  const source = await readFile(filePath, "utf8");
  const lines = source.split("\n");
  let depth = 0;
  const names = [];
  for (const line of lines) {
    const match = line.match(/^\s{2}function\s+([A-Za-z0-9_]+)\s*\(/);
    if (depth === 1 && match) {
      names.push(match[1]);
    }
    for (const char of line) {
      if (char === "{") depth += 1;
      if (char === "}") depth = Math.max(0, depth - 1);
    }
  }
  return names;
}

test("booking handlers do not contain duplicate top-level helper declarations", async () => {
  const filePath = path.resolve(__dirname, "..", "src", "http", "handlers", "bookings.js");
  const names = await topLevelFunctionDeclarations(filePath);
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  assert.deepEqual(duplicates, []);
});
