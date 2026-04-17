import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createStoreUtils } from "../src/lib/store_utils.js";

test("store utils backfill missing booking persons from the public submission and persist them", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "travelagency-booking-persons-"));
  const dataDir = path.join(rootDir, "data");
  const dataPath = path.join(dataDir, "store.json");
  const toursDir = path.join(dataDir, "tours");
  const paymentDocumentsDir = path.join(dataDir, "payment_documents");
  const generatedOffersDir = path.join(dataDir, "generated_offers");
  const bookingImagesDir = path.join(dataDir, "booking_images");
  const bookingPersonPhotosDir = path.join(dataDir, "booking_person_photos");
  const bookingTravelPlanAttachmentsDir = path.join(dataDir, "booking_travel_plan_attachments");
  const tempUploadDir = path.join(dataDir, "tmp");

  await mkdir(dataDir, { recursive: true });
  await writeFile(dataPath, `${JSON.stringify({
    bookings: [
      {
        id: "booking_discovery_call",
        name: "Discovery call",
        stage: "NEW_BOOKING",
        preferred_currency: "USD",
        customer_language: "en",
        persons: [],
        pricing: { currency: "USD" },
        offer: { currency: "USD" },
        travel_plan: { days: [] },
        web_form_submission: {
          name: "Joachim Neumann",
          email: "info@asiatravelplan.com",
          phone_number: "+84354999192",
          preferred_language: "en",
          booking_name: "Discovery call"
        },
        created_at: "2026-03-23T00:00:00.000Z",
        updated_at: "2026-03-23T00:00:00.000Z"
      }
    ],
    activities: [],
    payment_documents: [],
    chat_channel_accounts: [],
    chat_conversations: [],
    chat_events: []
  }, null, 2)}\n`, "utf8");

  const storeUtils = createStoreUtils({
    dataPath,
    toursDir,
    paymentDocumentsDir,
    generatedOffersDir,
    bookingImagesDir,
    bookingPersonPhotosDir,
    bookingTravelPlanAttachmentsDir,
    tempUploadDir,
    writeQueueRef: { current: Promise.resolve() },
    syncBookingAssignmentFields: () => {},
    normalizeBookingTravelPlan: (value) => value,
    normalizeBookingPricing: (value) => value,
    normalizeBookingOffer: (value) => value,
    getBookingPreferredCurrency: () => "USD",
    convertBookingPricingToBaseCurrency: async (value) => value,
    convertBookingOfferToBaseCurrency: async (value) => value
  });

  const store = await storeUtils.readStore();
  assert.equal(store.__bookingPersonsWritebackNeeded, true);
  assert.equal(store.bookings[0].persons.length, 1);
  assert.equal(store.bookings[0].persons[0].id, "booking_discovery_call_primary_contact");
  assert.equal(store.bookings[0].persons[0].name, "Joachim Neumann");
  assert.deepEqual(store.bookings[0].persons[0].roles, ["primary_contact", "traveler"]);

  await storeUtils.persistStore(store);

  const persisted = JSON.parse(await readFile(dataPath, "utf8"));
  assert.equal(persisted.bookings[0].persons.length, 1);
  assert.equal(persisted.bookings[0].persons[0].id, "booking_discovery_call_primary_contact");
  assert.equal(persisted.bookings[0].persons[0].name, "Joachim Neumann");
});
