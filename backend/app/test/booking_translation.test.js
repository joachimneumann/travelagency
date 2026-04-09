import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInvoiceTranslationStatus,
  buildOfferTranslationStatus,
  buildTravelPlanTranslationStatus,
  collectTravelPlanTranslationFieldChanges,
  markInvoiceTranslationManual,
  markOfferTranslationManual,
  markTravelPlanTranslationFieldsManual,
  markTravelPlanTranslationManual,
  translateTravelPlanFromSourceLanguage
} from "../src/domain/booking_translation.js";

test("offer translation status becomes stale after English source changes", () => {
  const offer = {
    components: [
      {
        id: "comp_1",
        details: "Airport pickup",
        details_i18n: { en: "Airport pickup" }
      }
    ]
  };

  markOfferTranslationManual(offer, "de", "2026-03-14T10:00:00.000Z");
  offer.components[0].details_i18n.de = "Flughafenabholung";

  const readyStatus = buildOfferTranslationStatus(offer, "de");
  assert.equal(readyStatus.status, "reviewed");
  assert.equal(readyStatus.missing_fields, 0);

  offer.components[0].details_i18n.en = "Private airport pickup";
  offer.components[0].details = "Private airport pickup";

  const staleStatus = buildOfferTranslationStatus(offer, "de");
  assert.equal(staleStatus.status, "stale");
  assert.equal(staleStatus.stale, true);
});

test("travel plan translation status counts customer-facing fields only", () => {
  const travelPlan = {
    days: [
      {
        id: "day_1",
        title: "Arrival in Hanoi",
        title_i18n: { en: "Arrival in Hanoi" },
        overnight_location: "Hanoi",
        overnight_location_i18n: { en: "Hanoi" },
        notes: "Easy evening walk in the old quarter.",
        notes_i18n: { en: "Easy evening walk in the old quarter." },
        services: [
          {
            id: "seg_1",
            timing_kind: "label",
            time_label: "Morning",
            time_label_i18n: { en: "Morning" },
            title: "Airport transfer",
            title_i18n: { en: "Airport transfer" },
            location: "Noi Bai Airport",
            location_i18n: { en: "Noi Bai Airport" },
            details: "Meet your driver and transfer to the hotel.",
            details_i18n: { en: "Meet your driver and transfer to the hotel." }
          }
        ]
      }
    ]
  };

  markTravelPlanTranslationManual(travelPlan, "fr", "2026-03-14T10:00:00.000Z");
  travelPlan.days[0].title_i18n.fr = "Arrivee a Hanoi";

  const status = buildTravelPlanTranslationStatus(travelPlan, "fr");
  assert.equal(status.total_fields, 7);
  assert.equal(status.translated_fields, 1);
  assert.equal(status.missing_fields, 6);
  assert.equal(status.status, "partial");
});

test("invoice translation status tracks title, notes, and component descriptions", () => {
  const invoice = {
    title: "Invoice for Joachim",
    title_i18n: { en: "Invoice for Joachim" },
    notes: "Please settle within seven days.",
    notes_i18n: { en: "Please settle within seven days." },
    components: [
      {
        id: "comp_1",
        description: "Airport pickup",
        description_i18n: { en: "Airport pickup" }
      }
    ]
  };

  markInvoiceTranslationManual(invoice, "ko", "2026-03-15T10:00:00.000Z");
  invoice.title_i18n.ko = "Joachim 님 청구서";
  invoice.notes_i18n.ko = "7일 이내에 결제해 주세요.";
  invoice.components[0].description_i18n.ko = "공항 픽업";

  const readyStatus = buildInvoiceTranslationStatus(invoice, "ko");
  assert.equal(readyStatus.total_fields, 3);
  assert.equal(readyStatus.translated_fields, 3);
  assert.equal(readyStatus.missing_fields, 0);
  assert.equal(readyStatus.status, "reviewed");
});

test("translation status uses the configured source language instead of assuming English", () => {
  const offer = {
    components: [
      {
        id: "comp_vi_1",
        details: "Don san bay rieng",
        details_i18n: {
          vi: "Don san bay rieng",
          de: "Privater Flughafentransfer"
        }
      }
    ]
  };

  markOfferTranslationManual(offer, "de", "2026-03-16T10:00:00.000Z", "vi");

  const sourceStatus = buildOfferTranslationStatus(offer, "vi", "vi");
  assert.equal(sourceStatus.status, "source");
  assert.equal(sourceStatus.source_lang, "vi");

  const targetStatus = buildOfferTranslationStatus(offer, "de", "vi");
  assert.equal(targetStatus.status, "reviewed");
  assert.equal(targetStatus.source_lang, "vi");

  offer.components[0].details_i18n.vi = "Don san bay VIP";
  offer.components[0].details = "Don san bay VIP";

  const staleStatus = buildOfferTranslationStatus(offer, "de", "vi");
  assert.equal(staleStatus.status, "stale");
  assert.equal(staleStatus.stale, true);
});

