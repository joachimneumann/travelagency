import { normalizeText } from "../lib/text.js";

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function resetStoredFileArtifacts(booking) {
  if (!booking || typeof booking !== "object") return;
  delete booking.image;

  if (Array.isArray(booking.persons)) {
    for (const person of booking.persons) {
      if (!person || typeof person !== "object") continue;
      delete person.photo_ref;
      if (Array.isArray(person.documents)) {
        for (const document of person.documents) {
          if (!document || typeof document !== "object") continue;
          delete document.document_picture_ref;
        }
      }
    }
  }

  const travelPlan = booking.travel_plan && typeof booking.travel_plan === "object" ? booking.travel_plan : null;
  if (!travelPlan) return;

  if (Array.isArray(travelPlan.days)) {
    for (const day of travelPlan.days) {
      const services = Array.isArray(day?.services) ? day.services : [];
      for (const service of services) {
        if (!service || typeof service !== "object") continue;
        service.image = null;
        delete service.images;
      }
    }
  }

  travelPlan.attachments = [];
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

function remapOffer(booking, randomUUID) {
  const offer = booking.offer && typeof booking.offer === "object" ? booking.offer : null;
  if (!offer) return new Map();

  const componentIdMap = new Map();
  if (Array.isArray(offer.components)) {
    offer.components = offer.components.map((component) => {
      const oldId = normalizeText(component?.id);
      const newId = `offer_component_${randomUUID()}`;
      if (oldId) componentIdMap.set(oldId, newId);
      return {
        ...component,
        id: newId
      };
    });
  }

  if (Array.isArray(offer.days_internal)) {
    offer.days_internal = offer.days_internal.map((dayPrice) => ({
      ...dayPrice,
      id: `offer_day_internal_${randomUUID()}`
    }));
  }

  if (Array.isArray(offer.additional_items)) {
    offer.additional_items = offer.additional_items.map((item) => ({
      ...item,
      id: `offer_additional_item_${randomUUID()}`
    }));
  }

  if (offer.payment_terms && typeof offer.payment_terms === "object" && Array.isArray(offer.payment_terms.lines)) {
    const paymentTermLineIdMap = new Map();
    offer.payment_terms.lines = offer.payment_terms.lines.map((line) => {
      const oldId = normalizeText(line?.id);
      const newId = `offer_payment_term_${randomUUID()}`;
      if (oldId) paymentTermLineIdMap.set(oldId, newId);
      return {
        ...line,
        id: newId
      };
    });
    booking.__clone_payment_term_line_id_map = paymentTermLineIdMap;
  }

  offer.status = "DRAFT";
  return componentIdMap;
}

function remapTravelPlan(booking, componentIdMap, randomUUID) {
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
          id: newServiceId,
          image: null
        };
      });
      return {
        ...day,
        id: nextDayId,
        services
      };
    });
  }

  travelPlan.offer_component_links = (Array.isArray(travelPlan.offer_component_links) ? travelPlan.offer_component_links : [])
    .map((link) => {
      const newServiceId = serviceIdMap.get(normalizeText(link?.travel_plan_service_id));
      const newOfferComponentId = componentIdMap.get(normalizeText(link?.offer_component_id));
      if (!newServiceId || !newOfferComponentId) return null;
      return {
        ...link,
        id: `travel_plan_offer_link_${randomUUID()}`,
        travel_plan_service_id: newServiceId,
        offer_component_id: newOfferComponentId
      };
    })
    .filter(Boolean);

  travelPlan.attachments = [];
}

function remapPricing(booking, randomUUID) {
  const pricing = booking.pricing && typeof booking.pricing === "object" ? booking.pricing : null;
  if (!pricing) return;

  pricing.adjustments = (Array.isArray(pricing.adjustments) ? pricing.adjustments : []).map((adjustment) => ({
    ...adjustment,
    id: `pricing_adjustment_${randomUUID()}`
  }));

  pricing.payments = (Array.isArray(pricing.payments) ? pricing.payments : []).map((payment) => ({
    ...payment,
    id: `pricing_payment_${randomUUID()}`,
    status: "PENDING",
    paid_at: null
  }));
}

function resetCommercialState(booking) {
  delete booking.confirmed_generated_offer_id;
  delete booking.accepted_generated_offer_id;
  delete booking.deposit_received_at;
  delete booking.deposit_confirmed_by_atp_staff_id;
  delete booking.accepted_deposit_reference;
  delete booking.deposit_receipt_draft_received_at;
  delete booking.deposit_receipt_draft_confirmed_by_atp_staff_id;
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
  const keepAssignment = options.keepAssignment === true;
  const keepStage = options.keepStage === true;

  cloned.id = nextBookingId;
  if (nextName) {
    cloned.name = nextName;
    if (cloned.web_form_submission && typeof cloned.web_form_submission === "object") {
      cloned.web_form_submission.booking_name = nextName;
    }
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

  if (!keepAssignment) {
    cloned.assigned_keycloak_user_id = null;
  }
  if (!keepStage) {
    cloned.stage = "NEW_BOOKING";
  }

  remapPersons(cloned, nextBookingId);
  const componentIdMap = remapOffer(cloned, randomUUID);
  remapTravelPlan(cloned, componentIdMap, randomUUID);
  remapPricing(cloned, randomUUID);
  resetCommercialState(cloned);
  resetPortalState(cloned);
  resetStoredFileArtifacts(cloned);

  delete cloned.__clone_payment_term_line_id_map;

  return cloned;
}
