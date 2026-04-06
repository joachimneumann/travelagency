import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { createBookingTravelPlanHandlers } from "../src/http/handlers/booking_travel_plan.js";

async function createPdfBuffer(pageCount = 1) {
  const document = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    document.addPage([595.275591, 841.889764]);
  }
  return Buffer.from(await document.save());
}

function createResponseRecorder() {
  return { statusCode: 0, payload: null };
}

function buildTravelPlanHandlerHarness(tempDir, overrides = {}) {
  const booking = {
    id: "booking_pdf_handler",
    travel_plan_revision: 3,
    travel_plan: { days: [] },
    offer: {},
    generated_offers: []
  };
  const deps = {
    readBodyJson: async (req) => req.bodyPayload ?? {},
    sendJson: (res, status, payload) => {
      res.statusCode = status;
      res.payload = payload;
    },
    readStore: async () => ({
      bookings: [booking],
      suppliers: [],
      activities: [],
      invoices: []
    }),
    getPrincipal: () => ({ sub: "kc-user", roles: ["atp_staff"] }),
    canEditBooking: () => true,
    canAccessBooking: () => true,
    normalizeText: (value) => String(value ?? "").trim(),
    nowIso: () => "2026-03-23T10:00:00.000Z",
    addActivity: () => {},
    actorLabel: () => "tester",
    persistStore: async () => {},
    assertExpectedRevision: async () => true,
    buildBookingDetailResponse: async () => ({ booking }),
    incrementBookingRevision: () => {},
    validateBookingTravelPlanInput: (travelPlan) => ({ ok: true, travel_plan: travelPlan }),
    normalizeBookingTravelPlan: (travelPlan) => travelPlan || { days: [] },
    buildBookingTravelPlanReadModel: () => ({ days: [] }),
    writeTravelPlanPdf: async (_booking, _snapshot, { outputPath }) => ({ outputPath }),
    persistBookingTravelPlanPdfArtifact: async () => ({
      id: "2026-03-23-1",
      filename: "Asia Travel Plan 2026-03-23-1.pdf",
      page_count: 1,
      created_at: "2026-03-23T10:00:00.000Z",
      sent_to_customer: false,
      storage_path: path.join(tempDir, "artifact.pdf")
    }),
    resolveBookingTravelPlanPdfArtifact: async () => null,
    updateBookingTravelPlanPdfArtifact: async () => null,
    deleteBookingTravelPlanPdfArtifact: async () => null,
    sendFileWithCache: async () => {},
    translateEntries: async () => [],
    path,
    randomUUID: () => "uuid-fixed",
    generatedOfferPdfPath: () => "",
    TEMP_UPLOAD_DIR: tempDir,
    TRAVEL_PLAN_PDF_PREVIEW_DIR: tempDir,
    BOOKING_IMAGES_DIR: tempDir,
    BOOKING_TRAVEL_PLAN_ATTACHMENTS_DIR: tempDir,
    writeFile,
    rm,
    processBookingImageToWebp: async () => {},
    mkdir
  };
  return {
    booking,
    handlers: createBookingTravelPlanHandlers({
      ...deps,
      ...overrides
    })
  };
}

test("travel-plan preview cleanup removes temp PDFs when rendering fails", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "travel-plan-preview-cleanup-"));
  try {
    const { handlers } = buildTravelPlanHandlerHarness(tempDir, {
      writeTravelPlanPdf: async (_booking, _snapshot, { outputPath }) => {
        await mkdir(path.dirname(outputPath), { recursive: true });
        await writeFile(outputPath, await createPdfBuffer());
        throw new Error("render failed");
      }
    });
    const res = createResponseRecorder();

    await handlers.handleGetBookingTravelPlanPdf(
      { url: "/api/v1/bookings/booking_pdf_handler/travel-plan/pdf?lang=en" },
      res,
      ["booking_pdf_handler"]
    );

    assert.equal(res.statusCode, 500);
    assert.match(String(res.payload?.detail || ""), /render failed/);
    assert.deepEqual(await readdir(tempDir), []);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("travel-plan PDF create returns an error and cleans temp PDFs when artifact persistence fails", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "travel-plan-create-cleanup-"));
  try {
    const { handlers } = buildTravelPlanHandlerHarness(tempDir, {
      writeTravelPlanPdf: async (_booking, _snapshot, { outputPath }) => {
        await mkdir(path.dirname(outputPath), { recursive: true });
        await writeFile(outputPath, await createPdfBuffer());
        return { outputPath };
      },
      persistBookingTravelPlanPdfArtifact: async () => {
        throw new Error("persist failed");
      }
    });
    const res = createResponseRecorder();

    await handlers.handlePostBookingTravelPlanPdf(
      {
        url: "/api/v1/bookings/booking_pdf_handler/travel-plan/pdfs",
        bodyPayload: {
          expected_travel_plan_revision: 3,
          lang: "en"
        }
      },
      res,
      ["booking_pdf_handler"]
    );

    assert.equal(res.statusCode, 500);
    assert.match(String(res.payload?.detail || ""), /persist failed/);
    assert.deepEqual(await readdir(tempDir), []);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
