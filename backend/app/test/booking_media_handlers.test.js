import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createBookingMediaHandlers } from "../src/http/handlers/booking_media.js";
import { buildTravelerDetailsToken } from "../src/domain/traveler_details_portal.js";

function createHandlers(overrides = {}) {
  const calls = [];
  const secret = "test-traveler-details-secret";
  const handlers = createBookingMediaHandlers({
    readBodyJson: async () => ({}),
    sendJson: (_res, status, body) => calls.push({ type: "json", status, body }),
    normalizeText: (value) => String(value || "").trim(),
    getPrincipal: () => null,
    readStore: async () => ({ bookings: [] }),
    canEditBooking: () => false,
    assertExpectedRevision: async () => true,
    path,
    randomUUID: () => "uuid",
    TEMP_UPLOAD_DIR: "/tmp",
    BOOKING_IMAGES_DIR: "/tmp/booking_images",
    BOOKING_PERSON_PHOTOS_DIR: "/tmp/booking_person_photos",
    writeFile: async () => {},
    rm: async () => {},
    processBookingImageToWebp: async () => {},
    processBookingPersonImageToWebp: async () => {},
    nowIso: () => "2026-01-01T00:00:00.000Z",
    addActivity: () => {},
    actorLabel: () => "actor",
    persistStore: async () => {},
    buildBookingDetailResponse: async (booking) => ({ booking }),
    incrementBookingRevision: () => {},
    resolveBookingImageDiskPath: () => null,
    resolveBookingPersonPhotoDiskPath: (rawPath) => (
      rawPath === "booking_1/person_1-passport-1.webp" ? "/tmp/booking_person_photos/booking_1/person_1-passport-1.webp" : null
    ),
    sendFileWithCache: async (_req, _res, filePath, cacheControl) => calls.push({ type: "file", filePath, cacheControl }),
    getBookingPersons: () => [],
    travelerDetailsTokenConfig: { secret },
    ...overrides
  });
  return { handlers, calls, secret };
}

test("booking-person media rejects unauthenticated requests without a traveler token", async () => {
  const { handlers, calls } = createHandlers();
  await handlers.handlePublicBookingPersonPhoto({ url: "/public/v1/booking-person-photos/booking_1/person_1-passport-1.webp" }, {}, [
    "booking_1/person_1-passport-1.webp"
  ]);

  assert.deepEqual(calls, [{
    type: "json",
    status: 401,
    body: { error: "Unauthorized" }
  }]);
});

test("booking-person media serves valid traveler-token requests with private cache headers", async () => {
  const { handlers, calls, secret } = createHandlers();
  const token = buildTravelerDetailsToken({
    bookingId: "booking_1",
    personId: "person_1",
    expiresAt: "2026-01-02T00:00:00.000Z",
    secret
  });
  const url = `/public/v1/booking-person-photos/booking_1/person_1-passport-1.webp?token=${encodeURIComponent(token)}&person_id=person_1`;

  await handlers.handlePublicBookingPersonPhoto({ url }, {}, ["booking_1/person_1-passport-1.webp"]);

  assert.deepEqual(calls, [{
    type: "file",
    filePath: "/tmp/booking_person_photos/booking_1/person_1-passport-1.webp",
    cacheControl: "private, max-age=0, no-store"
  }]);
});

test("booking-person media prevents a valid token from reading another person's file", async () => {
  const { handlers, calls, secret } = createHandlers();
  const token = buildTravelerDetailsToken({
    bookingId: "booking_1",
    personId: "person_2",
    expiresAt: "2026-01-02T00:00:00.000Z",
    secret
  });
  const url = `/public/v1/booking-person-photos/booking_1/person_1-passport-1.webp?token=${encodeURIComponent(token)}&person_id=person_2`;

  await handlers.handlePublicBookingPersonPhoto({ url }, {}, ["booking_1/person_1-passport-1.webp"]);

  assert.deepEqual(calls, [{
    type: "json",
    status: 401,
    body: { error: "Unauthorized" }
  }]);
});