test("travel plan manual target edits are tracked per field", () => {
  const currentTravelPlan = {
    days: [
      {
        id: "day_1",
        title: "Arrival in Hanoi",
        title_i18n: {
          en: "Arrival in Hanoi",
          fr: "Arrivee a Hanoi"
        },
        overnight_location: "Hanoi",
        overnight_location_i18n: {
          en: "Hanoi",
          fr: "Hanoi"
        },
        services: [
          {
            id: "seg_1",
            timing_kind: "label",
            title: "Airport transfer",
            title_i18n: {
              en: "Airport transfer",
              fr: "Transfert aeroport"
            },
            details: "Meet your driver.",
            details_i18n: {
              en: "Meet your driver.",
              fr: "Rencontrez votre chauffeur."
            }
          }
        ]
      }
    ]
  };
  const nextTravelPlan = structuredClone(currentTravelPlan);
  nextTravelPlan.days[0].title_i18n.fr = "Arrivee privee a Hanoi";

  assert.deepEqual(
    collectTravelPlanTranslationFieldChanges(currentTravelPlan, nextTravelPlan, "fr"),
    ["travel_plan.day_1.title"]
  );
});

test("travel plan manual field locks survive future auto-translation", async () => {
  const travelPlan = {
    days: [
      {
        id: "day_1",
        title: "Arrival in Hanoi",
        title_i18n: {
          en: "Arrival in Hanoi",
          fr: "Arrivee a Hanoi"
        },
        overnight_location: "Hanoi",
        overnight_location_i18n: {
          en: "Hanoi",
          fr: "Hanoi"
        },
        notes: "Relax after check-in.",
        notes_i18n: {
          en: "Relax after check-in.",
          fr: "Detendez-vous apres l'enregistrement."
        },
        services: [
          {
            id: "seg_1",
            timing_kind: "label",
            time_label: "Morning",
            time_label_i18n: {
              en: "Morning",
              fr: "Matin"
            },
            title: "Airport transfer",
            title_i18n: {
              en: "Airport transfer",
              fr: "Transfert aeroport"
            },
            details: "Meet your driver and transfer to the hotel.",
            details_i18n: {
              en: "Meet your driver and transfer to the hotel.",
              fr: "Rencontrez votre chauffeur et transfert a l'hotel."
            },
            location: "Noi Bai Airport",
            location_i18n: {
              en: "Noi Bai Airport",
              fr: "Aeroport Noi Bai"
            }
          }
        ]
      }
    ]
  };

  markTravelPlanTranslationFieldsManual(
    travelPlan,
    "fr",
    "2026-03-17T10:00:00.000Z",
    ["travel_plan.day_1.title"]
  );
  travelPlan.days[0].title_i18n.fr = "Arrivee privee a Hanoi";

  const translated = await translateTravelPlanFromSourceLanguage(
    travelPlan,
    "en",
    "fr",
    async () => ({
      "travel_plan.day_1.title": "Titre machine",
      "travel_plan.day_1.overnight_location": "Hanoi machine",
      "travel_plan.day_1.notes": "Notes machine",
      "travel_plan.day_1.seg_1.time_label": "Matinee machine",
      "travel_plan.day_1.seg_1.title": "Transfert machine",
      "travel_plan.day_1.seg_1.details": "Details machine",
      "travel_plan.day_1.seg_1.location": "Lieu machine"
    }),
    "2026-03-17T12:00:00.000Z"
  );

  assert.equal(translated.days[0].title_i18n.fr, "Arrivee privee a Hanoi");
  assert.equal(translated.days[0].notes_i18n.fr, "Notes machine");
  assert.equal(translated.days[0].services[0].title_i18n.fr, "Transfert machine");
  assert.deepEqual(translated.translation_meta.fr.manual_keys, ["travel_plan.day_1.title"]);

  translated.days[0].title_i18n.en = "VIP arrival in Hanoi";
  translated.days[0].title = "VIP arrival in Hanoi";

  const status = buildTravelPlanTranslationStatus(translated, "fr");
  assert.equal(status.status, "reviewed");
  assert.equal(status.stale, false);
});
