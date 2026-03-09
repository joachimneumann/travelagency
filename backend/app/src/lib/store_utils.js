import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeText } from "../../../../shared/js/text.js";
import { normalizeStoredBookingRecord } from "./booking_persons.js";

export function createStoreUtils({
  dataPath,
  toursDir,
  invoicesDir,
  consentEvidenceDir,
  customerPhotosDir,
  tempUploadDir,
  atpStaffPath,
  writeQueueRef,
  syncBookingAtpStaffFields,
  normalizeBookingPricing,
  normalizeBookingOffer,
  getBookingPreferredCurrency,
  convertBookingPricingToBaseCurrency,
  convertBookingOfferToBaseCurrency
}) {
  function parseLegacyBudgetRange(value) {
    const text = normalizeText(value);
    if (!text || /[€₫฿]/.test(text)) return { budget_lower_USD: null, budget_upper_USD: null };
    const matches = text.match(/\d[\d,]*/g) || [];
    const numbers = matches
      .map((item) => Number.parseInt(item.replace(/,/g, ""), 10))
      .filter((item) => Number.isInteger(item) && item >= 0);
    if (!numbers.length) return { budget_lower_USD: null, budget_upper_USD: null };
    if (text.includes("+")) return { budget_lower_USD: numbers[0], budget_upper_USD: null };
    if (numbers.length >= 2) return { budget_lower_USD: numbers[0], budget_upper_USD: numbers[1] };
    return { budget_lower_USD: numbers[0], budget_upper_USD: null };
  }

  async function ensureStorage() {
    await mkdir(toursDir, { recursive: true });
    await mkdir(invoicesDir, { recursive: true });
    await mkdir(consentEvidenceDir, { recursive: true });
    await mkdir(customerPhotosDir, { recursive: true });
    await mkdir(tempUploadDir, { recursive: true });
  }

  async function readStore() {
    const raw = await readFile(dataPath, "utf8");
    const parsed = JSON.parse(raw);
    parsed.clients ||= [];
    parsed.customers ||= [];
    parsed.bookings ||= [];
    parsed.activities ||= [];
    parsed.invoices ||= [];
    parsed.customer_consents ||= [];
    parsed.customer_documents ||= [];
    parsed.travel_groups ||= [];
    parsed.travel_group_members ||= [];
    parsed.chat_channel_accounts ||= [];
    parsed.chat_conversations ||= [];
    parsed.chat_events ||= [];
    const convertedBookings = await Promise.all(parsed.bookings.map(async (booking) => {
      const normalizedBooking = normalizeStoredBookingRecord(booking, parsed);
      syncBookingAtpStaffFields(normalizedBooking);
      if (normalizedBooking.budget_lower_USD === undefined && normalizedBooking.budget_upper_USD === undefined) {
        const budgetRange = parseLegacyBudgetRange(booking.budget);
        normalizedBooking.budget_lower_USD = budgetRange.budget_lower_USD;
        normalizedBooking.budget_upper_USD = budgetRange.budget_upper_USD;
      }
      delete normalizedBooking.budget;
      normalizedBooking.pricing = normalizeBookingPricing(normalizedBooking.pricing);
      normalizedBooking.offer = normalizeBookingOffer(normalizedBooking.offer, getBookingPreferredCurrency(normalizedBooking));
      normalizedBooking.pricing = await convertBookingPricingToBaseCurrency(normalizedBooking.pricing);
      normalizedBooking.offer = await convertBookingOfferToBaseCurrency(normalizedBooking.offer);
      return normalizedBooking;
    }));
    parsed.bookings = convertedBookings;
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

  async function loadAtpStaff() {
    try {
      const raw = await readFile(atpStaffPath, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("[backend] failed to load atp_staff.json:", error?.message || error);
      return [];
    }
  }

  async function persistAtpStaff(atpStaff) {
    writeQueueRef.current = writeQueueRef.current.then(async () => {
      await writeFile(atpStaffPath, `${JSON.stringify(atpStaff, null, 2)}\n`, "utf8");
    });
    await writeQueueRef.current;
  }

  return {
    ensureStorage,
    readStore,
    persistStore,
    readTours,
    persistTour,
    loadAtpStaff,
    persistAtpStaff
  };
}
