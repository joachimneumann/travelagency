import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeBookingPdfPersonalization } from "./booking_pdf_personalization.js";
import { normalizeText } from "./text.js";
import { normalizeStoredBookingRecord } from "./booking_persons.js";

export function createStoreUtils({
  dataPath,
  toursDir,
  standardToursDir,
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
  async function ensureStorage() {
    await mkdir(path.dirname(dataPath), { recursive: true });
    await mkdir(toursDir, { recursive: true });
    await mkdir(standardToursDir, { recursive: true });
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
    try {
      await readFile(dataPath, "utf8");
    } catch {
      await writeFile(
        dataPath,
        `${JSON.stringify({
          bookings: [],
          activities: [],
          payment_documents: [],
          chat_channel_accounts: [],
          chat_conversations: [],
          chat_events: []
        }, null, 2)}\n`,
        "utf8"
      );
    }
  }

  async function readStore() {
    const raw = await readFile(dataPath, "utf8");
    const parsed = JSON.parse(raw);
    parsed.bookings ||= [];
    parsed.activities ||= [];
    parsed.payment_documents ||= [];
    parsed.chat_channel_accounts ||= [];
    parsed.chat_conversations ||= [];
    parsed.chat_events ||= [];
    let legacyStoreWritebackNeeded = false;
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

  async function persistStore(store) {
    writeQueueRef.current = writeQueueRef.current.then(async () => {
      const next = `${JSON.stringify(store, null, 2)}\n`;
      await writeFile(dataPath, next, "utf8");
    });
    await writeQueueRef.current;
  }

  function tourFolderPath(tourId) {
    return path.join(toursDir, tourId);
  }

  function tourJsonPath(tourId) {
    return path.join(tourFolderPath(tourId), "tour.json");
  }

  function standardTourFolderPath(standardTourId) {
    return path.join(standardToursDir, standardTourId);
  }

  function standardTourJsonPath(standardTourId) {
    return path.join(standardTourFolderPath(standardTourId), "standard_tour.json");
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

  async function readStandardTours() {
    const items = [];
    const entries = await readdir(standardToursDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const standardTourPath = path.join(standardToursDir, entry.name, "standard_tour.json");
      try {
        const raw = await readFile(standardTourPath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && normalizeText(parsed.id)) {
          items.push(parsed);
        }
      } catch {
        // Ignore unreadable standard tour folders.
      }
    }
    return items;
  }

  async function persistStandardTour(standardTour) {
    writeQueueRef.current = writeQueueRef.current.then(async () => {
      const id = normalizeText(standardTour?.id);
      if (!id) throw new Error("Standard tour id is required");
      await mkdir(standardTourFolderPath(id), { recursive: true });
      await writeFile(standardTourJsonPath(id), `${JSON.stringify(standardTour, null, 2)}\n`, "utf8");
    });
    await writeQueueRef.current;
  }

  async function deleteStandardTour(standardTourId) {
    writeQueueRef.current = writeQueueRef.current.then(async () => {
      const id = normalizeText(standardTourId);
      if (!id) throw new Error("Standard tour id is required");
      await rm(standardTourFolderPath(id), { recursive: true, force: true });
    });
    await writeQueueRef.current;
  }

  return {
    ensureStorage,
    readStore,
    persistStore,
    readTours,
    persistTour,
    readStandardTours,
    persistStandardTour,
    deleteStandardTour
  };
}
