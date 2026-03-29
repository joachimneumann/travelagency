import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BACKEND_UI_LANGUAGE_CODES } from "../../../shared/generated/language_catalog.js";
import {
  normalizeBookingContentLang,
  normalizeBookingSourceLang,
  normalizeLocalizedTextMap,
  resolveLocalizedText
} from "../src/domain/booking_content_i18n.js";
import {
  normalizeOfferTranslationMeta,
  normalizeTravelPlanTranslationMeta
} from "../src/domain/booking_translation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, "..");
const DEFAULT_STORE_PATH = path.join(APP_ROOT, "data", "store.json");

function usage() {
  return [
    "Usage:",
    "  node backend/app/scripts/prune_stale_content_translations.js [--store <path>] [--booking <booking_id>] [--write]",
    "",
    "Behavior:",
    "  - keeps the booking's current customer language plus inferred source-language branches",
    "  - affects booking.offer.details_i18n and customer-facing booking.travel_plan *_i18n fields",
    "  - infers source languages from section translation_meta and backend-editable localized branches",
    "  - prunes offer/travel-plan translation_meta to kept target languages only",
    "  - defaults to dry-run; pass --write to persist changes"
  ].join("\n");
}

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv : [];
  const options = {
    storePath: process.env.STORE_FILE
      ? path.resolve(process.cwd(), String(process.env.STORE_FILE))
      : DEFAULT_STORE_PATH,
    bookingIds: new Set(),
    write: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = String(args[index] || "");
    if (!arg) continue;
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--write") {
      options.write = true;
      continue;
    }
    if (arg === "--store") {
      const value = args[index + 1];
      if (!value) throw new Error("--store requires a path");
      options.storePath = path.resolve(process.cwd(), String(value));
      index += 1;
      continue;
    }
    if (arg === "--booking") {
      const value = String(args[index + 1] || "").trim();
      if (!value) throw new Error("--booking requires a booking id");
      options.bookingIds.add(value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function bookingCurrentContentLanguage(booking) {
  const primaryContact = Array.isArray(booking?.persons)
    ? booking.persons.find((person) => Array.isArray(person?.roles) && person.roles.includes("primary_contact"))
    : null;
  return normalizeBookingContentLang(
    booking?.customer_language
      || booking?.web_form_submission?.preferred_language
      || primaryContact?.preferred_language
      || "en"
  );
}

function keepTargetLanguagesForBooking(booking) {
  return [bookingCurrentContentLanguage(booking)];
}

function normalizeSourceLanguageSet(values) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((lang) => normalizeBookingSourceLang(lang))
      .filter((lang) => BACKEND_UI_LANGUAGE_CODES.includes(lang))
  ));
}

function sourceLanguagesFromTranslationMeta(section) {
  const translationMeta = section?.translation_meta && typeof section.translation_meta === "object" && !Array.isArray(section.translation_meta)
    ? section.translation_meta
    : {};
  return normalizeSourceLanguageSet(
    Object.values(translationMeta).map((entry) => entry?.source_lang)
  );
}

function sourceLanguagesFromLocalizedValue(value) {
  return normalizeSourceLanguageSet(Object.keys(normalizeLocalizedTextMap(value, "en")));
}

function keepLanguagesForField(value, keepTargetLangs, sectionSourceLangs = []) {
  return Array.from(new Set([
    ...(Array.isArray(keepTargetLangs) ? keepTargetLangs : []).map((lang) => normalizeBookingContentLang(lang)),
    ...sectionSourceLangs,
    ...sourceLanguagesFromLocalizedValue(value)
  ]));
}

function pruneLocalizedMap(value, keepLangs) {
  const normalized = normalizeLocalizedTextMap(value, "en");
  const keep = Array.from(new Set((Array.isArray(keepLangs) ? keepLangs : []).map((lang) => normalizeBookingContentLang(lang))));
  const next = {};
  for (const lang of keep) {
    if (normalized[lang]) next[lang] = normalized[lang];
  }
  const previousKeys = Object.keys(normalized).sort();
  const nextKeys = Object.keys(next).sort();
  const changed = previousKeys.length !== nextKeys.length
    || previousKeys.some((key, index) => key !== nextKeys[index] || normalized[key] !== next[key]);
  return {
    map: next,
    changed,
    removedLanguages: previousKeys.filter((key) => !nextKeys.includes(key)).length
  };
}

function pruneTranslationMeta(section, keepLangs) {
  const sourceLangs = new Set(sourceLanguagesFromTranslationMeta(section));
  const keep = new Set(
    (Array.isArray(keepLangs) ? keepLangs : [])
      .map((lang) => normalizeBookingContentLang(lang))
      .filter((lang) => !sourceLangs.has(lang))
  );
  const previous = section?.translation_meta && typeof section.translation_meta === "object" && !Array.isArray(section.translation_meta)
    ? section.translation_meta
    : {};
  const next = Object.fromEntries(
    Object.entries(previous).filter(([lang]) => keep.has(normalizeBookingContentLang(lang)))
  );
  const previousKeys = Object.keys(previous);
  section.translation_meta = next;
  return previousKeys.length - Object.keys(next).length;
}

function applyPrunedField(holder, mapField, plainField, keepLangs, emptyValue = "") {
  const result = pruneLocalizedMap(holder?.[mapField] ?? holder?.[plainField], keepLangs);
  holder[mapField] = result.map;
  const resolved = resolveLocalizedText(result.map, "en", "");
  holder[plainField] = resolved || emptyValue;
  return result;
}

