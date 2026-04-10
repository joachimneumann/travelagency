import path from "node:path";
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";

export const BOOKING_CONFIRMATION_PDF_ARTIFACTS_DIRNAME = "booking-confirmations";

function normalizeBookingId(value) {
  return String(value || "").trim();
}

function isoDatePart(value) {
  const normalized = String(value || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? normalized
    : new Date().toISOString().slice(0, 10);
}

function normalizeArtifactSuffix(value) {
  return String(value || "").trim().replace(/^-+/, "").replace(/[^A-Za-z0-9-]+/g, "");
}

function buildArtifactId(datePart, suffix) {
  return `${datePart}-${normalizeArtifactSuffix(suffix)}`;
}

function parseArtifactId(value) {
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})-([A-Za-z0-9-]+)$/i);
  if (!match) return null;
  return {
    datePart: match[1],
    suffix: match[2],
    artifactId: buildArtifactId(match[1], match[2])
  };
}

async function readPdfPageCount(absolutePath) {
  const bytes = await readFile(absolutePath);
  const document = await PDFDocument.load(bytes);
  return Number(document.getPageCount()) || 0;
}

async function moveFile(sourcePath, destinationPath) {
  try {
    await rename(sourcePath, destinationPath);
  } catch {
    await copyFile(sourcePath, destinationPath);
    await rm(sourcePath, { force: true }).catch(() => {});
  }
}

function normalizeMetadataItem(raw) {
  const artifactId = String(raw?.id || "").trim();
  const bookingId = normalizeBookingId(raw?.booking_id);
  const storageName = String(raw?.storage_name || `${artifactId}.pdf`).trim();
  const displayFilename = String(raw?.display_filename || raw?.filename || "").trim();
  const createdAt = String(raw?.created_at || "").trim();
  const pageCount = Number(raw?.page_count);
  if (!artifactId || !bookingId || !storageName || !displayFilename || !createdAt || !Number.isFinite(pageCount) || pageCount < 1) {
    return null;
  }
  return {
    id: artifactId,
    booking_id: bookingId,
    storage_name: storageName,
    display_filename: displayFilename,
    created_at: createdAt,
    page_count: Math.max(1, Math.round(pageCount))
  };
}

export function buildBookingConfirmationPdfDisplayFilename(createdAt, suffix = "") {
  const datePart = isoDatePart(createdAt);
  const normalizedSuffix = normalizeArtifactSuffix(suffix);
  return `AsiaTravelPlan Booking confirmation ${datePart}${normalizedSuffix ? `-${normalizedSuffix}` : ""}.pdf`;
}

