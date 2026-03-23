import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

const MM_TO_POINTS = 72 / 25.4;
export const A4_WIDTH_POINTS = 210 * MM_TO_POINTS;
export const A4_HEIGHT_POINTS = 297 * MM_TO_POINTS;
const A4_TOLERANCE_POINTS = 1.5;

function isWithinTolerance(actual, expected) {
  return Math.abs(Number(actual) - Number(expected)) <= A4_TOLERANCE_POINTS;
}

export function isA4PageSize(width, height) {
  return (
    (isWithinTolerance(width, A4_WIDTH_POINTS) && isWithinTolerance(height, A4_HEIGHT_POINTS))
    || (isWithinTolerance(width, A4_HEIGHT_POINTS) && isWithinTolerance(height, A4_WIDTH_POINTS))
  );
}

export async function inspectPdfAttachmentBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    throw new Error("PDF upload is empty.");
  }
  let sourceDocument;
  try {
    sourceDocument = await PDFDocument.load(buffer);
  } catch (error) {
    throw new Error(`Invalid PDF file: ${String(error?.message || error || "Could not parse PDF.")}`);
  }
  const pages = sourceDocument.getPages();
  if (!pages.length) {
    throw new Error("PDF upload must contain at least one page.");
  }
  return {
    pageCount: pages.length,
    pages: pages.map((page, index) => ({
      index,
      width: Number(page.getWidth()),
      height: Number(page.getHeight()),
      isA4: isA4PageSize(Number(page.getWidth()), Number(page.getHeight()))
    }))
  };
}

async function appendSourceDocumentPages(targetDocument, sourceDocument) {
  const sourcePages = sourceDocument.getPages();
  for (const [index, page] of sourcePages.entries()) {
    const width = Number(page.getWidth());
    const height = Number(page.getHeight());
    if (isA4PageSize(width, height)) {
      const [copiedPage] = await targetDocument.copyPages(sourceDocument, [index]);
      targetDocument.addPage(copiedPage);
      continue;
    }

    const landscape = width > height;
    const targetWidth = landscape ? A4_HEIGHT_POINTS : A4_WIDTH_POINTS;
    const targetHeight = landscape ? A4_WIDTH_POINTS : A4_HEIGHT_POINTS;
    const scale = Math.min(targetWidth / width, targetHeight / height);
    const drawWidth = width * scale;
    const drawHeight = height * scale;
    const x = (targetWidth - drawWidth) / 2;
    const y = (targetHeight - drawHeight) / 2;
    const contents = page?.node?.Contents?.();
    if (!contents) {
      targetDocument.addPage([targetWidth, targetHeight]);
      continue;
    }
    const embeddedPage = await targetDocument.embedPage(page);
    const targetPage = targetDocument.addPage([targetWidth, targetHeight]);
    targetPage.drawPage(embeddedPage, {
      x,
      y,
      width: drawWidth,
      height: drawHeight
    });
  }
}

export async function normalizePdfAttachmentBufferToA4(buffer) {
  const inspection = await inspectPdfAttachmentBuffer(buffer);
  const sourceDocument = await PDFDocument.load(buffer);
  const normalizedDocument = await PDFDocument.create();
  await appendSourceDocumentPages(normalizedDocument, sourceDocument);
  return {
    pageCount: inspection.pageCount,
    normalized: inspection.pages.some((page) => !page.isA4),
    buffer: Buffer.from(await normalizedDocument.save())
  };
}

export function resolveTravelPlanAttachmentAbsolutePath(baseDir, rawStoragePath) {
  const normalizedBaseDir = path.resolve(String(baseDir || ""));
  const normalizedStoragePath = String(rawStoragePath || "").trim().replace(/^\/+/, "");
  if (!normalizedBaseDir || !normalizedStoragePath) return null;
  const absolutePath = path.resolve(normalizedBaseDir, normalizedStoragePath);
  if (absolutePath === normalizedBaseDir) return null;
  if (!absolutePath.startsWith(`${normalizedBaseDir}${path.sep}`)) return null;
  return absolutePath;
}

export async function appendPdfAttachmentsToFile(outputPath, attachmentPaths = []) {
  const resolvedAttachmentPaths = (Array.isArray(attachmentPaths) ? attachmentPaths : []).filter(Boolean);
  if (!resolvedAttachmentPaths.length) return false;

  const mergedDocument = await PDFDocument.create();
  const outputBytes = await readFile(outputPath);
  const outputDocument = await PDFDocument.load(outputBytes);
  const copiedPages = await mergedDocument.copyPages(outputDocument, outputDocument.getPageIndices());
  copiedPages.forEach((page) => mergedDocument.addPage(page));

  for (const sourcePath of resolvedAttachmentPaths) {
    const sourceBytes = await readFile(sourcePath);
    const sourceDocument = await PDFDocument.load(sourceBytes);
    await appendSourceDocumentPages(mergedDocument, sourceDocument);
  }

  const mergedBytes = await mergedDocument.save();
  await writeFile(outputPath, mergedBytes);
  await trimTrailingBlankPagesInFile(outputPath);
  return true;
}

function pageHasVisibleContent(document, page) {
  const contents = page?.node?.Contents?.();
  if (!contents) return false;

  if (typeof contents.asArray === "function") {
    const streams = contents.asArray()
      .map((entry) => document.context.lookup(entry))
      .filter(Boolean);
    return streams.some((stream) => {
      if (typeof stream.getContentsSize === "function") {
        return Number(stream.getContentsSize()) > 0;
      }
      const raw = stream?.contents;
      return Number(raw?.length || 0) > 0;
    });
  }

  if (typeof contents.getContentsSize === "function") {
    return Number(contents.getContentsSize()) > 0;
  }

  return Number(contents?.contents?.length || 0) > 0;
}

function pageHasAnnotations(page) {
  const annots = page?.node?.Annots?.();
  return Boolean(annots && typeof annots.size === "function" && annots.size() > 0);
}

function isTrailingBlankPage(document, page) {
  return !pageHasVisibleContent(document, page) && !pageHasAnnotations(page);
}

export async function trimTrailingBlankPagesInFile(outputPath) {
  const sourceBytes = await readFile(outputPath);
  const document = await PDFDocument.load(sourceBytes);

  let removed = false;
  while (document.getPageCount() > 1) {
    const lastIndex = document.getPageCount() - 1;
    const lastPage = document.getPages()[lastIndex];
    if (!isTrailingBlankPage(document, lastPage)) break;
    document.removePage(lastIndex);
    removed = true;
  }

  if (!removed) return false;

  const trimmedBytes = await document.save();
  await writeFile(outputPath, trimmedBytes);
  return true;
}
