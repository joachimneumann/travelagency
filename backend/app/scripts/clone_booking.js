import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { cloneBookingForTesting } from "../src/domain/booking_clone.js";

const execFile = promisify(execFileCb);

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
    "  node backend/app/scripts/clone_booking.js --source <booking_id> [--name <name>] [--copies <n>] [--store <path>] [--data-dir <path>] [--include-travelers]",
    "  node backend/app/scripts/clone_booking.js --source <booking_id> --push-to <ssh_host> [--remote-store <path>] [--remote-data-dir <path>] [--overwrite]",
    "  node backend/app/scripts/clone_booking.js --source <booking_id> --pull-from <ssh_host> [--remote-store <path>] [--remote-data-dir <path>] [--overwrite]",
    "",
    "Options:",
    "  --source <booking_id>  Source booking id to clone or transfer.",
    "  --name <name>         Override the cloned booking name.",
    "  --copies <n>          Create multiple clones. Default: 1.",
    "  --store <path>        Override local STORE_FILE.",
    "  --data-dir <path>     Override local BACKEND_DATA_DIR.",
    "  --include-travelers   Clone travelers and their document/photo refs into the new booking.",
    "  --push-to <ssh_host>  Copy one booking from the local machine to a remote machine via SSH.",
    "  --pull-from <ssh_host> Copy one booking from a remote machine to the local machine via SSH.",
    "  --remote-store <path> Override remote STORE_FILE.",
    "  --remote-data-dir <path> Override remote BACKEND_DATA_DIR.",
    "  --overwrite          Replace an existing booking with the same id on the target machine.",
    "  -h, --help            Show this help."
  ];
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sourceBookingId: "",
    name: "",
    copies: 1,
    storePath: "",
    dataDir: "",
    includeTravelers: false,
    pushTo: "",
    pullFrom: "",
    remoteStorePath: "",
    remoteDataDir: "",
    overwrite: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--source") {
      options.sourceBookingId = normalizeText(argv[index + 1]);
      if (!options.sourceBookingId) throw new Error("--source requires a booking id");
      index += 1;
      continue;
    }
    if (arg === "--name") {
      options.name = normalizeText(argv[index + 1]);
      if (!options.name) throw new Error("--name requires a value");
      index += 1;
      continue;
    }
    if (arg === "--copies") {
      const copies = Number(argv[index + 1]);
      if (!Number.isInteger(copies) || copies < 1 || copies > 100) {
        throw new Error("--copies must be an integer between 1 and 100");
      }
      options.copies = copies;
      index += 1;
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
    if (arg === "--remote-store") {
      options.remoteStorePath = normalizeText(argv[index + 1]);
      if (!options.remoteStorePath) throw new Error("--remote-store requires a path");
      index += 1;
      continue;
    }
    if (arg === "--remote-data-dir") {
      options.remoteDataDir = normalizeText(argv[index + 1]);
      if (!options.remoteDataDir) throw new Error("--remote-data-dir requires a path");
      index += 1;
      continue;
    }
    if (arg === "--push-to") {
      options.pushTo = normalizeText(argv[index + 1]);
      if (!options.pushTo) throw new Error("--push-to requires an SSH host");
      index += 1;
      continue;
    }
    if (arg === "--pull-from") {
      options.pullFrom = normalizeText(argv[index + 1]);
      if (!options.pullFrom) throw new Error("--pull-from requires an SSH host");
      index += 1;
      continue;
    }
    if (arg === "--include-travelers") {
      options.includeTravelers = true;
      continue;
    }
    if (arg === "--overwrite") {
      options.overwrite = true;
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.pushTo && options.pullFrom) {
    throw new Error("--push-to and --pull-from cannot be used together");
  }
  if ((options.pushTo || options.pullFrom) && (options.name || options.copies !== 1 || options.includeTravelers)) {
    throw new Error("SSH transfer mode cannot be combined with clone-only options");
  }

  return options;
}

function resolvePaths({ storePath = "", dataDir = "" } = {}) {
  const resolvedDataRoot = path.resolve(normalizeText(dataDir) || normalizeText(process.env.BACKEND_DATA_DIR) || DEFAULT_DATA_ROOT);
  const resolvedStorePath = path.resolve(normalizeText(storePath) || normalizeText(process.env.STORE_FILE) || path.join(resolvedDataRoot, "store.json"));
  return {
    dataRoot: resolvedDataRoot,
    storePath: resolvedStorePath
  };
}

function resolveRemotePaths({ storePath = "", dataDir = "" } = {}) {
  const normalizedDataDir = normalizeText(dataDir) || normalizeText(process.env.BACKEND_DATA_DIR) || DEFAULT_DATA_ROOT;
  const normalizedStorePath = normalizeText(storePath) || normalizeText(process.env.STORE_FILE) || path.join(normalizedDataDir, "store.json");
  return {
    dataRoot: path.posix.normalize(normalizedDataDir),
    storePath: path.posix.normalize(normalizedStorePath)
  };
}

