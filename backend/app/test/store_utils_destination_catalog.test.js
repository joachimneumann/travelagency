import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createStoreUtils } from "../src/lib/store_utils.js";

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function createTestStoreUtils({
  dataPath,
  toursDir,
  tourDestinationsPath,
  dataDir
}) {
  return createStoreUtils({
    dataPath,
    toursDir,
    tourDestinationsPath,
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
}

test("store utils migrate tour destination catalog into content/tours/destinations.json", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "travelagency-tour-destinations-"));
  const dataDir = path.join(rootDir, "data");
  const contentToursDir = path.join(rootDir, "content", "tours");
  const dataPath = path.join(dataDir, "store.json");
  const tourDestinationsPath = path.join(contentToursDir, "destinations.json");

  await mkdir(dataDir, { recursive: true });
  await writeFile(dataPath, `${JSON.stringify({
    bookings: [],
    activities: [],
    payment_documents: [],
    destination_scope_destinations: [
      { code: "VN", label: "Vietnam", sort_order: 1 }
    ],
    destination_areas: [
      { id: "area_central", destination: "VN", code: "central", name: "Central", sort_order: 1 }
    ],
    destination_places: [
      { id: "place_hoi_an", area_id: "area_central", code: "hoi-an", name: "Hoi An", sort_order: 1 }
    ],
    chat_channel_accounts: [],
    chat_conversations: [],
    chat_events: []
  }, null, 2)}\n`, "utf8");

  const storeUtils = createTestStoreUtils({
    dataPath,
    toursDir: contentToursDir,
    tourDestinationsPath,
    dataDir
  });

  await storeUtils.ensureStorage();

  const migratedStore = await readJson(dataPath);
  assert.equal(Object.hasOwn(migratedStore, "destination_scope_destinations"), false);
  assert.equal(Object.hasOwn(migratedStore, "destination_areas"), false);
  assert.equal(Object.hasOwn(migratedStore, "destination_places"), false);

  const destinationCatalog = await readJson(tourDestinationsPath);
  assert.deepEqual(destinationCatalog.destination_scope_destinations, [
    { code: "VN", label: "Vietnam", sort_order: 1 }
  ]);
  assert.equal(destinationCatalog.destination_areas[0].id, "area_central");
  assert.equal(destinationCatalog.destination_places[0].id, "place_hoi_an");

  const store = await storeUtils.readStore();
  assert.equal(store.destination_scope_destinations[0].code, "VN");
  store.destination_areas.push({
    id: "area_north",
    destination: "VN",
    code: "north",
    name: "North",
    sort_order: 2
  });

  await storeUtils.persistStore(store);

  const persistedStore = await readJson(dataPath);
  const persistedDestinationCatalog = await readJson(tourDestinationsPath);
  assert.equal(Object.hasOwn(persistedStore, "destination_areas"), false);
  assert.equal(persistedDestinationCatalog.destination_areas.at(-1).id, "area_north");
});
