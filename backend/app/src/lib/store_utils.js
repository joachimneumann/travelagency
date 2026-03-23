import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeText } from "./text.js";
import { normalizeStoredBookingRecord } from "./booking_persons.js";

export function createStoreUtils({
  dataPath,
  toursDir,
  invoicesDir,
  generatedOffersDir,
  bookingImagesDir,
  bookingPersonPhotosDir,
  bookingTravelPlanAttachmentsDir,
  tempUploadDir,
  writeQueueRef,
  syncBookingAssignmentFields,
  normalizeBookingTravelPlan,
  normalizeBookingPricing,
  normalizeBookingOffer,
  getBookingPreferredCurrency,
  convertBookingPricingToBaseCurrency,
  convertBookingOfferToBaseCurrency
}) {
  async function ensureStorage() {
    await mkdir(path.dirname(dataPath), { recursive: true });
    await mkdir(toursDir, { recursive: true });
    await mkdir(invoicesDir, { recursive: true });
    await mkdir(generatedOffersDir, { recursive: true });
    await mkdir(bookingImagesDir, { recursive: true });
    await mkdir(bookingPersonPhotosDir, { recursive: true });
    await mkdir(bookingTravelPlanAttachmentsDir, { recursive: true });
    await mkdir(tempUploadDir, { recursive: true });
    try {
      await readFile(dataPath, "utf8");
    } catch {
      await writeFile(
        dataPath,
        `${JSON.stringify({
          bookings: [],
          suppliers: [],
          activities: [],
          invoices: [],
          chat_channel_accounts: [],
          chat_conversations: [],
          chat_events: [],
          offer_acceptance_challenges: []
        }, null, 2)}\n`,
        "utf8"
      );
    }
  }

  async function readStore() {
    const raw = await readFile(dataPath, "utf8");
    const parsed = JSON.parse(raw);
    parsed.bookings ||= [];
    parsed.suppliers ||= [];
    parsed.activities ||= [];
    parsed.invoices ||= [];
    parsed.chat_channel_accounts ||= [];
    parsed.chat_conversations ||= [];
    parsed.chat_events ||= [];
    parsed.offer_acceptance_challenges ||= [];
    let bookingPersonsWritebackNeeded = false;
    const convertedBookings = await Promise.all(parsed.bookings.map(async (booking) => {
      const rawPersons = Array.isArray(booking?.persons) ? booking.persons : [];
      const normalizedBooking = normalizeStoredBookingRecord(booking, parsed);
      if (JSON.stringify(rawPersons) !== JSON.stringify(Array.isArray(normalizedBooking?.persons) ? normalizedBooking.persons : [])) {
        bookingPersonsWritebackNeeded = true;
      }
      syncBookingAssignmentFields(normalizedBooking);
      normalizedBooking.pricing = normalizeBookingPricing(normalizedBooking.pricing);
      normalizedBooking.offer = normalizeBookingOffer(normalizedBooking.offer, getBookingPreferredCurrency(normalizedBooking));
      normalizedBooking.travel_plan = normalizeBookingTravelPlan(normalizedBooking.travel_plan, normalizedBooking.offer, {
        strictReferences: false
      });
      normalizedBooking.generated_offers = Array.isArray(normalizedBooking.generated_offers) ? normalizedBooking.generated_offers : [];
      normalizedBooking.pricing = await convertBookingPricingToBaseCurrency(normalizedBooking.pricing);
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
