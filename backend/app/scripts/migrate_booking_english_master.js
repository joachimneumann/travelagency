import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { migrateStoreBookingsToEnglishMaster } from "../src/domain/booking_english_master_migration.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, "..");
const DEFAULT_DATA_ROOT = path.join(APP_ROOT, "data");

function normalizeText(value) {
  return String(value || "").trim();
}

function usageLines() {
  return [
    "Usage:",
    "  node backend/app/scripts/migrate_booking_english_master.js [--write] [--store <path>]",
    "",
    "Options:",
    "  --write           Persist the migrated store back to disk.",
    "  --store <path>    Override STORE_FILE for the migration.",
    "  -h, --help        Show this help."
  ];
}

export function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    write: false,
    storePath: "",
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") {
      options.write = true;
      continue;
    }
    if (arg === "--store") {
      options.storePath = normalizeText(argv[index + 1]);
      if (!options.storePath) throw new Error("--store requires a path");
      index += 1;
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

export function resolveStorePath(storePath = "") {
  return path.resolve(
    normalizeText(storePath)
    || normalizeText(process.env.STORE_FILE)
    || path.join(normalizeText(process.env.BACKEND_DATA_DIR) || DEFAULT_DATA_ROOT, "store.json")
  );
}

async function loadStore(storePath) {
  const raw = await readFile(storePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Store file must contain a JSON object");
  }
  return parsed;
}

function unsupportedSummary(unsupportedBookings) {
  return unsupportedBookings
    .map((entry) => `${entry.bookingId}: ${entry.paths.join(", ")}`)
    .join("\n");
}

export async function migrateBookingStoreFile({ storePath = "", write = false } = {}) {
  const resolvedStorePath = resolveStorePath(storePath);
  const store = await loadStore(resolvedStorePath);
  const result = migrateStoreBookingsToEnglishMaster(store);

  if (result.unsupportedBookings.length) {
    throw new Error(
      [
        "Migration stopped because some mutable booking fields have localized content without an English source branch.",
        unsupportedSummary(result.unsupportedBookings)
      ].join("\n")
    );
  }

  if (write && result.changed) {
    await mkdir(path.dirname(resolvedStorePath), { recursive: true });
    await writeFile(resolvedStorePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  }

  return {
    ...result,
    storePath: resolvedStorePath,
    wrote: write && result.changed
  };
}

export async function runCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usageLines().join("\n"));
    return;
  }

  const result = await migrateBookingStoreFile(options);
  console.log(`Booking store scanned: ${result.storePath}`);
  console.log(
    [
      `bookings_scanned=${result.bookingsScanned}`,
      `bookings_changed=${result.bookingsChanged}`,
      `field_changes=${result.fieldChanges}`,
      `mode=${options.write ? (result.wrote ? "written" : "no_changes") : "dry_run"}`
    ].join(" ")
  );
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  runCli().catch((error) => {
    console.error(`Booking English-master migration failed: ${error?.message || error}`);
    process.exit(1);
  });
}
