import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeBookingPdfPersonalization } from "./booking_pdf_personalization.js";
import { normalizeText } from "./text.js";
import { normalizeStoredBookingRecord } from "./booking_persons.js";
import { CUSTOMER_CONTENT_LANGUAGE_CODES } from "../../../../shared/generated/language_catalog.js";
import {
  DESTINATION_COUNTRY_CODES,
  DESTINATION_COUNTRY_TO_TOUR_DESTINATION_CODE
} from "../../../../shared/js/destination_country_codes.js";
import { getTourDestinationLabel } from "../domain/tour_catalog_i18n.js";

const STORE_SNAPSHOT = Symbol("asiatravelplan_store_snapshot");
const DESTINATION_CATALOG_KEYS = Object.freeze([
  "destination_scope_destinations",
  "destination_areas",
  "destination_places"
]);
const DEFAULT_DESTINATION_SCOPE_DESTINATIONS = Object.freeze(
  DESTINATION_COUNTRY_CODES.map((code, index) => {
    const destinationCode = DESTINATION_COUNTRY_TO_TOUR_DESTINATION_CODE[code] || code.toLowerCase();
    return Object.freeze({
      code,
      label: getTourDestinationLabel(destinationCode, "en"),
      label_i18n: Object.freeze(
        Object.fromEntries(
          CUSTOMER_CONTENT_LANGUAGE_CODES.map((lang) => [lang, getTourDestinationLabel(destinationCode, lang)])
        )
      ),
      sort_order: index,
      is_active: true
    });
  })
);

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function defaultDestinationScopeDestinations() {
  return cloneJson(DEFAULT_DESTINATION_SCOPE_DESTINATIONS);
}

function defaultDestinationCatalogDocument() {
  return {
    destination_scope_destinations: defaultDestinationScopeDestinations(),
    destination_areas: [],
    destination_places: []
  };
}

function destinationCatalogDocumentFromStore(store = {}) {
  return {
    destination_scope_destinations: Array.isArray(store?.destination_scope_destinations) && store.destination_scope_destinations.length
      ? cloneJson(store.destination_scope_destinations)
      : defaultDestinationScopeDestinations(),
    destination_areas: Array.isArray(store?.destination_areas) ? cloneJson(store.destination_areas) : [],
    destination_places: Array.isArray(store?.destination_places) ? cloneJson(store.destination_places) : []
  };
}

function storeHasDestinationCatalogFields(store) {
  return DESTINATION_CATALOG_KEYS.some((key) => Object.prototype.hasOwnProperty.call(store || {}, key));
}

function storeWithoutDestinationCatalogFields(store = {}) {
  const next = cloneJson(store || {});
  for (const key of DESTINATION_CATALOG_KEYS) {
    delete next[key];
  }
  return next;
}

function mergeDestinationCatalogIntoStore(store = {}, catalog = {}) {
  return {
    ...(store && typeof store === "object" && !Array.isArray(store) ? store : {}),
    ...destinationCatalogDocumentFromStore(catalog)
  };
}

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function collectionItemKey(item) {
  return normalizeText(item?.id || item?.document_id || item?.booking_id);
}

function mergeObjectValue(baseValue, latestValue, nextValue) {
  if (jsonEqual(nextValue, baseValue)) return cloneJson(latestValue);
  if (jsonEqual(latestValue, baseValue)) return cloneJson(nextValue);
  if (jsonEqual(latestValue, nextValue)) return cloneJson(nextValue);
  if (
    baseValue && typeof baseValue === "object" && !Array.isArray(baseValue)
    && latestValue && typeof latestValue === "object" && !Array.isArray(latestValue)
    && nextValue && typeof nextValue === "object" && !Array.isArray(nextValue)
  ) {
    return mergePlainObject(baseValue, latestValue, nextValue);
  }
  return cloneJson(nextValue);
}

