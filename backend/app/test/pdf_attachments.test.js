import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import PDFKitDocument from "pdfkit";
import { PDFDocument as PDFLibDocument } from "pdf-lib";
import {
  A4_HEIGHT_POINTS,
  A4_WIDTH_POINTS,
  appendPdfAttachmentsToFile,
  inspectPdfAttachmentBuffer,
  isA4PageSize,
  normalizePdfAttachmentBufferToA4,
  trimTrailingBlankPagesInFile
} from "../src/lib/pdf_attachments.js";

function createPdfBuffer({ size = [A4_WIDTH_POINTS, A4_HEIGHT_POINTS], pages = 1 } = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFKitDocument({
      size,
      margin: 0,
      autoFirstPage: false,
      compress: false
    });
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    for (let index = 0; index < pages; index += 1) {
      doc.addPage({ size });
      doc.text(`Page ${index + 1}`, 24, 24);
    }
    doc.end();
  });
}

test("travel-plan PDF attachments normalize non-A4 pages to A4", async () => {
  const a4Buffer = await createPdfBuffer({ pages: 2 });
  const info = await inspectPdfAttachmentBuffer(a4Buffer);
  assert.equal(info.pageCount, 2);
  assert.equal(info.pages.every((page) => page.isA4), true);

  const letterBuffer = await createPdfBuffer({ size: [612, 792] });
  const normalized = await normalizePdfAttachmentBufferToA4(letterBuffer);
  assert.equal(normalized.pageCount, 1);
  assert.equal(normalized.normalized, true);
  const normalizedDocument = await PDFLibDocument.load(normalized.buffer);
  const [page] = normalizedDocument.getPages();
  assert.equal(isA4PageSize(page.getWidth(), page.getHeight()), true);
});

test("travel-plan PDF attachments append extra PDFs to the generated document", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "atp-pdf-attachments-"));
  try {
    const outputPath = path.join(tempDir, "base.pdf");
    const attachmentOnePath = path.join(tempDir, "attachment-1.pdf");
    const attachmentTwoPath = path.join(tempDir, "attachment-2.pdf");

    await writeFile(outputPath, await createPdfBuffer({ pages: 1 }));
    await writeFile(attachmentOnePath, await createPdfBuffer({ size: [612, 792], pages: 2 }));
    await writeFile(attachmentTwoPath, await createPdfBuffer({ pages: 1 }));

    await appendPdfAttachmentsToFile(outputPath, [attachmentOnePath, attachmentTwoPath]);

    const mergedBytes = await readFile(outputPath);
    const mergedDocument = await PDFLibDocument.load(mergedBytes);
    assert.equal(mergedDocument.getPageCount(), 4);
    mergedDocument.getPages().forEach((page) => {
      assert.equal(isA4PageSize(page.getWidth(), page.getHeight()), true);
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("generated PDFs trim a truly blank trailing page", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "atp-pdf-trim-"));
  try {
    const outputPath = path.join(tempDir, "trailing-blank.pdf");
    const sourceDocument = await PDFLibDocument.create();
    const firstPage = sourceDocument.addPage([A4_WIDTH_POINTS, A4_HEIGHT_POINTS]);
    firstPage.drawText("Page 1", { x: 24, y: 24 });
    sourceDocument.addPage([A4_WIDTH_POINTS, A4_HEIGHT_POINTS]);
    await writeFile(outputPath, await sourceDocument.save());

    const removed = await trimTrailingBlankPagesInFile(outputPath);
    assert.equal(removed, true);

    const trimmedDocument = await PDFLibDocument.load(await readFile(outputPath));
    assert.equal(trimmedDocument.getPageCount(), 1);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