export function createBookingConfirmationPdfArtifacts({ generatedOffersDir }) {
  const normalizedGeneratedOffersDir = String(generatedOffersDir || "").trim();
  const bookingLocks = new Map();

  function artifactsRootDir() {
    return path.join(normalizedGeneratedOffersDir, BOOKING_CONFIRMATION_PDF_ARTIFACTS_DIRNAME);
  }

  function bookingArtifactsDir(bookingId) {
    return path.join(artifactsRootDir(), normalizeBookingId(bookingId));
  }

  function manifestPath(bookingId) {
    return path.join(bookingArtifactsDir(bookingId), "manifest.json");
  }

  function artifactStoragePath(bookingId, artifactId) {
    return path.join(bookingArtifactsDir(bookingId), `${artifactId}.pdf`);
  }

  async function withBookingLock(bookingId, operation) {
    const normalizedBookingId = normalizeBookingId(bookingId);
    const previous = bookingLocks.get(normalizedBookingId) || Promise.resolve();
    const next = previous.then(operation, operation);
    bookingLocks.set(normalizedBookingId, next.finally(() => {
      if (bookingLocks.get(normalizedBookingId) === next) {
        bookingLocks.delete(normalizedBookingId);
      }
    }));
    return await next;
  }

  async function readManifest(bookingId) {
    const normalizedBookingId = normalizeBookingId(bookingId);
    if (!normalizedBookingId) return [];
    try {
      const parsed = JSON.parse(await readFile(manifestPath(normalizedBookingId), "utf8"));
      return (Array.isArray(parsed?.items) ? parsed.items : [])
        .map(normalizeMetadataItem)
        .filter(Boolean)
        .filter((item) => item.booking_id === normalizedBookingId);
    } catch {
      return [];
    }
  }

  async function writeManifest(bookingId, items) {
    const normalizedBookingId = normalizeBookingId(bookingId);
    if (!normalizedBookingId) return;
    const normalizedItems = (Array.isArray(items) ? items : [])
      .map(normalizeMetadataItem)
      .filter(Boolean)
      .filter((item) => item.booking_id === normalizedBookingId)
      .sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")));
    await mkdir(bookingArtifactsDir(normalizedBookingId), { recursive: true });
    await writeFile(manifestPath(normalizedBookingId), `${JSON.stringify({ items: normalizedItems }, null, 2)}\n`, "utf8");
  }

  function nextNumericSuffix(items, datePart) {
    const used = new Set(
      (Array.isArray(items) ? items : [])
        .map((item) => parseArtifactId(item?.id))
        .filter((parsed) => parsed?.datePart === datePart)
        .map((parsed) => parsed.suffix)
    );
    let index = 1;
    while (used.has(String(index))) index += 1;
    return String(index);
  }

  function nextCustomSuffix(items, datePart, rawSuffix) {
    const normalizedBase = normalizeArtifactSuffix(rawSuffix) || "1";
    const used = new Set(
      (Array.isArray(items) ? items : [])
        .map((item) => parseArtifactId(item?.id))
        .filter((parsed) => parsed?.datePart === datePart)
        .map((parsed) => parsed.suffix)
    );
    if (!used.has(normalizedBase)) return normalizedBase;
    let index = 2;
    while (used.has(`${normalizedBase}-${index}`)) index += 1;
    return `${normalizedBase}-${index}`;
  }

  function toReadModelItem(item, absolutePath) {
    return {
      id: item.id,
      filename: item.display_filename,
      page_count: item.page_count,
      created_at: item.created_at,
      ...(absolutePath ? { storage_path: absolutePath } : {})
    };
  }

  async function listBookingConfirmationPdfs(bookingId) {
    const normalizedBookingId = normalizeBookingId(bookingId);
    if (!normalizedBookingId) return [];
    const items = await readManifest(normalizedBookingId);
    const rows = [];
    for (const item of items) {
      const absolutePath = artifactStoragePath(normalizedBookingId, item.id);
      try {
        const fileStat = await stat(absolutePath);
        if (!fileStat?.isFile?.()) continue;
      } catch {
        continue;
      }
      rows.push(toReadModelItem(item));
    }
    return rows.sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")));
  }

  async function resolveBookingConfirmationPdfArtifact(bookingId, artifactId) {
    const normalizedBookingId = normalizeBookingId(bookingId);
    const normalizedArtifactId = String(artifactId || "").trim();
    if (!normalizedBookingId || !normalizedArtifactId) return null;
    const items = await readManifest(normalizedBookingId);
    const item = items.find((entry) => entry.id === normalizedArtifactId);
    if (!item) return null;
    const absolutePath = artifactStoragePath(normalizedBookingId, normalizedArtifactId);
    try {
      const fileStat = await stat(absolutePath);
      if (!fileStat?.isFile?.()) return null;
    } catch {
      return null;
    }
    return toReadModelItem(item, absolutePath);
  }

  async function persistBookingConfirmationPdfArtifact(bookingId, sourcePath, options = {}) {
    const normalizedBookingId = normalizeBookingId(bookingId);
    if (!normalizedBookingId || !String(sourcePath || "").trim()) return null;
    return await withBookingLock(normalizedBookingId, async () => {
      const createdAt = String(options?.createdAt || "").trim() || new Date().toISOString();
      const datePart = isoDatePart(createdAt);
      const items = await readManifest(normalizedBookingId);
      const suffix = normalizeArtifactSuffix(options?.suffix)
        ? nextCustomSuffix(items, datePart, options?.suffix)
        : nextNumericSuffix(items, datePart);
      const artifactId = buildArtifactId(datePart, suffix);
      const destinationPath = artifactStoragePath(normalizedBookingId, artifactId);
      await mkdir(bookingArtifactsDir(normalizedBookingId), { recursive: true });
      const pageCount = await readPdfPageCount(sourcePath);
      await moveFile(sourcePath, destinationPath);
      const item = normalizeMetadataItem({
        id: artifactId,
        booking_id: normalizedBookingId,
        storage_name: `${artifactId}.pdf`,
        display_filename: buildBookingConfirmationPdfDisplayFilename(datePart, suffix),
        created_at: createdAt,
        page_count: pageCount
      });
      const nextItems = items.filter((entry) => entry.id !== artifactId);
      nextItems.push(item);
      try {
        await writeManifest(normalizedBookingId, nextItems);
      } catch (error) {
        await rm(destinationPath, { force: true }).catch(() => {});
        throw error;
      }
      return toReadModelItem(item, destinationPath);
    });
  }

  async function deleteBookingConfirmationPdfArtifact(bookingId, artifactId) {
    const normalizedBookingId = normalizeBookingId(bookingId);
    const normalizedArtifactId = String(artifactId || "").trim();
    if (!normalizedBookingId || !normalizedArtifactId) return null;
    return await withBookingLock(normalizedBookingId, async () => {
      const items = await readManifest(normalizedBookingId);
      const index = items.findIndex((entry) => entry.id === normalizedArtifactId);
      if (index < 0) return null;
      const removed = items[index];
      await rm(artifactStoragePath(normalizedBookingId, normalizedArtifactId), { force: true }).catch(() => {});
      items.splice(index, 1);
      await writeManifest(normalizedBookingId, items);
      return toReadModelItem(removed, artifactStoragePath(normalizedBookingId, normalizedArtifactId));
    });
  }

  return {
    listBookingConfirmationPdfs,
    resolveBookingConfirmationPdfArtifact,
    persistBookingConfirmationPdfArtifact,
    deleteBookingConfirmationPdfArtifact
  };
}
