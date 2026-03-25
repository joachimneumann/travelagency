import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInvoiceTranslationStatus,
  buildOfferTranslationStatus,
  buildTravelPlanTranslationStatus,
  markInvoiceTranslationManual,
  markOfferTranslationManual,
  markTravelPlanTranslationManual
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
            details_i18n: { en: "Meet your driver and transfer to the hotel." },
            financial_note: "internal only",
            financial_note_i18n: { en: "internal only" }
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
