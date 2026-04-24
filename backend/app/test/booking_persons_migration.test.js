import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createStoreUtils } from "../src/lib/store_utils.js";
import { createTravelPlanHelpers } from "../src/domain/travel_plan.js";

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

test("store utils prune legacy invoice data and strict-normalize accepted travel-plan snapshots", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "travelagency-store-cleanup-"));
  const dataDir = path.join(rootDir, "data");
  const dataPath = path.join(dataDir, "store.json");
  const toursDir = path.join(dataDir, "tours");
  const paymentDocumentsDir = path.join(dataDir, "payment_documents");
  const generatedOffersDir = path.join(dataDir, "generated_offers");
  const bookingImagesDir = path.join(dataDir, "booking_images");
  const bookingPersonPhotosDir = path.join(dataDir, "booking_person_photos");
  const bookingTravelPlanAttachmentsDir = path.join(dataDir, "booking_travel_plan_attachments");
  const tempUploadDir = path.join(dataDir, "tmp");
  const travelPlanHelpers = createTravelPlanHelpers();

  await mkdir(dataDir, { recursive: true });
  await writeFile(dataPath, `${JSON.stringify({
    bookings: [
      {
        id: "booking_cleanup",
        name: "Cleanup booking",
        preferred_currency: "USD",
        customer_language: "en",
        invoices_revision: 7,
        payment_documents_revision: 0,
        offer: { currency: "USD" },
        travel_plan: { days: [] },
        accepted_travel_plan_snapshot: {
          destinations: ["VN"],
          days: [
            {
              id: "travel_plan_day_1",
              day_number: 1,
              title: "Arrival",
              services: [
                {
                  id: "travel_plan_service_1",
                  kind: "other",
                  title: "Airport pickup",
                  supplier_id: null
                }
              ]
            }
          ],
          attachments: []
        },
        pdf_personalization: {
          travel_plan: {
            include_welcome: true
          },
          booking_confirmation: {
            include_welcome: true
          }
        },
        created_at: "2026-04-17T00:00:00.000Z",
        updated_at: "2026-04-17T00:00:00.000Z"
      }
    ],
    activities: [],
    invoices: [
      {
        id: "inv_legacy_1",
        booking_id: "booking_cleanup"
      }
    ],
    suppliers: [],
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
    normalizeBookingTravelPlan: travelPlanHelpers.normalizeBookingTravelPlan,
    normalizeBookingOffer: (value) => value,
    getBookingPreferredCurrency: () => "USD",
    convertBookingOfferToBaseCurrency: async (value) => value
  });

  const store = await storeUtils.readStore();
  assert.equal(store.__legacyStoreWritebackNeeded, true);
  assert.equal("invoices" in store, false);
  assert.equal("suppliers" in store, false);
  assert.equal("invoices_revision" in store.bookings[0], false);
  assert.equal("booking_confirmation" in (store.bookings[0].pdf_personalization || {}), false);
  assert.equal("supplier_id" in store.bookings[0].accepted_travel_plan_snapshot.days[0].services[0], false);

  await storeUtils.persistStore(store);

  const persisted = JSON.parse(await readFile(dataPath, "utf8"));
  assert.equal("invoices" in persisted, false);
  assert.equal("suppliers" in persisted, false);
  assert.equal("invoices_revision" in persisted.bookings[0], false);
  assert.equal("booking_confirmation" in (persisted.bookings[0].pdf_personalization || {}), false);
  assert.equal("supplier_id" in persisted.bookings[0].accepted_travel_plan_snapshot.days[0].services[0], false);
});

test("store utils preserve independent concurrent booking writes", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "travelagency-store-concurrency-"));
  const dataDir = path.join(rootDir, "data");
  const dataPath = path.join(dataDir, "store.json");

  await mkdir(dataDir, { recursive: true });
  await writeFile(dataPath, `${JSON.stringify({
    bookings: [
      {
        id: "booking_a",
        name: "Booking A",
        preferred_currency: "USD",
        customer_language: "en",
        persons: [],
        offer: { currency: "USD" },
        travel_plan: { days: [] }
      },
      {
        id: "booking_b",
        name: "Booking B",
        preferred_currency: "USD",
        customer_language: "en",
        persons: [],
        offer: { currency: "USD" },
        travel_plan: { days: [] }
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
    toursDir: path.join(dataDir, "tours"),
    paymentDocumentsDir: path.join(dataDir, "payment_documents"),
    generatedOffersDir: path.join(dataDir, "generated_offers"),
    bookingImagesDir: path.join(dataDir, "booking_images"),
    bookingPersonPhotosDir: path.join(dataDir, "booking_person_photos"),
    bookingTravelPlanAttachmentsDir: path.join(dataDir, "booking_travel_plan_attachments"),
    tempUploadDir: path.join(dataDir, "tmp"),
    writeQueueRef: { current: Promise.resolve() },
    syncBookingAssignmentFields: () => {},
    normalizeBookingTravelPlan: (value) => value,
    normalizeBookingOffer: (value) => value,
    getBookingPreferredCurrency: () => "USD",
    convertBookingOfferToBaseCurrency: async (value) => value
  });

  const firstStore = await storeUtils.readStore();
  const secondStore = await storeUtils.readStore();
  firstStore.bookings.find((booking) => booking.id === "booking_a").name = "Booking A updated";
  secondStore.bookings.find((booking) => booking.id === "booking_b").name = "Booking B updated";

  await Promise.all([
    storeUtils.persistStore(firstStore),
    storeUtils.persistStore(secondStore)
  ]);

  const persisted = JSON.parse(await readFile(dataPath, "utf8"));
  assert.equal(persisted.bookings.find((booking) => booking.id === "booking_a").name, "Booking A updated");
  assert.equal(persisted.bookings.find((booking) => booking.id === "booking_b").name, "Booking B updated");
});
