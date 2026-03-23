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
  for (const [index, page] of pages.entries()) {
    const width = Number(page.getWidth());
    const height = Number(page.getHeight());
    if (!isA4PageSize(width, height)) {
      throw new Error(
        `Additional PDFs must use A4 page layout on every page. Page ${index + 1} is ${width.toFixed(2)} x ${height.toFixed(2)} pt.`
      );
    }
  }
  return { pageCount: pages.length };
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
  for (const sourcePath of [outputPath, ...resolvedAttachmentPaths]) {
    const sourceBytes = await readFile(sourcePath);
    const sourceDocument = await PDFDocument.load(sourceBytes);
    const copiedPages = await mergedDocument.copyPages(sourceDocument, sourceDocument.getPageIndices());
    copiedPages.forEach((page) => mergedDocument.addPage(page));
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
