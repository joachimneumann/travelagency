import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { createTravelPlanPdfArtifacts } from "../src/lib/travel_plan_pdf_artifacts.js";

async function createPdfBuffer(pageCount = 1) {
  const document = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    document.addPage([595.275591, 841.889764]);
  }
  return Buffer.from(await document.save());
}

test("travel-plan PDF artifacts allocate unique suffixes for concurrent creates", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "travel-plan-pdf-artifacts-"));
  const travelPlanPdfsDir = path.join(rootDir, "pdfs", "travel_plans");
  const generatedOffersDir = path.join(rootDir, "pdfs", "generated_offers");
  try {
    await mkdir(generatedOffersDir, { recursive: true });
    const artifacts = createTravelPlanPdfArtifacts({ travelPlanPdfsDir, generatedOffersDir });
    const sourceOnePath = path.join(rootDir, "source-1.pdf");
    const sourceTwoPath = path.join(rootDir, "source-2.pdf");
    await writeFile(sourceOnePath, await createPdfBuffer(2));
    await writeFile(sourceTwoPath, await createPdfBuffer(3));

    const [firstArtifact, secondArtifact] = await Promise.all([
      artifacts.persistBookingTravelPlanPdfArtifact("booking_concurrent", sourceOnePath, {
        createdAt: "2026-03-23T10:00:00.000Z",
        customerLanguage: "en",
        travelPlanRevision: 7
      }),
      artifacts.persistBookingTravelPlanPdfArtifact("booking_concurrent", sourceTwoPath, {
        createdAt: "2026-03-23T10:00:00.000Z",
        customerLanguage: "en",
        travelPlanRevision: 7
      })
    ]);

    assert.deepEqual(
      [firstArtifact.id, secondArtifact.id].sort(),
      ["2026-03-23-1", "2026-03-23-2"]
    );

    const listed = await artifacts.listBookingTravelPlanPdfs("booking_concurrent");
    assert.equal(listed.length, 2);
    assert.deepEqual(
      listed.map((item) => item.id).sort(),
      ["2026-03-23-1", "2026-03-23-2"]
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("travel-plan PDF artifact listing ignores stray legacy current files after artifact deletion", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "travel-plan-pdf-legacy-"));
  const travelPlanPdfsDir = path.join(rootDir, "pdfs", "travel_plans");
  const generatedOffersDir = path.join(rootDir, "pdfs", "generated_offers");
  try {
    await mkdir(generatedOffersDir, { recursive: true });
    const artifacts = createTravelPlanPdfArtifacts({ travelPlanPdfsDir, generatedOffersDir });
    const sourcePath = path.join(rootDir, "source.pdf");
    await writeFile(sourcePath, await createPdfBuffer());

    const createdArtifact = await artifacts.persistBookingTravelPlanPdfArtifact("booking_legacy", sourcePath, {
      createdAt: "2026-03-23T10:00:00.000Z"
    });
    assert.ok(createdArtifact);

    const deletedArtifact = await artifacts.deleteBookingTravelPlanPdfArtifact("booking_legacy", createdArtifact.id);
    assert.equal(deletedArtifact?.id, createdArtifact.id);

    await writeFile(
      path.join(generatedOffersDir, "travel-plan-booking_legacy.pdf"),
      await createPdfBuffer()
    );

    const listed = await artifacts.listBookingTravelPlanPdfs("booking_legacy");
    assert.deepEqual(listed, []);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