function pruneOffer(offer, keepLangs) {
  if (!offer || typeof offer !== "object" || Array.isArray(offer)) {
    return { fieldChanges: 0, removedLanguages: 0, translationMetaRemoved: 0 };
  }
  normalizeOfferTranslationMeta(offer);
  const sectionSourceLangs = sourceLanguagesFromTranslationMeta(offer);
  let fieldChanges = 0;
  let removedLanguages = 0;
  for (const component of Array.isArray(offer.components) ? offer.components : []) {
    const result = applyPrunedField(
      component,
      "details_i18n",
      "details",
      keepLanguagesForField(component?.details_i18n ?? component?.details, keepLangs, sectionSourceLangs),
      ""
    );
    if (result.changed) fieldChanges += 1;
    removedLanguages += result.removedLanguages;
  }
  return {
    fieldChanges,
    removedLanguages,
    translationMetaRemoved: pruneTranslationMeta(offer, keepLangs)
  };
}

function pruneTravelPlan(travelPlan, keepLangs) {
  if (!travelPlan || typeof travelPlan !== "object" || Array.isArray(travelPlan)) {
    return { fieldChanges: 0, removedLanguages: 0, translationMetaRemoved: 0 };
  }
  normalizeTravelPlanTranslationMeta(travelPlan);
  const sectionSourceLangs = sourceLanguagesFromTranslationMeta(travelPlan);
  let fieldChanges = 0;
  let removedLanguages = 0;

  for (const day of Array.isArray(travelPlan.days) ? travelPlan.days : []) {
    for (const [mapField, plainField, emptyValue] of [
      ["title_i18n", "title", ""],
      ["overnight_location_i18n", "overnight_location", null],
      ["notes_i18n", "notes", null]
    ]) {
      const result = applyPrunedField(
        day,
        mapField,
        plainField,
        keepLanguagesForField(day?.[mapField] ?? day?.[plainField], keepLangs, sectionSourceLangs),
        emptyValue
      );
      if (result.changed) fieldChanges += 1;
      removedLanguages += result.removedLanguages;
    }

    for (const item of Array.isArray(day.items) ? day.items : []) {
      for (const [mapField, plainField, emptyValue] of [
        ["time_label_i18n", "time_label", null],
        ["title_i18n", "title", ""],
        ["details_i18n", "details", null],
        ["location_i18n", "location", null]
      ]) {
        const result = applyPrunedField(
          item,
          mapField,
          plainField,
          keepLanguagesForField(item?.[mapField] ?? item?.[plainField], keepLangs, sectionSourceLangs),
          emptyValue
        );
        if (result.changed) fieldChanges += 1;
        removedLanguages += result.removedLanguages;
      }
    }
  }

  return {
    fieldChanges,
    removedLanguages,
    translationMetaRemoved: pruneTranslationMeta(travelPlan, keepLangs)
  };
}

function shouldProcessBooking(booking, filterIds) {
  if (!(filterIds instanceof Set) || !filterIds.size) return true;
  return filterIds.has(String(booking?.id || ""));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const store = await readJson(options.storePath);
  const bookings = Array.isArray(store?.bookings) ? store.bookings : [];
  const summary = {
    bookingsScanned: 0,
    bookingsTouched: 0,
    offerFieldsPruned: 0,
    travelPlanFieldsPruned: 0,
    removedLanguageEntries: 0,
    translationMetaEntriesRemoved: 0
  };

  for (const booking of bookings) {
    if (!shouldProcessBooking(booking, options.bookingIds)) continue;
    summary.bookingsScanned += 1;
    const keepLangs = keepTargetLanguagesForBooking(booking);
    const offerResult = pruneOffer(booking.offer, keepLangs);
    const travelPlanResult = pruneTravelPlan(booking.travel_plan, keepLangs);
    const changed = Boolean(
      offerResult.fieldChanges
      || travelPlanResult.fieldChanges
      || offerResult.translationMetaRemoved
      || travelPlanResult.translationMetaRemoved
    );
    if (changed) {
      summary.bookingsTouched += 1;
      console.log(`${booking.id}: kept target languages ${keepLangs.join(", ")}`);
    }
    summary.offerFieldsPruned += offerResult.fieldChanges;
    summary.travelPlanFieldsPruned += travelPlanResult.fieldChanges;
    summary.removedLanguageEntries += offerResult.removedLanguages + travelPlanResult.removedLanguages;
    summary.translationMetaEntriesRemoved += offerResult.translationMetaRemoved + travelPlanResult.translationMetaRemoved;
  }

  if (options.write) {
    await writeFile(options.storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  }

  console.log("");
  console.log(`Store: ${options.storePath}`);
  console.log(`Mode: ${options.write ? "write" : "dry-run"}`);
  console.log(`Bookings scanned: ${summary.bookingsScanned}`);
  console.log(`Bookings touched: ${summary.bookingsTouched}`);
  console.log(`Offer fields pruned: ${summary.offerFieldsPruned}`);
  console.log(`Travel-plan fields pruned: ${summary.travelPlanFieldsPruned}`);
  console.log(`Removed language entries: ${summary.removedLanguageEntries}`);
  console.log(`Removed translation-meta entries: ${summary.translationMetaEntriesRemoved}`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
