#!/usr/bin/env node
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const defaultToursDir = path.join(repoRoot, "content", "tours");

function usage() {
  console.log(`Usage: node scripts/content/strip_tour_i18n_fields.mjs [--dry-run] [--verbose] [TOURS_DIR]

Recursively removes embedded translation fields from content/tours/*/tour.json:
  *_i18n
  translation_meta

Default TOURS_DIR: content/tours`);
}

function isRemovedI18nKey(key) {
  return key.endsWith("_i18n") || key === "translation_meta";
}

function stripI18nFields(value, pathLabel = "$", removed = []) {
  if (Array.isArray(value)) {
    return value.map((item, index) => stripI18nFields(item, `${pathLabel}[${index}]`, removed));
  }
  if (!value || typeof value !== "object") return value;

  const next = {};
  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${pathLabel}.${key}`;
    if (isRemovedI18nKey(key)) {
      removed.push(entryPath);
      continue;
    }
    next[key] = stripI18nFields(entry, entryPath, removed);
  }
  return next;
}

async function tourJsonPaths(toursDir) {
  const entries = await readdir(toursDir, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    paths.push(path.join(toursDir, entry.name, "tour.json"));
  }
  return paths.sort();
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  const dryRun = args.includes("--dry-run");
  const verbose = args.includes("--verbose");
  const positional = args.filter((arg) => arg !== "--dry-run" && arg !== "--verbose");
  const toursDir = path.resolve(positional[0] || defaultToursDir);
  const files = await tourJsonPaths(toursDir);
  const changed = [];
  let removedFieldCount = 0;

  for (const filePath of files) {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const removed = [];
    const stripped = stripI18nFields(parsed, "$", removed);
    if (!removed.length) continue;

    changed.push({
      filePath,
      removed
    });
    removedFieldCount += removed.length;

    if (!dryRun) {
      await writeFile(filePath, `${JSON.stringify(stripped, null, 2)}\n`, "utf8");
    }
  }

  const action = dryRun ? "Would strip" : "Stripped";
  console.log(`${action} ${removedFieldCount} i18n field(s) from ${changed.length} of ${files.length} tour file(s).`);
  if (verbose) {
    for (const result of changed) {
      const relativePath = path.relative(repoRoot, result.filePath);
      console.log(`- ${relativePath}: ${result.removed.length}`);
      result.removed.forEach((entry) => console.log(`  ${entry}`));
    }
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
