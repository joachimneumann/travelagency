import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import {
  BOOKING_CONFIRMATION_PDF_ARTIFACTS_DIRNAME,
  createBookingConfirmationPdfArtifacts
} from "../src/lib/booking_confirmation_pdf_artifacts.js";

async function createPdfBuffer(pageCount = 1) {
  const document = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    document.addPage([595.275591, 841.889764]);
  }
  return Buffer.from(await document.save());
}

test("booking confirmation PDF artifacts allocate unique suffixes for concurrent creates", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "booking-confirmation-pdf-artifacts-"));
  const generatedOffersDir = path.join(rootDir, "pdfs", "generated_offers");
  try {
    await mkdir(generatedOffersDir, { recursive: true });
    const artifacts = createBookingConfirmationPdfArtifacts({ generatedOffersDir });
    const sourceOnePath = path.join(rootDir, "source-1.pdf");
    const sourceTwoPath = path.join(rootDir, "source-2.pdf");
    await writeFile(sourceOnePath, await createPdfBuffer(1));
    await writeFile(sourceTwoPath, await createPdfBuffer(2));

    const [firstArtifact, secondArtifact] = await Promise.all([
      artifacts.persistBookingConfirmationPdfArtifact("booking_concurrent", sourceOnePath, {
        createdAt: "2026-04-09T10:00:00.000Z"
      }),
      artifacts.persistBookingConfirmationPdfArtifact("booking_concurrent", sourceTwoPath, {
        createdAt: "2026-04-09T10:00:00.000Z"
      })
    ]);

    assert.deepEqual(
      [firstArtifact.id, secondArtifact.id].sort(),
      ["2026-04-09-1", "2026-04-09-2"]
    );

    const listed = await artifacts.listBookingConfirmationPdfs("booking_concurrent");
    assert.equal(listed.length, 2);
    assert.deepEqual(
      listed.map((item) => item.id).sort(),
      ["2026-04-09-1", "2026-04-09-2"]
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("booking confirmation PDF artifact listing ignores missing files", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "booking-confirmation-pdf-missing-"));
  const generatedOffersDir = path.join(rootDir, "pdfs", "generated_offers");
  try {
    await mkdir(generatedOffersDir, { recursive: true });
    const artifacts = createBookingConfirmationPdfArtifacts({ generatedOffersDir });
    const sourcePath = path.join(rootDir, "source.pdf");
    await writeFile(sourcePath, await createPdfBuffer());

    const artifact = await artifacts.persistBookingConfirmationPdfArtifact("booking_missing", sourcePath, {
      createdAt: "2026-04-09T10:00:00.000Z"
    });
    assert.ok(artifact?.id);

    await rm(
      path.join(generatedOffersDir, BOOKING_CONFIRMATION_PDF_ARTIFACTS_DIRNAME, "booking_missing", `${artifact.id}.pdf`),
      { force: true }
    );

    const listed = await artifacts.listBookingConfirmationPdfs("booking_missing");
    assert.deepEqual(listed, []);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("booking confirmation PDF artifacts can be deleted", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "booking-confirmation-pdf-delete-"));
  const generatedOffersDir = path.join(rootDir, "pdfs", "generated_offers");
  try {
    await mkdir(generatedOffersDir, { recursive: true });
    const artifacts = createBookingConfirmationPdfArtifacts({ generatedOffersDir });
    const sourcePath = path.join(rootDir, "source.pdf");
    await writeFile(sourcePath, await createPdfBuffer());

    const artifact = await artifacts.persistBookingConfirmationPdfArtifact("booking_delete", sourcePath, {
      createdAt: "2026-04-09T10:00:00.000Z"
    });
    assert.ok(artifact?.id);

    const deleted = await artifacts.deleteBookingConfirmationPdfArtifact("booking_delete", artifact.id);
    assert.equal(deleted?.id, artifact.id);

    const listed = await artifacts.listBookingConfirmationPdfs("booking_delete");
    assert.deepEqual(listed, []);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
