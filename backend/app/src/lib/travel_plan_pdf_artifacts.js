import path from "node:path";
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";

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
  const customerLanguage = String(raw?.customer_language || "").trim();
  const travelPlanRevision = Number(raw?.travel_plan_revision);
  return {
    id: artifactId,
    booking_id: bookingId,
    storage_name: storageName,
    display_filename: displayFilename,
    created_at: createdAt,
    page_count: Math.max(1, Math.round(pageCount)),
    sent_to_customer: raw?.sent_to_customer === true,
    ...(customerLanguage ? { customer_language: customerLanguage } : {}),
    ...(Number.isFinite(travelPlanRevision) && travelPlanRevision >= 0 ? { travel_plan_revision: Math.round(travelPlanRevision) } : {})
  };
}

export function buildTravelPlanPdfDisplayFilename(createdAt, suffix = "") {
  const datePart = isoDatePart(createdAt);
  const normalizedSuffix = normalizeArtifactSuffix(suffix);
  return `Asia Travel Plan ${datePart}${normalizedSuffix ? `-${normalizedSuffix}` : ""}.pdf`;
}

export function createTravelPlanPdfArtifacts({ travelPlanPdfsDir, generatedOffersDir = "" }) {
  const normalizedRootDir = String(travelPlanPdfsDir || "").trim();
  const normalizedGeneratedOffersDir = String(generatedOffersDir || "").trim();
  const bookingLocks = new Map();

  function bookingArtifactsDir(bookingId) {
    return path.join(normalizedRootDir, normalizeBookingId(bookingId));
  }

  function manifestPath(bookingId) {
    return path.join(bookingArtifactsDir(bookingId), "manifest.json");
  }

  function artifactStoragePath(bookingId, artifactId) {
    return path.join(bookingArtifactsDir(bookingId), `${artifactId}.pdf`);
  }

  function legacyArtifactsRootDir() {
    return path.join(normalizedGeneratedOffersDir, "travel-plan-pdfs");
  }

  function legacyCurrentPdfPath(bookingId) {
    return path.join(normalizedGeneratedOffersDir, `travel-plan-${normalizeBookingId(bookingId)}.pdf`);
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
      sent_to_customer: item.sent_to_customer === true,
      ...(item.customer_language ? { customer_language: item.customer_language } : {}),
      ...(Number.isFinite(item.travel_plan_revision) ? { travel_plan_revision: item.travel_plan_revision } : {}),
      ...(absolutePath ? { storage_path: absolutePath } : {})
    };
  }

  async function listBookingTravelPlanPdfs(bookingId) {
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

  async function resolveBookingTravelPlanPdfArtifact(bookingId, artifactId) {
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

  async function persistBookingTravelPlanPdfArtifact(bookingId, sourcePath, options = {}) {
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
        display_filename: buildTravelPlanPdfDisplayFilename(datePart, suffix),
        created_at: createdAt,
        page_count: pageCount,
        sent_to_customer: false,
        customer_language: String(options?.customerLanguage || "").trim(),
        travel_plan_revision: Number(options?.travelPlanRevision)
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

  async function updateBookingTravelPlanPdfArtifact(bookingId, artifactId, patch = {}) {
    const normalizedBookingId = normalizeBookingId(bookingId);
    const normalizedArtifactId = String(artifactId || "").trim();
    if (!normalizedBookingId || !normalizedArtifactId) return null;
    return await withBookingLock(normalizedBookingId, async () => {
      const items = await readManifest(normalizedBookingId);
      const index = items.findIndex((entry) => entry.id === normalizedArtifactId);
      if (index < 0) return null;
      items[index] = normalizeMetadataItem({
        ...items[index],
        sent_to_customer: patch?.sent_to_customer === true
      });
      await writeManifest(normalizedBookingId, items);
      return toReadModelItem(items[index], artifactStoragePath(normalizedBookingId, normalizedArtifactId));
    });
  }

  async function deleteBookingTravelPlanPdfArtifact(bookingId, artifactId) {
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

  async function importLegacyArtifact(bookingId, absolutePath, metadata = {}) {
    const normalizedBookingId = normalizeBookingId(bookingId);
    if (!normalizedBookingId || !String(absolutePath || "").trim()) return false;
    let fileStat;
    try {
      fileStat = await stat(absolutePath);
    } catch {
      return false;
    }
    if (!fileStat?.isFile?.()) return false;
    const createdAt = fileStat.mtime instanceof Date ? fileStat.mtime.toISOString() : new Date().toISOString();
    const datePart = isoDatePart(createdAt);
    return await withBookingLock(normalizedBookingId, async () => {
      const items = await readManifest(normalizedBookingId);
      const suffix = nextNumericSuffix(items, datePart);
      const artifactId = buildArtifactId(datePart, suffix);
      const destinationPath = artifactStoragePath(normalizedBookingId, artifactId);
      await mkdir(bookingArtifactsDir(normalizedBookingId), { recursive: true });
      const pageCount = await readPdfPageCount(absolutePath);
      await moveFile(absolutePath, destinationPath);
      const item = normalizeMetadataItem({
        id: artifactId,
        booking_id: normalizedBookingId,
        storage_name: `${artifactId}.pdf`,
        display_filename: buildTravelPlanPdfDisplayFilename(datePart, suffix),
        created_at: createdAt,
        page_count: pageCount,
        sent_to_customer: metadata?.sent_to_customer === true
      });
      items.push(item);
      try {
        await writeManifest(normalizedBookingId, items);
      } catch (error) {
        await rm(destinationPath, { force: true }).catch(() => {});
        throw error;
      }
      return true;
    });
  }

  async function migrateLegacyTravelPlanPdfStorage() {
    if (!normalizedRootDir || !normalizedGeneratedOffersDir) return;
    await mkdir(normalizedRootDir, { recursive: true });

    const legacyArtifactsRoot = legacyArtifactsRootDir();
    let bookingDirs = [];
    try {
      bookingDirs = await readdir(legacyArtifactsRoot, { withFileTypes: true });
    } catch {
      bookingDirs = [];
    }

    for (const entry of bookingDirs) {
      if (!entry?.isDirectory?.()) continue;
      const bookingId = entry.name;
      const legacyBookingDir = path.join(legacyArtifactsRoot, bookingId);
      let metadataMap = new Map();
      try {
        const parsed = JSON.parse(await readFile(path.join(legacyBookingDir, "metadata.json"), "utf8"));
        metadataMap = new Map(
          (Array.isArray(parsed?.items) ? parsed.items : [])
            .map((item) => [String(item?.id || "").trim(), item?.sent_to_customer === true])
            .filter(([id]) => id)
        );
      } catch {
        metadataMap = new Map();
      }
      let names = [];
      try {
        names = await readdir(legacyBookingDir);
      } catch {
        names = [];
      }
      for (const name of names) {
        const parsed = String(name || "").match(/^(\d{4}-\d{2}-\d{2})-([A-Za-z0-9-]+)\.pdf$/i);
        if (!parsed) continue;
        const artifactId = `${parsed[1]}-${parsed[2]}`;
        const absolutePath = path.join(legacyBookingDir, name);
        await importLegacyArtifact(bookingId, absolutePath, {
          sent_to_customer: metadataMap.get(artifactId) === true
        });
      }
      await rm(legacyBookingDir, { recursive: true, force: true }).catch(() => {});
    }
    await rm(legacyArtifactsRoot, { recursive: true, force: true }).catch(() => {});

    let legacyNames = [];
    try {
      legacyNames = await readdir(normalizedGeneratedOffersDir);
    } catch {
      legacyNames = [];
    }
    for (const name of legacyNames) {
      const match = String(name || "").match(/^travel-plan-(.+)\.pdf$/i);
      if (!match) continue;
      const bookingId = match[1];
      const absolutePath = legacyCurrentPdfPath(bookingId);
      const existingItems = await readManifest(bookingId);
      if (!existingItems.length) {
        await importLegacyArtifact(bookingId, absolutePath, { sent_to_customer: false });
      }
      await rm(absolutePath, { force: true }).catch(() => {});
    }
  }

  return {
    listBookingTravelPlanPdfs,
    persistBookingTravelPlanPdfArtifact,
    resolveBookingTravelPlanPdfArtifact,
    updateBookingTravelPlanPdfArtifact,
    deleteBookingTravelPlanPdfArtifact,
    migrateLegacyTravelPlanPdfStorage
  };
}
