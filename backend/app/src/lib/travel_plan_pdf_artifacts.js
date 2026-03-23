import path from "node:path";
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
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

export function buildTravelPlanPdfDisplayFilename(createdAt, suffix = "") {
  const datePart = isoDatePart(createdAt);
  const normalizedSuffix = String(suffix || "").trim().replace(/^-+/, "").replace(/[^A-Za-z0-9-]+/g, "");
  return `Asia Travel Plan ${datePart}${normalizedSuffix ? `-${normalizedSuffix}` : ""}.pdf`;
}

export function createTravelPlanPdfArtifacts({ generatedOffersDir }) {
  const artifactsRootDir = path.join(String(generatedOffersDir || "").trim(), "travel-plan-pdfs");

  function normalizeArtifactSuffix(value) {
    return String(value || "").trim().replace(/^-+/, "").replace(/[^A-Za-z0-9-]+/g, "");
  }

  function bookingArtifactsDir(bookingId) {
    return path.join(artifactsRootDir, normalizeBookingId(bookingId));
  }

  function legacyCurrentPdfPath(bookingId) {
    return path.join(String(generatedOffersDir || "").trim(), `travel-plan-${normalizeBookingId(bookingId)}.pdf`);
  }

  function metadataFilePath(bookingId) {
    return path.join(bookingArtifactsDir(bookingId), "metadata.json");
  }

  function buildArtifactId(datePart, suffix) {
    return `${datePart}-${normalizeArtifactSuffix(suffix)}`;
  }

  function parseArtifactFileName(filename) {
    const match = String(filename || "").match(/^(\d{4}-\d{2}-\d{2})-([A-Za-z0-9-]+)\.pdf$/i);
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

  function normalizeArtifactMetadataItems(raw) {
    return (Array.isArray(raw) ? raw : [])
      .map((item) => ({
        id: String(item?.id || "").trim(),
        sent_to_customer: item?.sent_to_customer === true
      }))
      .filter((item) => item.id);
  }

  async function readArtifactMetadataMap(bookingId) {
    const normalizedBookingId = normalizeBookingId(bookingId);
    if (!normalizedBookingId) return new Map();
    try {
      const raw = JSON.parse(await readFile(metadataFilePath(normalizedBookingId), "utf8"));
      return new Map(normalizeArtifactMetadataItems(raw?.items).map((item) => [item.id, item]));
    } catch {
      return new Map();
    }
  }

  async function writeArtifactMetadataMap(bookingId, metadataMap) {
    const normalizedBookingId = normalizeBookingId(bookingId);
    if (!normalizedBookingId) return;
    const items = Array.from(metadataMap.values())
      .map((item) => ({
        id: String(item?.id || "").trim(),
        sent_to_customer: item?.sent_to_customer === true
      }))
      .filter((item) => item.id)
      .sort((left, right) => left.id.localeCompare(right.id));
    await mkdir(bookingArtifactsDir(normalizedBookingId), { recursive: true });
    await writeFile(metadataFilePath(normalizedBookingId), `${JSON.stringify({ items }, null, 2)}\n`, "utf8");
  }

  async function listArtifactEntries(bookingId) {
    const normalizedBookingId = normalizeBookingId(bookingId);
    if (!normalizedBookingId) return [];
    const bookingDir = bookingArtifactsDir(normalizedBookingId);
    let names = [];
    try {
      names = await readdir(bookingDir);
    } catch {
      return [];
    }

    const metadataMap = await readArtifactMetadataMap(normalizedBookingId);
    const rows = [];
    for (const name of names) {
      const parsed = parseArtifactFileName(name);
      if (!parsed) continue;
      const absolutePath = path.join(bookingDir, name);
      let fileStat;
      try {
        fileStat = await stat(absolutePath);
      } catch {
        continue;
      }
      if (!fileStat?.isFile?.()) continue;
      let pageCount = 0;
      try {
        pageCount = await readPdfPageCount(absolutePath);
      } catch {
        continue;
      }
      if (pageCount < 1) continue;
      const createdAt = fileStat.mtime instanceof Date
        ? fileStat.mtime.toISOString()
        : new Date().toISOString();
      rows.push({
        id: parsed.artifactId,
        filename: buildTravelPlanPdfDisplayFilename(parsed.datePart, parsed.suffix),
        page_count: pageCount,
        created_at: createdAt,
        storage_path: absolutePath,
        sent_to_customer: metadataMap.get(parsed.artifactId)?.sent_to_customer === true
      });
    }

    return rows.sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")));
  }

  async function resolveLegacyCurrentPdf(bookingId) {
    const normalizedBookingId = normalizeBookingId(bookingId);
    if (!normalizedBookingId) return null;
    const absolutePath = legacyCurrentPdfPath(normalizedBookingId);
    let fileStat;
    try {
      fileStat = await stat(absolutePath);
    } catch {
      return null;
    }
    if (!fileStat?.isFile?.()) return null;
    let pageCount = 0;
    try {
      pageCount = await readPdfPageCount(absolutePath);
    } catch {
      return null;
    }
    if (pageCount < 1) return null;
    const createdAt = fileStat.mtime instanceof Date
      ? fileStat.mtime.toISOString()
      : new Date().toISOString();
    const metadataMap = await readArtifactMetadataMap(normalizedBookingId);
    return {
      id: "legacy-current",
      filename: buildTravelPlanPdfDisplayFilename(createdAt, "1"),
      page_count: pageCount,
      created_at: createdAt,
      storage_path: absolutePath,
      sent_to_customer: metadataMap.get("legacy-current")?.sent_to_customer === true
    };
  }

  async function nextNumericSuffix(bookingId, datePart, options = {}) {
    const artifacts = await listArtifactEntries(bookingId);
    const used = new Set(
      artifacts
        .map((item) => String(item.id || ""))
        .filter((id) => id.startsWith(`${datePart}-`))
        .map((id) => id.slice(`${datePart}-`.length))
    );
    if (options.reserveLegacyCurrent === true) {
      used.add("1");
    }
    let index = 1;
    while (used.has(String(index))) index += 1;
    return String(index);
  }

  async function nextCustomSuffix(bookingId, datePart, rawSuffix, options = {}) {
    const normalizedBase = normalizeArtifactSuffix(rawSuffix) || "1";
    const artifacts = await listArtifactEntries(bookingId);
    const used = new Set(
      artifacts
        .map((item) => String(item.id || ""))
        .filter((id) => id.startsWith(`${datePart}-`))
        .map((id) => id.slice(`${datePart}-`.length))
    );
    if (options.reserveLegacyCurrent === true) {
      used.add("1");
    }
    if (!used.has(normalizedBase)) return normalizedBase;
    let index = 2;
    while (used.has(`${normalizedBase}-${index}`)) index += 1;
    return `${normalizedBase}-${index}`;
  }

  async function persistBookingTravelPlanPdfArtifact(bookingId, sourcePath, options = {}) {
    const normalizedBookingId = normalizeBookingId(bookingId);
    if (!normalizedBookingId || !String(sourcePath || "").trim()) return null;
    const createdAt = String(options?.createdAt || "").trim() || new Date().toISOString();
    const datePart = isoDatePart(createdAt);
    const suffix = normalizeArtifactSuffix(options?.suffix)
      ? await nextCustomSuffix(normalizedBookingId, datePart, options?.suffix, options)
      : await nextNumericSuffix(normalizedBookingId, datePart, options);
    const artifactId = buildArtifactId(datePart, suffix);
    const destinationDir = bookingArtifactsDir(normalizedBookingId);
    const destinationPath = path.join(destinationDir, `${artifactId}.pdf`);
    await mkdir(destinationDir, { recursive: true });
    await copyFile(sourcePath, destinationPath);
    const destinationStat = await stat(destinationPath);
    const pageCount = await readPdfPageCount(destinationPath);
    const normalizedCreatedAt = destinationStat.mtime instanceof Date
      ? destinationStat.mtime.toISOString()
      : createdAt;
    const metadataMap = await readArtifactMetadataMap(normalizedBookingId);
    metadataMap.set(artifactId, {
      id: artifactId,
      sent_to_customer: false
    });
    await writeArtifactMetadataMap(normalizedBookingId, metadataMap);
    return {
      id: artifactId,
      filename: buildTravelPlanPdfDisplayFilename(datePart, suffix),
      page_count: pageCount,
      created_at: normalizedCreatedAt,
      storage_path: destinationPath,
      sent_to_customer: false
    };
  }

  async function resolveBookingTravelPlanPdfArtifact(bookingId, artifactId) {
    const normalizedBookingId = normalizeBookingId(bookingId);
    const normalizedArtifactId = String(artifactId || "").trim();
    if (!normalizedBookingId || !normalizedArtifactId) return null;
    if (normalizedArtifactId === "legacy-current") {
      return await resolveLegacyCurrentPdf(normalizedBookingId);
    }
    const bookingDir = bookingArtifactsDir(normalizedBookingId);
    const absolutePath = path.join(bookingDir, `${normalizedArtifactId}.pdf`);
    const parsed = parseArtifactFileName(`${normalizedArtifactId}.pdf`);
    if (!parsed) return null;
    let fileStat;
    try {
      fileStat = await stat(absolutePath);
    } catch {
      return null;
    }
    if (!fileStat?.isFile?.()) return null;
    let pageCount = 0;
    try {
      pageCount = await readPdfPageCount(absolutePath);
    } catch {
      return null;
    }
    if (pageCount < 1) return null;
    return {
      id: normalizedArtifactId,
      filename: buildTravelPlanPdfDisplayFilename(parsed.datePart, parsed.suffix),
      page_count: pageCount,
      created_at: fileStat.mtime instanceof Date ? fileStat.mtime.toISOString() : new Date().toISOString(),
      storage_path: absolutePath,
      sent_to_customer: (await readArtifactMetadataMap(normalizedBookingId)).get(normalizedArtifactId)?.sent_to_customer === true
    };
  }

  async function updateBookingTravelPlanPdfArtifact(bookingId, artifactId, patch = {}) {
    const normalizedBookingId = normalizeBookingId(bookingId);
    const normalizedArtifactId = String(artifactId || "").trim();
    if (!normalizedBookingId || !normalizedArtifactId) return null;
    const artifact = await resolveBookingTravelPlanPdfArtifact(normalizedBookingId, normalizedArtifactId);
    if (!artifact) return null;
    const metadataMap = await readArtifactMetadataMap(normalizedBookingId);
    metadataMap.set(normalizedArtifactId, {
      id: normalizedArtifactId,
      sent_to_customer: patch?.sent_to_customer === true
    });
    await writeArtifactMetadataMap(normalizedBookingId, metadataMap);
    return {
      ...artifact,
      sent_to_customer: patch?.sent_to_customer === true
    };
  }

  async function deleteBookingTravelPlanPdfArtifact(bookingId, artifactId) {
    const normalizedBookingId = normalizeBookingId(bookingId);
    const normalizedArtifactId = String(artifactId || "").trim();
    if (!normalizedBookingId || !normalizedArtifactId) return null;
    const artifact = await resolveBookingTravelPlanPdfArtifact(normalizedBookingId, normalizedArtifactId);
    if (!artifact) return null;
    const targetPath = normalizedArtifactId === "legacy-current"
      ? legacyCurrentPdfPath(normalizedBookingId)
      : artifact.storage_path;
    await rm(targetPath, { force: true }).catch(() => {});
    const metadataMap = await readArtifactMetadataMap(normalizedBookingId);
    metadataMap.delete(normalizedArtifactId);
    await writeArtifactMetadataMap(normalizedBookingId, metadataMap);
    return artifact;
  }

  async function listBookingTravelPlanPdfs(bookingId) {
    const normalizedBookingId = normalizeBookingId(bookingId);
    if (!normalizedBookingId) return [];
    const artifactRows = await listArtifactEntries(normalizedBookingId);
    if (artifactRows.length) {
      return artifactRows.map(({ id, filename, page_count, created_at, sent_to_customer }) => ({
        id,
        filename,
        page_count,
        created_at,
        sent_to_customer: sent_to_customer === true
      }));
    }
    const legacy = await resolveLegacyCurrentPdf(normalizedBookingId);
    return legacy
      ? [{
        id: legacy.id,
        filename: legacy.filename,
        page_count: legacy.page_count,
        created_at: legacy.created_at,
        sent_to_customer: legacy.sent_to_customer === true
      }]
      : [];
  }

  return {
    listBookingTravelPlanPdfs,
    persistBookingTravelPlanPdfArtifact,
    resolveBookingTravelPlanPdfArtifact,
    updateBookingTravelPlanPdfArtifact,
    deleteBookingTravelPlanPdfArtifact
  };
}