function mergePlainObject(baseValue = {}, latestValue = {}, nextValue = {}) {
  const result = { ...cloneJson(latestValue || {}) };
  const keys = new Set([
    ...Object.keys(baseValue || {}),
    ...Object.keys(latestValue || {}),
    ...Object.keys(nextValue || {})
  ]);

  for (const key of keys) {
    const baseHas = Object.prototype.hasOwnProperty.call(baseValue || {}, key);
    const latestHas = Object.prototype.hasOwnProperty.call(latestValue || {}, key);
    const nextHas = Object.prototype.hasOwnProperty.call(nextValue || {}, key);
    const baseEntry = baseHas ? baseValue[key] : undefined;
    const latestEntry = latestHas ? latestValue[key] : undefined;
    const nextEntry = nextHas ? nextValue[key] : undefined;

    if (!nextHas) {
      if (!baseHas) {
        if (latestHas) result[key] = cloneJson(latestEntry);
        continue;
      }
      if (!latestHas || jsonEqual(latestEntry, baseEntry)) {
        delete result[key];
        continue;
      }
      result[key] = cloneJson(latestEntry);
      continue;
    }

    if (!latestHas && !baseHas) {
      result[key] = cloneJson(nextEntry);
      continue;
    }

    result[key] = mergeObjectValue(baseEntry, latestEntry, nextEntry);
  }

  return result;
}

function mergeCollectionByKey(baseItems = [], latestItems = [], nextItems = [], mergeItems = mergeObjectValue) {
  const baseMap = new Map();
  const latestMap = new Map();
  const nextMap = new Map();
  const keyOrder = [];

  function addToMap(map, item, fallbackPrefix, index) {
    const key = collectionItemKey(item) || `${fallbackPrefix}_${index}`;
    if (!keyOrder.includes(key)) keyOrder.push(key);
    map.set(key, item);
  }

  (Array.isArray(baseItems) ? baseItems : []).forEach((item, index) => addToMap(baseMap, item, "base", index));
  (Array.isArray(latestItems) ? latestItems : []).forEach((item, index) => addToMap(latestMap, item, "latest", index));
  (Array.isArray(nextItems) ? nextItems : []).forEach((item, index) => addToMap(nextMap, item, "next", index));

  const merged = [];
  for (const key of keyOrder) {
    const baseHas = baseMap.has(key);
    const latestHas = latestMap.has(key);
    const nextHas = nextMap.has(key);
    if (!nextHas && baseHas) continue;
    if (!nextHas && !baseHas && latestHas) {
      merged.push(cloneJson(latestMap.get(key)));
      continue;
    }
    if (nextHas && !latestHas && !baseHas) {
      merged.push(cloneJson(nextMap.get(key)));
      continue;
    }
    if (nextHas && latestHas && !baseHas) {
      merged.push(jsonEqual(nextMap.get(key), latestMap.get(key))
        ? cloneJson(nextMap.get(key))
        : mergeItems({}, latestMap.get(key), nextMap.get(key)));
      continue;
    }
    if (nextHas && latestHas && baseHas) {
      merged.push(mergeItems(baseMap.get(key), latestMap.get(key), nextMap.get(key)));
    }
  }

  return merged;
}

function mergeStoreSnapshot(baseStore, latestStore, nextStore) {
  const result = mergePlainObject(baseStore || {}, latestStore || {}, nextStore || {});
  result.bookings = mergeCollectionByKey(
    baseStore?.bookings,
    latestStore?.bookings,
    nextStore?.bookings,
    mergePlainObject
  );
  for (const key of [
    "destination_scope_destinations",
    "destination_areas",
    "destination_places"
  ]) {
    result[key] = mergeCollectionByKey(baseStore?.[key], latestStore?.[key], nextStore?.[key], mergePlainObject);
  }
  for (const key of [
    "activities",
    "payment_documents",
    "chat_channel_accounts",
    "chat_conversations",
    "chat_events"
  ]) {
    result[key] = mergeCollectionByKey(baseStore?.[key], latestStore?.[key], nextStore?.[key]);
  }
  return result;
}

