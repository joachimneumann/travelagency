import { normalizeText } from "../lib/text.js";
import { extractTravelPlanPdfPersonalization } from "../lib/booking_pdf_personalization.js";
import { normalizeTourDestinationCode } from "./tour_catalog_i18n.js";

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

const DESTINATION_COUNTRY_CODE_BY_TOUR_CODE = Object.freeze({
  vietnam: "VN",
  thailand: "TH",
  cambodia: "KH",
  laos: "LA"
});

function normalizeCountryCodes(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => {
          const normalized = normalizeText(value);
          if (!normalized) return "";
          if (normalized.length === 2) return normalized.toUpperCase();
          const tourCode = normalizeTourDestinationCode(normalized);
          return DESTINATION_COUNTRY_CODE_BY_TOUR_CODE[tourCode] || normalized.toUpperCase();
        })
        .filter(Boolean)
    )
  );
}

function zeroOfferTotals() {
  return {
    net_amount_cents: 0,
    tax_amount_cents: 0,
    gross_amount_cents: 0,
    total_price_cents: 0,
    items_count: 0
  };
}

function zeroOfferQuotationSummary() {
  return {
    tax_included: true,
    subtotal_net_amount_cents: 0,
    total_tax_amount_cents: 0,
    grand_total_amount_cents: 0,
    tax_breakdown: []
  };
}

function zeroPricingSummary() {
  return {
    agreed_net_amount_cents: 0,
    adjustments_delta_cents: 0,
    adjusted_net_amount_cents: 0,
    scheduled_net_amount_cents: 0,
    unscheduled_net_amount_cents: 0,
    scheduled_tax_amount_cents: 0,
    scheduled_gross_amount_cents: 0,
    paid_gross_amount_cents: 0,
    outstanding_gross_amount_cents: 0,
    is_schedule_balanced: true
  };
}

function resolveCloneCurrency(booking) {
  return normalizeText(
    booking?.preferred_currency
    || booking?.pricing?.currency
    || booking?.offer?.currency
    || booking?.web_form_submission?.preferred_currency
  ) || "USD";
}

function resetSourceMetadata(booking, { sourceBookingId, nextName }) {
  const nextTravelPlanPdfPersonalization = extractTravelPlanPdfPersonalization(booking?.pdf_personalization);
  booking.source_channel = null;
  booking.referral_kind = null;
  booking.referral_label = null;
  booking.referral_staff_user_id = null;
  booking.number_of_travelers = null;
  booking.travel_start_day = null;
  booking.travel_end_day = null;
  booking.notes = "";
  if (nextTravelPlanPdfPersonalization?.travel_plan) {
    booking.pdf_personalization = nextTravelPlanPdfPersonalization;
  } else {
    delete booking.pdf_personalization;
  }

  booking.web_form_submission = {
    booking_name: normalizeText(nextName || booking?.name) || undefined,
    notes: `cloned from ${sourceBookingId}`
  };
}

function canonicalizeTravelPlanDestinations(booking) {
  const nextDestinations = normalizeCountryCodes(booking?.travel_plan?.destinations || booking?.destinations);
  const currentTravelPlan = booking?.travel_plan && typeof booking.travel_plan === "object" && !Array.isArray(booking.travel_plan)
    ? booking.travel_plan
    : {};
  booking.travel_plan = {
    ...currentTravelPlan,
    destinations: nextDestinations
  };
  delete booking.destinations;
}

function resetOffer(booking) {
  const offer = booking.offer && typeof booking.offer === "object" ? booking.offer : {};
  const currency = resolveCloneCurrency(booking);
  const internalDetailLevel = normalizeText(offer.offer_detail_level_internal).toLowerCase() === "day" ? "day" : "trip";
  const requestedVisibleDetailLevel = normalizeText(offer.offer_detail_level_visible).toLowerCase();
  const visibleDetailLevel = internalDetailLevel === "day" && requestedVisibleDetailLevel === "day"
    ? "day"
    : "trip";
  booking.offer = {
    status: "DRAFT",
    currency,
    offer_detail_level_internal: internalDetailLevel,
    offer_detail_level_visible: visibleDetailLevel,
    category_rules: Array.isArray(offer.category_rules) ? cloneJson(offer.category_rules) : [],
    additional_items: [],
    discounts: [],
    totals: zeroOfferTotals(),
    quotation_summary: zeroOfferQuotationSummary(),
    total_price_cents: 0
  };
}

function remapServiceImages(service, randomUUID) {
  if (!service || typeof service !== "object") return;

  if (service.image && typeof service.image === "object") {
    service.image = {
      ...service.image,
      id: `travel_plan_service_image_${randomUUID()}`
    };
  }

  if (Array.isArray(service.images)) {
    service.images = service.images.map((image) => ({
      ...image,
      id: `travel_plan_service_image_${randomUUID()}`
    }));
  }
}

function remapPersons(booking, bookingId) {
  const persons = Array.isArray(booking.persons) ? booking.persons : [];
  booking.persons = persons.map((person, index) => {
    const next = person && typeof person === "object" ? person : {};
    const personId = `${bookingId}_person_${index + 1}`;
    next.id = personId;
    if (Array.isArray(next.consents)) {
      next.consents = next.consents.map((consent, consentIndex) => ({
        ...consent,
        id: `${personId}_consent_${consentIndex + 1}`
      }));
    }
    if (Array.isArray(next.documents)) {
      next.documents = next.documents.map((document, documentIndex) => ({
        ...document,
        id: `${personId}_document_${documentIndex + 1}`
      }));
    }
    return next;
  });
}

