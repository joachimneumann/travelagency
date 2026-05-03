#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");

const CATALOGS = Object.freeze([
  {
    id: "backend",
    sourcePath: path.join(ROOT, "scripts", "i18n", "source_catalogs", "backend.en.json"),
    generatedSourcePath: path.join(ROOT, "frontend", "data", "generated", "i18n", "source", "backend", "en.json"),
    compatibilityPath: path.join(ROOT, "frontend", "data", "i18n", "backend", "en.json")
  },
  {
    id: "frontend",
    sourcePath: path.join(ROOT, "scripts", "i18n", "source_catalogs", "frontend.en.json"),
    generatedSourcePath: path.join(ROOT, "frontend", "data", "generated", "i18n", "source", "frontend", "en.json"),
    compatibilityPath: path.join(ROOT, "frontend", "data", "i18n", "frontend", "en.json")
  }
]);

function usage() {
  console.error([
    "Usage:",
    "  node scripts/i18n/refresh_source_catalogs.mjs [--check]",
    "",
    "Copies canonical English i18n source catalogs into generated runtime paths.",
    "Canonical catalogs live in scripts/i18n/source_catalogs; generated copies live under frontend/data/generated."
  ].join("\n"));
}

function parseArgs(argv) {
  const options = { check: false };
  const args = Array.isArray(argv) ? [...argv] : [];
  while (args.length) {
    const token = args.shift();
    if (token === "--check") {
      options.check = true;
      continue;
    }
    if (token === "-h" || token === "--help") {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  return options;
}

async function readCatalog(filePath) {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${filePath} must contain a JSON object.`);
  }
  return parsed;
}

function normalizeCatalog(catalog, label) {
  const sortedEntries = Object.entries(catalog)
    .map(([key, value]) => [String(key).trim(), String(value ?? "")])
    .filter(([key]) => Boolean(key))
    .sort(([left], [right]) => left.localeCompare(right));

  const seen = new Set();
  for (const [key] of sortedEntries) {
    if (seen.has(key)) throw new Error(`${label} has duplicate key: ${key}`);
    seen.add(key);
  }

  return Object.fromEntries(sortedEntries);
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readIfExists(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

async function assertFresh(filePath, expectedContents) {
  const actual = await readIfExists(filePath);
  if (actual !== expectedContents) {
    throw new Error(`${path.relative(ROOT, filePath)} is stale. Run node scripts/i18n/refresh_source_catalogs.mjs.`);
  }
}

async function refreshCatalog(config, options) {
  const catalog = normalizeCatalog(await readCatalog(config.sourcePath), config.id);
  const contents = `${JSON.stringify(catalog, null, 2)}\n`;

  if (options.check) {
    await assertFresh(config.generatedSourcePath, contents);
    await assertFresh(config.compatibilityPath, contents);
    return Object.keys(catalog).length;
  }

  await writeJson(config.generatedSourcePath, catalog);
  await writeJson(config.compatibilityPath, catalog);
  return Object.keys(catalog).length;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    usage();
    console.error(error?.message || error);
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    usage();
    return;
  }

  try {
    for (const config of CATALOGS) {
      const count = await refreshCatalog(config, options);
      console.log(`${options.check ? "Checked" : "Refreshed"} ${config.id} source catalog: ${count} keys`);
    }
  } catch (error) {
    console.error(error?.message || error);
    process.exitCode = 1;
  }
}

await main();