export function createStoreUtils({
  dataPath,
  toursDir,
  tourDestinationsPath = "",
  paymentDocumentsDir,
  generatedOffersDir,
  travelPlanPdfsDir,
  bookingImagesDir,
  bookingPersonPhotosDir,
  bookingTravelPlanAttachmentsDir,
  tempUploadDir,
  travelPlanPdfPreviewDir,
  writeQueueRef,
  syncBookingAssignmentFields,
  normalizeBookingTravelPlan,
  normalizeBookingOffer,
  getBookingPreferredCurrency,
  convertBookingOfferToBaseCurrency
}) {
  const destinationCatalogPath = normalizeText(tourDestinationsPath);

  function initialStoreDocument() {
    return {
      bookings: [],
      activities: [],
      payment_documents: [],
      ...(destinationCatalogPath ? {} : defaultDestinationCatalogDocument()),
      chat_channel_accounts: [],
      chat_conversations: [],
      chat_events: []
    };
  }

  async function ensureStorage() {
    await mkdir(path.dirname(dataPath), { recursive: true });
    await mkdir(toursDir, { recursive: true });
    if (destinationCatalogPath) {
      await mkdir(path.dirname(destinationCatalogPath), { recursive: true });
    }
    await mkdir(paymentDocumentsDir, { recursive: true });
    await mkdir(generatedOffersDir, { recursive: true });
    if (travelPlanPdfsDir) {
      await mkdir(travelPlanPdfsDir, { recursive: true });
    }
    await mkdir(bookingImagesDir, { recursive: true });
    await mkdir(bookingPersonPhotosDir, { recursive: true });
    await mkdir(bookingTravelPlanAttachmentsDir, { recursive: true });
    await mkdir(tempUploadDir, { recursive: true });
    if (travelPlanPdfPreviewDir) {
      await mkdir(travelPlanPdfPreviewDir, { recursive: true });
    }
    let storedDocument = null;
    try {
      storedDocument = JSON.parse(await readFile(dataPath, "utf8"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      storedDocument = initialStoreDocument();
      await writeFile(
        dataPath,
        `${JSON.stringify(storedDocument, null, 2)}\n`,
        "utf8"
      );
    }
    if (!destinationCatalogPath) return;

    try {
      JSON.parse(await readFile(destinationCatalogPath, "utf8"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await writeFile(
        destinationCatalogPath,
        `${JSON.stringify(destinationCatalogDocumentFromStore(storedDocument), null, 2)}\n`,
        "utf8"
      );
    }

    if (storeHasDestinationCatalogFields(storedDocument)) {
      await writeFile(
        dataPath,
        `${JSON.stringify(storeWithoutDestinationCatalogFields(storedDocument), null, 2)}\n`,
        "utf8"
      );
    }
  }

  function attachStoreSnapshot(store) {
    Object.defineProperty(store, STORE_SNAPSHOT, {
      value: cloneJson(store),
      enumerable: false,
      configurable: true,
      writable: true
    });
    return store;
  }

  async function normalizeParsedStore(parsed) {
    let legacyStoreWritebackNeeded = false;
    parsed.bookings ||= [];
    parsed.activities ||= [];
    parsed.payment_documents ||= [];
    if (!Array.isArray(parsed.destination_scope_destinations) || !parsed.destination_scope_destinations.length) {
      parsed.destination_scope_destinations = defaultDestinationScopeDestinations();
      legacyStoreWritebackNeeded = true;
    }
    parsed.destination_areas ||= [];
    parsed.destination_places ||= [];
    parsed.chat_channel_accounts ||= [];
    parsed.chat_conversations ||= [];
    parsed.chat_events ||= [];
    if (Object.prototype.hasOwnProperty.call(parsed, "invoices")) {
      delete parsed.invoices;
      legacyStoreWritebackNeeded = true;
    }
    if (Object.prototype.hasOwnProperty.call(parsed, "suppliers")) {
      delete parsed.suppliers;
      legacyStoreWritebackNeeded = true;
    }
    let bookingPersonsWritebackNeeded = false;
    let bookingOfferWritebackNeeded = false;
    const convertedBookings = await Promise.all(parsed.bookings.map(async (booking) => {
      const rawPersons = Array.isArray(booking?.persons) ? booking.persons : [];
      const rawOffer = booking?.offer && typeof booking.offer === "object" ? booking.offer : null;
      const rawAcceptedTravelPlanSnapshot = booking?.accepted_travel_plan_snapshot && typeof booking.accepted_travel_plan_snapshot === "object"
        ? booking.accepted_travel_plan_snapshot
        : null;
      const rawPdfPersonalization = booking?.pdf_personalization && typeof booking.pdf_personalization === "object"
        ? booking.pdf_personalization
        : null;
      const normalizedBooking = normalizeStoredBookingRecord(booking, parsed);
      if (JSON.stringify(rawPersons) !== JSON.stringify(Array.isArray(normalizedBooking?.persons) ? normalizedBooking.persons : [])) {
        bookingPersonsWritebackNeeded = true;
      }
      if (Object.prototype.hasOwnProperty.call(normalizedBooking, "invoices_revision")) {
        delete normalizedBooking.invoices_revision;
        legacyStoreWritebackNeeded = true;
      }
      syncBookingAssignmentFields(normalizedBooking);
      const normalizedOffer = normalizeBookingOffer(normalizedBooking.offer, getBookingPreferredCurrency(normalizedBooking));
      if (rawOffer && JSON.stringify(rawOffer) !== JSON.stringify(normalizedOffer)) {
        bookingOfferWritebackNeeded = true;
      }
      normalizedBooking.offer = normalizedOffer;
      normalizedBooking.travel_plan = normalizeBookingTravelPlan(normalizedBooking.travel_plan, normalizedBooking.offer, {
        strictReferences: false
      });
      if (rawAcceptedTravelPlanSnapshot) {
        const normalizedAcceptedTravelPlanSnapshot = normalizeBookingTravelPlan(rawAcceptedTravelPlanSnapshot, normalizedBooking.offer, {
          strictReferences: false
        });
        if (JSON.stringify(rawAcceptedTravelPlanSnapshot) !== JSON.stringify(normalizedAcceptedTravelPlanSnapshot)) {
          legacyStoreWritebackNeeded = true;
        }
        normalizedBooking.accepted_travel_plan_snapshot = normalizedAcceptedTravelPlanSnapshot;
      }
      const normalizedPdfPersonalization = normalizeBookingPdfPersonalization(rawPdfPersonalization, {
        flatLang: normalizedBooking?.customer_language || "en",
        sourceLang: "en"
      });
      if (JSON.stringify(rawPdfPersonalization || {}) !== JSON.stringify(normalizedPdfPersonalization || {})) {
        legacyStoreWritebackNeeded = true;
      }
      if (normalizedPdfPersonalization && Object.keys(normalizedPdfPersonalization).length > 0) {
        normalizedBooking.pdf_personalization = normalizedPdfPersonalization;
      } else {
        delete normalizedBooking.pdf_personalization;
      }
      normalizedBooking.generated_offers = Array.isArray(normalizedBooking.generated_offers) ? normalizedBooking.generated_offers : [];
      normalizedBooking.offer = await convertBookingOfferToBaseCurrency(normalizedBooking.offer);
      return normalizedBooking;
    }));
    parsed.bookings = convertedBookings;
    Object.defineProperty(parsed, "__bookingPersonsWritebackNeeded", {
      value: bookingPersonsWritebackNeeded,
      enumerable: false,
      configurable: true,
      writable: true
    });
    Object.defineProperty(parsed, "__bookingOfferWritebackNeeded", {
      value: bookingOfferWritebackNeeded,
      enumerable: false,
      configurable: true,
      writable: true
    });
    Object.defineProperty(parsed, "__legacyStoreWritebackNeeded", {
      value: legacyStoreWritebackNeeded,
      enumerable: false,
      configurable: true,
      writable: true
    });
    return parsed;
  }

  async function readDestinationCatalogFromDisk(storeDocument) {
    if (!destinationCatalogPath) {
      return destinationCatalogDocumentFromStore(storeDocument);
    }
    try {
      const raw = await readFile(destinationCatalogPath, "utf8");
      return destinationCatalogDocumentFromStore(JSON.parse(raw));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      return destinationCatalogDocumentFromStore(storeDocument);
    }
  }

  async function readStoreDocumentFromDisk() {
    const raw = await readFile(dataPath, "utf8");
    return JSON.parse(raw);
  }

  async function readStoreFromDisk() {
    const storeDocument = await readStoreDocumentFromDisk();
    const destinationCatalog = await readDestinationCatalogFromDisk(storeDocument);
    return await normalizeParsedStore(mergeDestinationCatalogIntoStore(storeDocument, destinationCatalog));
  }

  async function readStore() {
    await writeQueueRef.current.catch(() => {});
    return attachStoreSnapshot(await readStoreFromDisk());
  }

  async function persistStore(store) {
    const baseSnapshot = store?.[STORE_SNAPSHOT] ? cloneJson(store[STORE_SNAPSHOT]) : null;
    const requestedStore = cloneJson(store);
    writeQueueRef.current = writeQueueRef.current.catch(() => {}).then(async () => {
      let nextStore = requestedStore;
      if (baseSnapshot) {
        const latestStore = await readStoreFromDisk();
        if (!jsonEqual(latestStore, baseSnapshot)) {
          nextStore = mergeStoreSnapshot(baseSnapshot, latestStore, requestedStore);
        }
      }
      const storeDocument = destinationCatalogPath ? storeWithoutDestinationCatalogFields(nextStore) : nextStore;
      const next = `${JSON.stringify(storeDocument, null, 2)}\n`;
      await writeFile(dataPath, next, "utf8");
      if (destinationCatalogPath) {
        await writeFile(
          destinationCatalogPath,
          `${JSON.stringify(destinationCatalogDocumentFromStore(nextStore), null, 2)}\n`,
          "utf8"
        );
      }
      if (store && typeof store === "object" && !Array.isArray(store)) {
        Object.defineProperty(store, STORE_SNAPSHOT, {
          value: cloneJson(nextStore),
          enumerable: false,
          configurable: true,
          writable: true
        });
      }
    });
    await writeQueueRef.current;
  }

  function tourFolderPath(tourId) {
    return path.join(toursDir, tourId);
  }

  function tourJsonPath(tourId) {
    return path.join(tourFolderPath(tourId), "tour.json");
  }

  async function readTours() {
    const items = [];
    const entries = await readdir(toursDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const tourPath = path.join(toursDir, entry.name, "tour.json");
      try {
        const raw = await readFile(tourPath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && normalizeText(parsed.id)) {
          items.push(parsed);
        }
      } catch {
        // Ignore unreadable tour folders.
      }
    }
    return items;
  }

  async function persistTour(tour) {
    writeQueueRef.current = writeQueueRef.current.then(async () => {
      const id = normalizeText(tour?.id);
      if (!id) throw new Error("Tour id is required");
      await mkdir(tourFolderPath(id), { recursive: true });
      await writeFile(tourJsonPath(id), `${JSON.stringify(tour, null, 2)}\n`, "utf8");
    });
    await writeQueueRef.current;
  }

  return {
    ensureStorage,
    readStore,
    persistStore,
    readTours,
    persistTour
  };
}