async function loadStore(storePath) {
  const raw = await readFile(storePath, "utf8");
  return parseStore(raw);
}

function parseStore(raw) {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Store file must contain a JSON object.");
  }
  parsed.bookings = Array.isArray(parsed.bookings) ? parsed.bookings : [];
  parsed.activities = Array.isArray(parsed.activities) ? parsed.activities : [];
  parsed.payment_documents = Array.isArray(parsed.payment_documents) ? parsed.payment_documents : [];
  parsed.chat_conversations = Array.isArray(parsed.chat_conversations) ? parsed.chat_conversations : [];
  parsed.chat_events = Array.isArray(parsed.chat_events) ? parsed.chat_events : [];
  return parsed;
}

function nowIso() {
  return new Date().toISOString();
}

export async function cloneBookingsFromStore(options = {}) {
  const resolved = resolvePaths(options);
  const store = await loadStore(resolved.storePath);
  const sourceBooking = store.bookings.find((booking) => normalizeText(booking?.id) === normalizeText(options.sourceBookingId));
  if (!sourceBooking) {
    throw new Error(`Booking not found: ${options.sourceBookingId}`);
  }

  const createdIds = [];
  for (let index = 0; index < Number(options.copies || 1); index += 1) {
    const cloneName = options.name
      ? (options.copies > 1 ? `${options.name} ${index + 1}` : options.name)
      : "";
    const clonedBooking = cloneBookingForTesting(sourceBooking, {
      randomUUID,
      nowIso,
      name: cloneName,
      includeTravelers: options.includeTravelers === true
    });
    store.bookings.push(clonedBooking);
    store.activities.push({
      id: `act_${randomUUID()}`,
      booking_id: clonedBooking.id,
      type: "BOOKING_CREATED",
      actor: "clone_booking_script",
      detail: `Cloned from ${sourceBooking.id}`,
      created_at: clonedBooking.created_at
    });
    createdIds.push(clonedBooking.id);
  }

  await mkdir(path.dirname(resolved.storePath), { recursive: true });
  await writeFile(resolved.storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  return {
    mode: "clone",
    ...resolved,
    sourceBookingId: sourceBooking.id,
    createdIds
  };
}

function collectBookingArtifactPaths(booking, paymentDocuments = []) {
  const bookingImagePaths = new Set();
  const bookingPersonPhotoPaths = new Set();
  const attachmentPaths = new Set();
  const generatedOfferPdfPaths = new Set();
  const paymentDocumentPdfPaths = new Set();

  function addPublicPath(ref, prefix, set) {
    const normalized = normalizeText(ref);
    if (!normalized) return;
    if (normalized.startsWith(prefix)) {
      set.add(normalized.slice(prefix.length));
      return;
    }
    set.add(normalized);
  }

  addPublicPath(booking?.image, "/public/v1/booking-images/", bookingImagePaths);

  for (const person of Array.isArray(booking?.persons) ? booking.persons : []) {
    addPublicPath(person?.photo_ref, "/public/v1/booking-person-photos/", bookingPersonPhotoPaths);
    for (const document of Array.isArray(person?.documents) ? person.documents : []) {
      addPublicPath(document?.document_picture_ref, "/public/v1/booking-person-photos/", bookingPersonPhotoPaths);
    }
  }

  const travelPlan = booking?.travel_plan && typeof booking.travel_plan === "object" ? booking.travel_plan : null;
  for (const day of Array.isArray(travelPlan?.days) ? travelPlan.days : []) {
    for (const service of Array.isArray(day?.services) ? day.services : []) {
      const images = service?.image && typeof service.image === "object" && !Array.isArray(service.image)
        ? [service.image]
        : (Array.isArray(service?.images) ? service.images : []);
      for (const image of images) {
        addPublicPath(image?.storage_path, "/public/v1/booking-images/", bookingImagePaths);
      }
    }
  }
  for (const attachment of Array.isArray(travelPlan?.attachments) ? travelPlan.attachments : []) {
    const relativePath = normalizeText(attachment?.storage_path);
    if (relativePath) attachmentPaths.add(relativePath);
  }

  for (const generatedOffer of Array.isArray(booking?.generated_offers) ? booking.generated_offers : []) {
    const id = normalizeText(generatedOffer?.id);
    if (id) generatedOfferPdfPaths.add(`${id}.pdf`);
  }

  for (const document of paymentDocuments) {
    const id = normalizeText(document?.id);
    const version = Number(document?.version || 1);
    if (id && Number.isFinite(version) && version > 0) {
      paymentDocumentPdfPaths.add(`${id}-v${version}.pdf`);
    }
  }

  return {
    bookingImagePaths: [...bookingImagePaths],
    bookingPersonPhotoPaths: [...bookingPersonPhotoPaths],
    attachmentPaths: [...attachmentPaths],
    generatedOfferPdfPaths: [...generatedOfferPdfPaths],
    paymentDocumentPdfPaths: [...paymentDocumentPdfPaths]
  };
}

function extractBookingTransferPayload(store, bookingId) {
  const booking = store.bookings.find((item) => normalizeText(item?.id) === bookingId);
  if (!booking) throw new Error(`Booking not found: ${bookingId}`);
  const paymentDocuments = (Array.isArray(store.payment_documents) ? store.payment_documents : [])
    .filter((item) => normalizeText(item?.booking_id) === bookingId);
  const activities = (Array.isArray(store.activities) ? store.activities : [])
    .filter((item) => normalizeText(item?.booking_id) === bookingId);
  const chatConversations = (Array.isArray(store.chat_conversations) ? store.chat_conversations : [])
    .filter((item) => normalizeText(item?.booking_id) === bookingId);
  const conversationIds = new Set(chatConversations.map((item) => normalizeText(item?.id)).filter(Boolean));
  const chatEvents = (Array.isArray(store.chat_events) ? store.chat_events : [])
    .filter((item) => conversationIds.has(normalizeText(item?.conversation_id)));

  return {
    booking,
    activities,
    paymentDocuments,
    chatConversations,
    chatEvents,
    artifacts: collectBookingArtifactPaths(booking, paymentDocuments)
  };
}

function mergeBookingTransferPayload(targetStore, payload, options = {}) {
  const bookingId = normalizeText(payload?.booking?.id);
  if (!bookingId) throw new Error("Transferred booking is missing an id");
  const overwrite = options.overwrite === true;
  const existing = targetStore.bookings.find((item) => normalizeText(item?.id) === bookingId);
  if (existing && !overwrite) {
    throw new Error(`Target already contains booking ${bookingId}. Re-run with --overwrite to replace it.`);
  }

  targetStore.bookings = targetStore.bookings.filter((item) => normalizeText(item?.id) !== bookingId);
  targetStore.activities = targetStore.activities.filter((item) => normalizeText(item?.booking_id) !== bookingId);
  targetStore.payment_documents = targetStore.payment_documents.filter((item) => normalizeText(item?.booking_id) !== bookingId);
  const removedConversationIds = new Set(
    targetStore.chat_conversations
      .filter((item) => normalizeText(item?.booking_id) === bookingId)
      .map((item) => normalizeText(item?.id))
      .filter(Boolean)
  );
  targetStore.chat_conversations = targetStore.chat_conversations.filter((item) => normalizeText(item?.booking_id) !== bookingId);
  targetStore.chat_events = targetStore.chat_events.filter((item) => !removedConversationIds.has(normalizeText(item?.conversation_id)));

  targetStore.bookings.push(payload.booking);
  targetStore.activities.push(...payload.activities);
  targetStore.payment_documents.push(...payload.paymentDocuments);
  targetStore.chat_conversations.push(...payload.chatConversations);
  targetStore.chat_events.push(...payload.chatEvents);
}

function createLocalStoreAdapter({ storePath, dataRoot }) {
  return {
    kind: "local",
    label: storePath,
    storePath,
    dataRoot,
    async readStore() {
      return loadStore(storePath);
    },
    async writeStore(store) {
      await mkdir(path.dirname(storePath), { recursive: true });
      await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    },
    resolvePath(...segments) {
      return path.join(dataRoot, ...segments);
    },
    async copyFileTo(targetAdapter, relativeSegments) {
      const sourcePath = this.resolvePath(...relativeSegments);
      await targetAdapter.receiveFileFromLocal(sourcePath, relativeSegments);
    },
    async receiveFileFromLocal(sourcePath, relativeSegments) {
      const targetPath = this.resolvePath(...relativeSegments);
      await mkdir(path.dirname(targetPath), { recursive: true });
      const contents = await readFile(sourcePath);
      await writeFile(targetPath, contents);
    }
  };
}

function createSshStoreAdapter({ sshHost, storePath, dataRoot, execFileImpl = execFile }) {
  async function runRemote(args, options = {}) {
    return execFileImpl("ssh", [sshHost, ...args], options);
  }

  async function remoteFileExists(filePath) {
    try {
      await runRemote(["test", "-f", filePath]);
      return true;
    } catch {
      return false;
    }
  }

  return {
    kind: "ssh",
    label: `${sshHost}:${storePath}`,
    storePath,
    dataRoot,
    async readStore() {
      const { stdout } = await runRemote(["cat", storePath], { maxBuffer: 20 * 1024 * 1024 });
      return parseStore(stdout);
    },
    async writeStore(store) {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "travelagency-booking-transfer-"));
      const localTempPath = path.join(tempDir, "store.json");
      const remoteTempPath = `${storePath}.tmp-${Date.now()}-${randomUUID()}`;
      try {
        await writeFile(localTempPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
        await runRemote(["mkdir", "-p", path.posix.dirname(storePath)]);
        await execFileImpl("scp", [localTempPath, `${sshHost}:${remoteTempPath}`], { maxBuffer: 20 * 1024 * 1024 });
        await runRemote(["mv", remoteTempPath, storePath]);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    },
    resolvePath(...segments) {
      return path.posix.join(dataRoot, ...segments);
    },
    async copyFileTo(targetAdapter, relativeSegments) {
      const remotePath = this.resolvePath(...relativeSegments);
      if (!(await remoteFileExists(remotePath))) return false;
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "travelagency-booking-transfer-"));
      const localTempPath = path.join(tempDir, path.basename(remotePath));
      try {
        await execFileImpl("scp", [`${sshHost}:${remotePath}`, localTempPath], { maxBuffer: 20 * 1024 * 1024 });
        await targetAdapter.receiveFileFromLocal(localTempPath, relativeSegments);
        return true;
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    },
    async receiveFileFromLocal(sourcePath, relativeSegments) {
      const remotePath = this.resolvePath(...relativeSegments);
      await runRemote(["mkdir", "-p", path.posix.dirname(remotePath)]);
      await execFileImpl("scp", [sourcePath, `${sshHost}:${remotePath}`], { maxBuffer: 20 * 1024 * 1024 });
    }
  };
}

