import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

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
    "  node backend/app/scripts/wipe_bookings.js [--yes] [--store <path>] [--data-dir <path>]",
    "",
    "Options:",
    "  --yes              Skip the confirmation prompt.",
    "  --store <path>     Override STORE_FILE for the wipe operation.",
    "  --data-dir <path>  Override BACKEND_DATA_DIR for artifact cleanup.",
    "  -h, --help         Show this help."
  ];
}

export function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    yes: false,
    storePath: "",
    dataDir: "",
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--yes") {
      options.yes = true;
      continue;
    }
    if (arg === "--store") {
      options.storePath = normalizeText(argv[index + 1]);
      if (!options.storePath) throw new Error("--store requires a path");
      index += 1;
      continue;
    }
    if (arg === "--data-dir") {
      options.dataDir = normalizeText(argv[index + 1]);
      if (!options.dataDir) throw new Error("--data-dir requires a path");
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

export function resolveWipePaths({ storePath = "", dataDir = "" } = {}) {
  const resolvedDataRoot = path.resolve(normalizeText(dataDir) || normalizeText(process.env.BACKEND_DATA_DIR) || DEFAULT_DATA_ROOT);
  const resolvedStorePath = path.resolve(normalizeText(storePath) || normalizeText(process.env.STORE_FILE) || path.join(resolvedDataRoot, "store.json"));
  const pdfRoot = path.join(resolvedDataRoot, "pdfs");
  const tempRoot = path.join(resolvedDataRoot, "tmp");

  return {
    dataRoot: resolvedDataRoot,
    storePath: resolvedStorePath,
    resetDirectories: [
      path.join(pdfRoot, "invoices"),
      path.join(pdfRoot, "generated_offers"),
      path.join(pdfRoot, "travel_plans"),
      path.join(pdfRoot, "attachments"),
      path.join(resolvedDataRoot, "booking_images"),
      path.join(resolvedDataRoot, "booking_person_photos"),
      path.join(tempRoot, "travel_plan_previews"),
      path.join(resolvedDataRoot, "invoices"),
      path.join(resolvedDataRoot, "generated_offers"),
      path.join(resolvedDataRoot, "booking_travel_plan_attachments")
    ]
  };
}

async function loadExistingStore(storePath) {
  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Store file must contain a JSON object");
    }
    return parsed;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

function summarizeStore(store) {
  return {
    bookings: Array.isArray(store.bookings) ? store.bookings.length : 0,
    activities: Array.isArray(store.activities) ? store.activities.length : 0,
    invoices: Array.isArray(store.invoices) ? store.invoices.length : 0,
    chat_conversations: Array.isArray(store.chat_conversations) ? store.chat_conversations.length : 0,
    chat_events: Array.isArray(store.chat_events) ? store.chat_events.length : 0,
    booking_confirmation_challenges: Array.isArray(store.booking_confirmation_challenges) ? store.booking_confirmation_challenges.length : 0
  };
}

function buildWipedStore(store) {
  return {
    ...store,
    bookings: [],
    suppliers: Array.isArray(store.suppliers) ? store.suppliers : [],
    activities: [],
    invoices: [],
    chat_channel_accounts: Array.isArray(store.chat_channel_accounts) ? store.chat_channel_accounts : [],
    chat_conversations: [],
    chat_events: [],
    booking_confirmation_challenges: []
  };
}

async function confirmDestructiveAction(paths) {
  if (!input.isTTY || !output.isTTY) {
    throw new Error("Refusing to wipe bookings without a TTY confirmation. Re-run with --yes.");
  }

  const rl = readline.createInterface({ input, output });
  try {
    output.write(`This will wipe all bookings from ${paths.storePath} and clear booking artifact directories under ${paths.dataRoot}.\n`);
    const answer = await rl.question("Type WIPE to continue: ");
    if (normalizeText(answer) !== "WIPE") {
      throw new Error("Booking wipe cancelled.");
    }
  } finally {
    rl.close();
  }
}

async function resetDirectories(directories) {
  for (const directory of directories) {
    await rm(directory, { recursive: true, force: true });
    await mkdir(directory, { recursive: true });
  }
}

export async function wipeBookingsData({ storePath = "", dataDir = "", yes = false } = {}) {
  const paths = resolveWipePaths({ storePath, dataDir });
  const existingStore = await loadExistingStore(paths.storePath);
  const summary = summarizeStore(existingStore);

  if (!yes) {
    await confirmDestructiveAction(paths);
  }

  const wipedStore = buildWipedStore(existingStore);
  await mkdir(path.dirname(paths.storePath), { recursive: true });
  await writeFile(paths.storePath, `${JSON.stringify(wipedStore, null, 2)}\n`, "utf8");
  await resetDirectories(paths.resetDirectories);

  return {
    ...paths,
    summary
  };
}

export async function runCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usageLines().join("\n"));
    return;
  }

  const result = await wipeBookingsData(options);
  console.log(`Wiped bookings store: ${result.storePath}`);
  console.log(`Booking artifacts reset under: ${result.dataRoot}`);
  console.log(
    [
      `bookings=${result.summary.bookings}`,
      `activities=${result.summary.activities}`,
      `invoices=${result.summary.invoices}`,
      `chat_conversations=${result.summary.chat_conversations}`,
      `chat_events=${result.summary.chat_events}`,
      `booking_confirmation_challenges=${result.summary.booking_confirmation_challenges}`
    ].join(" ")
  );
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  runCli().catch((error) => {
    console.error(`Booking wipe failed: ${error?.message || error}`);
    process.exit(1);
  });
}
