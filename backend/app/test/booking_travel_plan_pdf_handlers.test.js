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
      activities: [],
      payment_documents: []
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

test("travel-plan preview can render a booking one-pager through the shared one-pager writer", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "travel-plan-one-pager-preview-"));
  try {
    let travelPlanWriterCalled = false;
    let onePagerRequest = null;
    const { booking, handlers } = buildTravelPlanHandlerHarness(tempDir, {
      buildBookingTravelPlanReadModel: () => ({
        days: [
          {
            id: "day_1",
            day_number: 1,
            title: "Arrival",
            services: []
          }
        ]
      }),
      writeTravelPlanPdf: async () => {
        travelPlanWriterCalled = true;
        throw new Error("travel-plan writer should not run");
      },
      writeMarketingTourOnePagerPdf: async (tour, options) => {
        onePagerRequest = { tour, options };
        await mkdir(path.dirname(options.outputPath), { recursive: true });
        await writeFile(options.outputPath, await createPdfBuffer());
        return { outputPath: options.outputPath };
      },
      sendFileWithCache: async (_req, res, filePath, cacheControl, headers) => {
        res.statusCode = 200;
        res.sentFile = { filePath, cacheControl, headers };
      }
    });
    booking.name = "Northern Vietnam";
    booking.travel_styles = ["culture", "nature"];
    booking.web_form_submission = {
      destinations: ["VN"],
      travel_style: ["Culture"]
    };
    const res = createResponseRecorder();

    await handlers.handleGetBookingTravelPlanPdf(
      { url: "/api/v1/bookings/booking_pdf_handler/travel-plan/pdf?lang=en&pdf=one-pager" },
      res,
      ["booking_pdf_handler"]
    );

    assert.equal(res.statusCode, 200);
    assert.equal(travelPlanWriterCalled, false);
    assert.equal(onePagerRequest?.options?.lang, "en");
    assert.equal(onePagerRequest?.tour?.title, "Northern Vietnam");
    assert.deepEqual(onePagerRequest?.tour?.destinations, ["VN"]);
    assert.deepEqual(onePagerRequest?.tour?.styles, ["culture", "nature"]);
    assert.equal(onePagerRequest?.tour?.travel_plan?.days?.[0]?.title, "Arrival");
    assert.equal(res.sentFile?.cacheControl, "private, no-store, no-cache, max-age=0, must-revalidate");
    assert.equal(res.sentFile?.headers?.Pragma, "no-cache");
    assert.equal(res.sentFile?.headers?.Expires, "0");
    assert.match(res.sentFile?.headers?.["Content-Disposition"] || "", /one-pager/);
    assert.deepEqual(await readdir(tempDir), []);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("travel-plan preview uses the tour-details travel-plan PDF renderer options", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "travel-plan-tour-details-preview-"));
  try {
    let travelPlanRequest = null;
    const { booking, handlers } = buildTravelPlanHandlerHarness(tempDir, {
      buildBookingTravelPlanReadModel: () => ({
        days: [
          {
            id: "day_1",
            day_number: 1,
            title: "Arrival",
            services: []
          }
        ]
      }),
      writeTravelPlanPdf: async (pdfBooking, travelPlanSnapshot, options) => {
        travelPlanRequest = { pdfBooking, travelPlanSnapshot, options };
        await mkdir(path.dirname(options.outputPath), { recursive: true });
        await writeFile(options.outputPath, await createPdfBuffer());
        return { outputPath: options.outputPath };
      },
      sendFileWithCache: async (_req, res, filePath, cacheControl, headers) => {
        res.statusCode = 200;
        res.sentFile = { filePath, cacheControl, headers };
      }
    });
    booking.name = "Northern Vietnam";
    booking.travel_styles = ["culture", "nature"];
    const res = createResponseRecorder();

    await handlers.handleGetBookingTravelPlanPdf(
      { url: "/api/v1/bookings/booking_pdf_handler/travel-plan/pdf?lang=en" },
      res,
      ["booking_pdf_handler"]
    );

    assert.equal(res.statusCode, 200);
    assert.equal(travelPlanRequest?.pdfBooking?.name, "Northern Vietnam");
    assert.deepEqual(travelPlanRequest?.pdfBooking?.travel_styles, ["culture", "nature"]);
    assert.equal(travelPlanRequest?.travelPlanSnapshot?.days?.[0]?.title, "Arrival");
    assert.equal(travelPlanRequest?.options?.includeMarketingTourBackground, true);
    assert.equal(travelPlanRequest?.options?.includeGuideSection, false);
    assert.equal(travelPlanRequest?.options?.includeEndingSection, false);
    assert.equal(res.sentFile?.cacheControl, "private, no-store, no-cache, max-age=0, must-revalidate");
    assert.equal(res.sentFile?.headers?.Pragma, "no-cache");
    assert.equal(res.sentFile?.headers?.Expires, "0");
    assert.match(res.sentFile?.headers?.["Content-Disposition"] || "", /Asia Travel Plan 2026-03-23\.pdf/);
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