function remapTravelPlan(booking, randomUUID) {
  const travelPlan = booking.travel_plan && typeof booking.travel_plan === "object" ? booking.travel_plan : null;
  if (!travelPlan) return;

  const serviceIdMap = new Map();

  if (Array.isArray(travelPlan.days)) {
    travelPlan.days = travelPlan.days.map((day) => {
      const nextDayId = `travel_plan_day_${randomUUID()}`;
      const services = (Array.isArray(day?.services) ? day.services : []).map((service) => {
        const oldServiceId = normalizeText(service?.id);
        const newServiceId = `travel_plan_service_${randomUUID()}`;
        if (oldServiceId) serviceIdMap.set(oldServiceId, newServiceId);
        return {
          ...service,
          id: newServiceId
        };
      });
      services.forEach((service) => remapServiceImages(service, randomUUID));
      return {
        ...day,
        id: nextDayId,
        services
      };
    });
  }

  if (Array.isArray(travelPlan.attachments)) {
    travelPlan.attachments = travelPlan.attachments.map((attachment) => ({
      ...attachment,
      id: `travel_plan_attachment_${randomUUID()}`
    }));
  }
}

function resetPricing(booking) {
  const pricing = booking.pricing && typeof booking.pricing === "object" ? booking.pricing : {};
  const currency = resolveCloneCurrency(booking);
  booking.pricing = {
    ...pricing,
    currency,
    agreed_net_amount_cents: 0,
    adjustments: [],
    payments: [],
    summary: zeroPricingSummary()
  };
}

function resetCommercialState(booking) {
  delete booking.confirmed_generated_offer_id;
  delete booking.accepted_generated_offer_id;
  delete booking.accepted_offer_artifact_ref;
  delete booking.accepted_travel_plan_artifact_ref;
  delete booking.proposal_sent_at;
  delete booking.proposal_sent_generated_offer_id;
  delete booking.proposal_sent_by_atp_staff_id;
  delete booking.accepted_deposit_amount_cents;
  delete booking.accepted_deposit_currency;
  delete booking.deposit_received_at;
  delete booking.deposit_confirmed_by_atp_staff_id;
  delete booking.accepted_deposit_reference;
  delete booking.deposit_receipt_draft_received_at;
  delete booking.deposit_receipt_draft_confirmed_by_atp_staff_id;
  delete booking.deposit_receipt_draft_reference;
  delete booking.accepted_offer_snapshot;
  delete booking.accepted_payment_terms_snapshot;
  delete booking.accepted_travel_plan_snapshot;

  booking.generated_offers = [];
}

function resetPortalState(booking) {
  delete booking.traveler_details_token_nonce;
  delete booking.traveler_details_token_created_at;
  delete booking.traveler_details_token_expires_at;
  delete booking.traveler_details_token_revoked_at;
  delete booking.public_traveler_details_token_nonce;
  delete booking.public_traveler_details_token_created_at;
  delete booking.public_traveler_details_token_expires_at;
  delete booking.public_traveler_details_token_revoked_at;
}

export function cloneBookingForTesting(sourceBooking, options = {}) {
  if (!sourceBooking || typeof sourceBooking !== "object" || Array.isArray(sourceBooking)) {
    throw new Error("A source booking object is required.");
  }

  const randomUUID = typeof options.randomUUID === "function" ? options.randomUUID : null;
  const nowIso = typeof options.nowIso === "function" ? options.nowIso : null;
  if (!randomUUID || !nowIso) {
    throw new Error("cloneBookingForTesting requires randomUUID and nowIso functions.");
  }

  const cloned = cloneJson(sourceBooking);
  const nextBookingId = `booking_${randomUUID()}`;
  const nextNow = nowIso();
  const nextName = normalizeText(options.name);
  const includeTravelers = options.includeTravelers === true;

  cloned.id = nextBookingId;
  if (nextName) {
    cloned.name = nextName;
  }

  cloned.core_revision = 0;
  cloned.notes_revision = 0;
  cloned.persons_revision = 0;
  cloned.travel_plan_revision = 0;
  cloned.pricing_revision = 0;
  cloned.offer_revision = 0;
  cloned.invoices_revision = 0;
  cloned.idempotency_key = null;
  cloned.created_at = nextNow;
  cloned.updated_at = nextNow;
  cloned.last_action = null;
  cloned.last_action_at = null;
  cloned.milestones = {};
  cloned.service_level_agreement_due_at = null;
  cloned.assigned_keycloak_user_id = null;
  cloned.stage = "NEW_BOOKING";
  cloned.preferred_currency = resolveCloneCurrency(cloned);
  canonicalizeTravelPlanDestinations(cloned);

  resetSourceMetadata(cloned, {
    sourceBookingId: normalizeText(sourceBooking.id) || "unknown booking",
    nextName: nextName || cloned.name
  });
  if (includeTravelers) {
    remapPersons(cloned, nextBookingId);
  } else {
    cloned.persons = [];
  }
  resetOffer(cloned);
  remapTravelPlan(cloned, randomUUID);
  resetPricing(cloned);
  resetCommercialState(cloned);
  resetPortalState(cloned);

  delete cloned.__clone_payment_term_line_id_map;

  return cloned;
}
