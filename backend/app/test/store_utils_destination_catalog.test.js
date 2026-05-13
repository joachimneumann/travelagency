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
    paymentDocumentsDir: path.join(dataDir, "pdfs", "payment_documents"),
    generatedOffersDir: path.join(dataDir, "pdfs", "generated_offers"),
    bookingImagesDir: path.join(dataDir, "booking_images"),
    bookingPersonPhotosDir: path.join(dataDir, "booking_person_photos"),
    bookingTravelPlanAttachmentsDir: path.join(dataDir, "pdfs", "attachments"),
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
    destination_regions: [
      { id: "region_central", destination: "VN", code: "central", name: "Central", sort_order: 1 }
    ],
    destination_places: [
      { id: "place_hoi_an", region_id: "region_central", code: "hoi-an", name: "Hoi An", sort_order: 1 }
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
  assert.equal(Object.hasOwn(migratedStore, "destination_regions"), false);
  assert.equal(Object.hasOwn(migratedStore, "destination_places"), false);

  const destinationCatalog = await readJson(tourDestinationsPath);
  assert.deepEqual(destinationCatalog.destination_scope_destinations, [
    { code: "VN", label: "Vietnam", sort_order: 1 }
  ]);
  assert.equal(destinationCatalog.destination_regions[0].id, "region_central");
  assert.equal(destinationCatalog.destination_places[0].id, "place_hoi_an");

  const store = await storeUtils.readStore();
  assert.equal(store.destination_scope_destinations[0].code, "VN");
  store.destination_regions.push({
    id: "region_north",
    destination: "VN",
    code: "north",
    name: "North",
    sort_order: 2
  });

  await storeUtils.persistStore(store);

  const persistedStore = await readJson(dataPath);
  const persistedDestinationCatalog = await readJson(tourDestinationsPath);
  assert.equal(Object.hasOwn(persistedStore, "destination_regions"), false);
  assert.equal(persistedDestinationCatalog.destination_regions.at(-1).id, "region_north");
});

test("store utils persist deleted destination regions and places to destination catalog", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "travelagency-tour-destinations-delete-"));
  const dataDir = path.join(rootDir, "data");
  const contentToursDir = path.join(rootDir, "content", "tours");
  const dataPath = path.join(dataDir, "store.json");
  const tourDestinationsPath = path.join(contentToursDir, "destinations.json");

  await mkdir(dataDir, { recursive: true });
  await writeFile(dataPath, `${JSON.stringify({
    bookings: [],
    activities: [],
    payment_documents: [],
    chat_channel_accounts: [],
    chat_conversations: [],
    chat_events: []
  }, null, 2)}\n`, "utf8");
  await mkdir(contentToursDir, { recursive: true });
  await writeFile(tourDestinationsPath, `${JSON.stringify({
    destination_scope_destinations: [
      { code: "VN", label: "Vietnam", sort_order: 0, is_active: true }
    ],
    destination_regions: [
      { id: "region_north", destination: "VN", code: "north", name: "North", sort_order: 0, is_active: true },
      { id: "region_central", destination: "VN", code: "central", name: "Central", sort_order: 1, is_active: true }
    ],
    destination_places: [
      { id: "place_hanoi", region_id: "region_north", code: "hanoi", name: "Hanoi", sort_order: 0, is_active: true },
      { id: "place_hue", region_id: "region_central", code: "hue", name: "Hue", sort_order: 0, is_active: true }
    ]
  }, null, 2)}\n`, "utf8");

  const storeUtils = createTestStoreUtils({
    dataPath,
    toursDir: contentToursDir,
    tourDestinationsPath,
    dataDir
  });

  await storeUtils.ensureStorage();
  const store = await storeUtils.readStore();
  store.destination_places = store.destination_places.filter((place) => place.id !== "place_hue");
  store.destination_regions = store.destination_regions.filter((region) => region.id !== "region_central");

  await storeUtils.persistStore(store);

  const persistedStore = await readJson(dataPath);
  const persistedDestinationCatalog = await readJson(tourDestinationsPath);
  const reloadedStore = await storeUtils.readStore();

  assert.equal(Object.hasOwn(persistedStore, "destination_regions"), false);
  assert.equal(persistedDestinationCatalog.destination_places.some((place) => place.id === "place_hue"), false);
  assert.equal(persistedDestinationCatalog.destination_regions.some((region) => region.id === "region_central"), false);
  assert.equal(reloadedStore.destination_places.some((place) => place.id === "place_hue"), false);
  assert.equal(reloadedStore.destination_regions.some((region) => region.id === "region_central"), false);
  assert.equal(reloadedStore.destination_places.some((place) => place.id === "place_hanoi"), true);
  assert.equal(reloadedStore.destination_regions.some((region) => region.id === "region_north"), true);
});