async function copyOptionalArtifacts(sourceAdapter, targetAdapter, artifacts) {
  const copied = [];
  const artifactGroups = [
    ["booking_images", artifacts.bookingImagePaths],
    ["booking_person_photos", artifacts.bookingPersonPhotoPaths],
    [path.join("pdfs", "attachments"), artifacts.attachmentPaths],
    [path.join("pdfs", "generated_offers"), artifacts.generatedOfferPdfPaths],
    [path.join("pdfs", "payment_documents"), artifacts.paymentDocumentPdfPaths]
  ];

  for (const [rootSegment, relativePaths] of artifactGroups) {
    for (const relativePath of relativePaths) {
      const normalized = normalizeText(relativePath);
      if (!normalized) continue;
      const copiedThis = await sourceAdapter.copyFileTo(targetAdapter, [rootSegment, normalized]);
      if (copiedThis !== false) {
        copied.push(path.join(rootSegment, normalized));
      }
    }
  }

  return copied;
}

export async function transferBookingOverSsh(options = {}) {
  const localPaths = resolvePaths(options);
  const remotePaths = resolveRemotePaths({
    storePath: options.remoteStorePath,
    dataDir: options.remoteDataDir
  });
  const sshHost = normalizeText(options.pushTo || options.pullFrom);
  if (!sshHost) throw new Error("An SSH host is required for transfer mode");

  const execFileImpl = options.execFileImpl || execFile;
  const localAdapter = createLocalStoreAdapter(localPaths);
  const remoteAdapter = createSshStoreAdapter({
    sshHost,
    storePath: remotePaths.storePath,
    dataRoot: remotePaths.dataRoot,
    execFileImpl
  });
  const sourceAdapter = options.pushTo ? localAdapter : remoteAdapter;
  const targetAdapter = options.pushTo ? remoteAdapter : localAdapter;

  const sourceStore = await sourceAdapter.readStore();
  const targetStore = await targetAdapter.readStore();
  const payload = extractBookingTransferPayload(sourceStore, normalizeText(options.sourceBookingId));

  mergeBookingTransferPayload(targetStore, payload, { overwrite: options.overwrite === true });
  await copyOptionalArtifacts(sourceAdapter, targetAdapter, payload.artifacts);
  await targetAdapter.writeStore(targetStore);

  return {
    mode: options.pushTo ? "push" : "pull",
    sourceBookingId: payload.booking.id,
    source: sourceAdapter.label,
    target: targetAdapter.label
  };
}

export async function runCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usageLines().join("\n"));
    return;
  }
  if (!options.sourceBookingId) {
    throw new Error("--source is required");
  }

  if (options.pushTo || options.pullFrom) {
    const result = await transferBookingOverSsh(options);
    console.log(`Transferred booking ${result.sourceBookingId} from ${result.source} to ${result.target}`);
    return;
  }

  const result = await cloneBookingsFromStore(options);
  console.log(`Cloned booking ${result.sourceBookingId} -> ${result.createdIds.join(", ")}`);
  console.log(`Store updated: ${result.storePath}`);
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  runCli().catch((error) => {
    console.error(`Booking clone failed: ${error?.message || error}`);
    process.exit(1);
  });
}
