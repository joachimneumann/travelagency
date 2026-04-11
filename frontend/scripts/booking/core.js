import {
  bookingCustomerLanguageRequest,
  bookingDeleteRequest,
  bookingImageRequest,
  bookingMilestoneActionRequest,
  bookingNameRequest,
  bookingNotesRequest,
  bookingOwnerRequest,
  bookingSourceRequest,
  tourDetailRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import {
  buildBookingSectionHeadMarkup,
  initializeBookingSections
} from "./sections.js";
import {
  mergeDualLocalizedPayload,
  normalizeLocalizedEditorMap,
  renderLocalizedStackedField,
  resolveLocalizedEditorBranchText
} from "./localized_editor.js";
import {
  BOOKING_PDF_PERSONALIZATION_PANELS,
  getBookingPdfPersonalizationItemConfig
} from "./pdf_personalization_panel.js";
import {
  bookingContentLang,
  bookingContentLanguageLabel,
  bookingSourceLang,
  bookingT,
  normalizeBookingContentLang
} from "./i18n.js";
import {
  COUNTRY_CODE_OPTIONS,
  TOUR_STYLE_CODE_OPTIONS
} from "../shared/generated_catalogs.js";

function labelizeKey(key) {
  return String(key || "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function webFormFieldLabel(key) {
  return bookingT(`booking.web_form.${key}`, labelizeKey(key));
}

const BOOKING_MILESTONE_ACTIONS = Object.freeze([
  Object.freeze({
    key: "NEW_BOOKING",
    field: "new_booking_at",
    stage: "NEW_BOOKING",
    labelKey: "booking.milestone.action.new_booking",
    labelFallback: "New booking"
  }),
  Object.freeze({
    key: "TRAVEL_PLAN_SENT",
    field: "travel_plan_sent_at",
    stage: "TRAVEL_PLAN_SENT",
    labelKey: "booking.milestone.action.travel_plan_sent",
    labelFallback: "Travel plan sent"
  }),
  Object.freeze({
    key: "OFFER_SENT",
    field: "offer_sent_at",
    stage: "OFFER_SENT",
    labelKey: "booking.milestone.action.offer_sent",
    labelFallback: "Offer sent"
  }),
  Object.freeze({
    key: "NEGOTIATION_STARTED",
    field: "negotiation_started_at",
    stage: "NEGOTIATION_STARTED",
    labelKey: "booking.milestone.action.negotiation_started",
    labelFallback: "Negotiation"
  }),
  Object.freeze({
    key: "DEPOSIT_REQUEST_SENT",
    field: "deposit_request_sent_at",
    stage: "DEPOSIT_REQUEST_SENT",
    labelKey: "booking.milestone.action.deposit_request_sent",
    labelFallback: "Deposit requested"
  }),
  Object.freeze({
    key: "DEPOSIT_RECEIVED",
    field: "deposit_received_at",
    stage: "IN_PROGRESS",
    labelKey: "booking.milestone.action.deposit_received",
    labelFallback: "Deposit received",
    hiddenFromStageControls: true
  }),
  Object.freeze({
    key: "IN_PROGRESS",
    field: null,
    stage: "IN_PROGRESS",
    labelKey: "booking.milestone.action.in_progress",
    labelFallback: "In progress"
  }),
  Object.freeze({
    key: "BOOKING_LOST",
    field: "booking_lost_at",
    stage: "LOST",
    labelKey: "booking.milestone.action.booking_lost",
    labelFallback: "Booking lost"
  }),
  Object.freeze({
    key: "TRIP_COMPLETED",
    field: "trip_completed_at",
    stage: "TRIP_COMPLETED",
    labelKey: "booking.milestone.action.trip_completed",
    labelFallback: "Trip completed"
  })
]);

const BOOKING_MILESTONE_ACTION_BY_KEY = Object.freeze(
  Object.fromEntries(BOOKING_MILESTONE_ACTIONS.map((action) => [action.key, action]))
);

const BOOKING_STAGE_FALLBACKS = Object.freeze({
  NEW_BOOKING: Object.freeze({
    currentActionKey: "NEW_BOOKING"
  }),
  TRAVEL_PLAN_SENT: Object.freeze({
    currentActionKey: "TRAVEL_PLAN_SENT"
  }),
  OFFER_SENT: Object.freeze({
    currentActionKey: "OFFER_SENT"
  }),
  NEGOTIATION_STARTED: Object.freeze({
    currentActionKey: "NEGOTIATION_STARTED"
  }),
  DEPOSIT_REQUEST_SENT: Object.freeze({
    currentActionKey: "DEPOSIT_REQUEST_SENT"
  }),
  IN_PROGRESS: Object.freeze({
    currentActionKey: "IN_PROGRESS"
  }),
  LOST: Object.freeze({
    currentActionKey: "BOOKING_LOST"
  }),
  TRIP_COMPLETED: Object.freeze({
    currentActionKey: "TRIP_COMPLETED"
  })
});

const BOOKING_SOURCE_CHANNEL_OPTIONS = Object.freeze([
  Object.freeze({ value: "other", labelKey: "booking.source_channel.option.other", labelFallback: "Other" }),
  Object.freeze({ value: "website", labelKey: "booking.source_channel.option.website", labelFallback: "Website" }),
  Object.freeze({ value: "email", labelKey: "booking.source_channel.option.email", labelFallback: "Email" }),
  Object.freeze({ value: "whatsapp", labelKey: "booking.source_channel.option.whatsapp", labelFallback: "WhatsApp" }),
  Object.freeze({ value: "facebook_messenger", labelKey: "booking.source_channel.option.facebook_messenger", labelFallback: "Facebook Messenger" }),
  Object.freeze({ value: "google_maps", labelKey: "booking.source_channel.option.google_maps", labelFallback: "Google Maps" }),
  Object.freeze({ value: "instagram", labelKey: "booking.source_channel.option.instagram", labelFallback: "Instagram" }),
  Object.freeze({ value: "phone_call", labelKey: "booking.source_channel.option.phone_call", labelFallback: "Phone call" }),
  Object.freeze({ value: "walk_in", labelKey: "booking.source_channel.option.walk_in", labelFallback: "Walk-in" }),
  Object.freeze({ value: "zalo", labelKey: "booking.source_channel.option.zalo", labelFallback: "Zalo" })
]);

const BOOKING_REFERRAL_KIND_OPTIONS = Object.freeze([
  Object.freeze({ value: "none", labelKey: "booking.referral.kind.none", labelFallback: "No referral" }),
  Object.freeze({ value: "other_customer", labelKey: "booking.referral.kind.other_customer", labelFallback: "Other customer" }),
  Object.freeze({ value: "b2b_partner", labelKey: "booking.referral.kind.b2b_partner", labelFallback: "B2B partner" }),
  Object.freeze({ value: "atp_staff", labelKey: "booking.referral.kind.atp_staff", labelFallback: "ATP staff" })
]);

const REFERRAL_MODE_CONFIG = Object.freeze({
  other_customer: Object.freeze({
    kind: "text",
    labelKey: "booking.referral.customer_name",
    labelFallback: "Customer name",
    controlId: "booking_referral_label_input"
  }),
  b2b_partner: Object.freeze({
    kind: "text",
    labelKey: "booking.referral.partner_name",
    labelFallback: "B2B partner name",
    controlId: "booking_referral_label_input"
  }),
  atp_staff: Object.freeze({
    kind: "select",
    labelKey: "booking.referral.staff_label",
    labelFallback: "ATP staff",
    controlId: "booking_referral_staff_select"
  })
});

const COUNTRY_LABEL_BY_CODE = new Map(
  COUNTRY_CODE_OPTIONS.map((option) => [
    String(option.value || "").trim().toUpperCase(),
    String(option.label || option.value || "").trim().replace(/^[A-Z]{2}\s+/, "")
  ])
);

const TOUR_DESTINATION_OPTIONS = Object.freeze([
  Object.freeze({ value: "VN", label: "Vietnam", aliases: ["vietnam", "vn"] }),
  Object.freeze({ value: "TH", label: "Thailand", aliases: ["thailand", "th"] }),
  Object.freeze({ value: "KH", label: "Cambodia", aliases: ["cambodia", "kh"] }),
  Object.freeze({ value: "LA", label: "Laos", aliases: ["laos", "la"] })
]);

const TOUR_DESTINATION_LABEL_BY_CODE = new Map(
  TOUR_DESTINATION_OPTIONS.map((option) => [option.value, option.label])
);

const TOUR_DESTINATION_VALUE_BY_ALIAS = new Map(
  TOUR_DESTINATION_OPTIONS.flatMap((option) => [
    [option.value.toLowerCase(), option.value],
    [option.label.toLowerCase(), option.value],
    ...option.aliases.map((alias) => [normalizeTextValue(alias).toLowerCase(), option.value])
  ])
);

const TRAVEL_STYLE_LABEL_BY_VALUE = new Map(
  TOUR_STYLE_CODE_OPTIONS.map((option) => [
    String(option.value || "").trim().toLowerCase(),
    String(option.label || option.value || "").trim()
  ])
);

function normalizeTextValue(value) {
  return String(value || "").trim();
}

function unique(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
}

function normalizeCodeArray(values) {
  return unique((Array.isArray(values) ? values : [])
    .map((value) => TOUR_DESTINATION_VALUE_BY_ALIAS.get(normalizeTextValue(value).toLowerCase()) || normalizeTextValue(value).toUpperCase())
    .filter(Boolean))
    .filter((value) => TOUR_DESTINATION_LABEL_BY_CODE.has(value))
    .sort((left, right) => (TOUR_DESTINATION_LABEL_BY_CODE.get(left) || left).localeCompare(TOUR_DESTINATION_LABEL_BY_CODE.get(right) || right));
}

function normalizeTravelStyleArray(values) {
  const labelToValue = new Map(
    TOUR_STYLE_CODE_OPTIONS.flatMap((option) => {
      const value = normalizeTextValue(option.value).toLowerCase();
      const label = normalizeTextValue(option.label).toLowerCase();
      return [
        [value, value],
        [label, value]
      ];
    })
  );
  return unique((Array.isArray(values) ? values : [])
    .map((value) => labelToValue.get(normalizeTextValue(value).toLowerCase()) || normalizeTextValue(value).toLowerCase())
    .filter(Boolean))
    .sort((left, right) => (TRAVEL_STYLE_LABEL_BY_VALUE.get(left) || left).localeCompare(TRAVEL_STYLE_LABEL_BY_VALUE.get(right) || right));
}

function destinationLabels(values) {
  return normalizeCodeArray(values).map((code) => TOUR_DESTINATION_LABEL_BY_CODE.get(code) || COUNTRY_LABEL_BY_CODE.get(code) || code);
}

function travelStyleLabels(values) {
  return normalizeTravelStyleArray(values).map((value) => TRAVEL_STYLE_LABEL_BY_VALUE.get(value) || value);
}

function bookingDestinations(booking) {
  return normalizeCodeArray(booking?.travel_plan?.destinations);
}

function normalizePdfTextField(value, mapValue) {
  const normalizedMap = normalizeLocalizedEditorMap(mapValue ?? value, "en");
  return {
    text: resolveLocalizedEditorBranchText(normalizedMap, "en", ""),
    i18n: normalizedMap
  };
}

const OFFER_CANCELLATION_POLICY_SECTIONS = Object.freeze([
  Object.freeze({
    minTravelers: 1,
    maxTravelers: 10,
    heading: "For 1-10 travellers:",
    lines: Object.freeze([
      "If cancellation is made 14 days prior to travel date, no cancellation fee will be charged.",
      "If cancellation is made 7-14 days prior to travel date, 30% of total fee will be charged.",
      "If cancellation is made 0-7 days prior to travel date, 50% of total fee will be charged."
    ])
  }),
  Object.freeze({
    minTravelers: 11,
    maxTravelers: 20,
    heading: "For 11-20 travellers:",
    lines: Object.freeze([
      "If cancellation is made 21 days prior to travel date, no cancellation fee will be charged.",
      "If cancellation is made 10-21 days prior to travel date, 30% of total fee will be charged.",
      "If cancellation is made 0-10 days prior to travel date, 50% of total fee will be charged."
    ])
  }),
  Object.freeze({
    minTravelers: 21,
    maxTravelers: Infinity,
    heading: "For 21 travellers or above:",
    lines: Object.freeze([
      "If cancellation is made 30 days prior to travel date, no cancellation fee will be charged.",
      "If cancellation is made 15-30 days prior to travel date, 30% of total fee will be charged.",
      "If cancellation is made 0-15 days prior to travel date, 50% of total fee will be charged."
    ])
  })
]);

function offerCancellationPolicyHeadingLabel(section) {
  return String(section?.heading || "")
    .replace(/^For\s+/u, "")
    .replace(/:\s*$/u, "");
}

function hasNormalizedPdfTextContent(fieldValue) {
  if (!fieldValue || typeof fieldValue !== "object") return false;
  if (String(fieldValue.text || "").trim()) return true;
  return Object.keys(fieldValue.i18n || {}).length > 0;
}

function resolvePdfTextFieldEnabled(branch, scope, field, normalizedField) {
  const config = getBookingPdfPersonalizationItemConfig(scope, field);
  if (!config?.includeField) return true;
  const explicitValue = branch?.[config.includeField];
  if (typeof explicitValue === "boolean") return explicitValue;
  if (config.enableWhenTextPresent && hasNormalizedPdfTextContent(normalizedField)) return true;
  return config.defaultChecked === true;
}

function normalizePdfPersonalization(value) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const travelPlan = raw.travel_plan && typeof raw.travel_plan === "object" && !Array.isArray(raw.travel_plan) ? raw.travel_plan : {};
  const offer = raw.offer && typeof raw.offer === "object" && !Array.isArray(raw.offer) ? raw.offer : {};
  const bookingConfirmation = raw.booking_confirmation && typeof raw.booking_confirmation === "object" && !Array.isArray(raw.booking_confirmation)
    ? raw.booking_confirmation
    : {};
  const travelPlanSubtitle = normalizePdfTextField(travelPlan.subtitle, travelPlan.subtitle_i18n);
  const travelPlanWelcome = normalizePdfTextField(travelPlan.welcome, travelPlan.welcome_i18n);
  const travelPlanChildrenPolicy = normalizePdfTextField(travelPlan.children_policy, travelPlan.children_policy_i18n);
  const travelPlanWhatsNotIncluded = normalizePdfTextField(travelPlan.whats_not_included, travelPlan.whats_not_included_i18n);
  const travelPlanClosing = normalizePdfTextField(travelPlan.closing, travelPlan.closing_i18n);
  const offerSubtitle = normalizePdfTextField(offer.subtitle, offer.subtitle_i18n);
  const offerWelcome = normalizePdfTextField(offer.welcome, offer.welcome_i18n);
  const offerChildrenPolicy = normalizePdfTextField(offer.children_policy, offer.children_policy_i18n);
  const offerWhatsNotIncluded = normalizePdfTextField(offer.whats_not_included, offer.whats_not_included_i18n);
  const offerClosing = normalizePdfTextField(offer.closing, offer.closing_i18n);
  const bookingConfirmationSubtitle = normalizePdfTextField(bookingConfirmation.subtitle, bookingConfirmation.subtitle_i18n);
  const bookingConfirmationWelcome = normalizePdfTextField(bookingConfirmation.welcome, bookingConfirmation.welcome_i18n);
  const bookingConfirmationClosing = normalizePdfTextField(bookingConfirmation.closing, bookingConfirmation.closing_i18n);
  return {
    ...raw,
    travel_plan: {
      subtitle: travelPlanSubtitle.text,
      subtitle_i18n: travelPlanSubtitle.i18n,
      include_subtitle: resolvePdfTextFieldEnabled(travelPlan, "travel_plan", "subtitle", travelPlanSubtitle),
      welcome: travelPlanWelcome.text,
      welcome_i18n: travelPlanWelcome.i18n,
      include_welcome: resolvePdfTextFieldEnabled(travelPlan, "travel_plan", "welcome", travelPlanWelcome),
      children_policy: travelPlanChildrenPolicy.text,
      children_policy_i18n: travelPlanChildrenPolicy.i18n,
      include_children_policy: resolvePdfTextFieldEnabled(travelPlan, "travel_plan", "children_policy", travelPlanChildrenPolicy),
      whats_not_included: travelPlanWhatsNotIncluded.text,
      whats_not_included_i18n: travelPlanWhatsNotIncluded.i18n,
      include_whats_not_included: resolvePdfTextFieldEnabled(travelPlan, "travel_plan", "whats_not_included", travelPlanWhatsNotIncluded),
      closing: travelPlanClosing.text,
      closing_i18n: travelPlanClosing.i18n,
      include_closing: resolvePdfTextFieldEnabled(travelPlan, "travel_plan", "closing", travelPlanClosing),
      include_who_is_traveling: travelPlan.include_who_is_traveling === true
    },
    offer: {
      subtitle: offerSubtitle.text,
      subtitle_i18n: offerSubtitle.i18n,
      include_subtitle: resolvePdfTextFieldEnabled(offer, "offer", "subtitle", offerSubtitle),
      welcome: offerWelcome.text,
      welcome_i18n: offerWelcome.i18n,
      include_welcome: resolvePdfTextFieldEnabled(offer, "offer", "welcome", offerWelcome),
      children_policy: offerChildrenPolicy.text,
      children_policy_i18n: offerChildrenPolicy.i18n,
      include_children_policy: resolvePdfTextFieldEnabled(offer, "offer", "children_policy", offerChildrenPolicy),
      whats_not_included: offerWhatsNotIncluded.text,
      whats_not_included_i18n: offerWhatsNotIncluded.i18n,
      include_whats_not_included: resolvePdfTextFieldEnabled(offer, "offer", "whats_not_included", offerWhatsNotIncluded),
      closing: offerClosing.text,
      closing_i18n: offerClosing.i18n,
      include_closing: resolvePdfTextFieldEnabled(offer, "offer", "closing", offerClosing),
      include_cancellation_policy: offer.include_cancellation_policy !== false,
      include_who_is_traveling: offer.include_who_is_traveling !== false
    },
    booking_confirmation: {
      subtitle: bookingConfirmationSubtitle.text,
      subtitle_i18n: bookingConfirmationSubtitle.i18n,
      include_subtitle: resolvePdfTextFieldEnabled(bookingConfirmation, "booking_confirmation", "subtitle", bookingConfirmationSubtitle),
      welcome: bookingConfirmationWelcome.text,
      welcome_i18n: bookingConfirmationWelcome.i18n,
      include_welcome: resolvePdfTextFieldEnabled(bookingConfirmation, "booking_confirmation", "welcome", bookingConfirmationWelcome),
      closing: bookingConfirmationClosing.text,
      closing_i18n: bookingConfirmationClosing.i18n,
      include_closing: resolvePdfTextFieldEnabled(bookingConfirmation, "booking_confirmation", "closing", bookingConfirmationClosing)
    }
  };
}

export function createBookingCoreModule(ctx) {
  const {
    state,
    els,
    apiBase,
    apiOrigin,
    fetchApi,
    fetchBookingMutation,
    getBookingRevision,
    getRepresentativeTraveler,
    getPersonInitials,
    normalizeText,
    escapeHtml,
    formatDateTime,
    updateContentLangInUrl,
    setPendingSavedCustomerLanguage,
    resolveApiUrl,
    resolvePersonPhotoSrc,
    resolveBookingImageSrc,
    displayKeycloakUser,
    resolveCurrentAuthKeycloakUser,
    canReadAllBookingsInUi,
    setBookingSectionDirty,
    hasUnsavedBookingChanges,
    reportPersistedActionBlocked,
    setStatus,
    rerenderWhatsApp,
    renderPersonsEditor
  } = ctx;

  let heroCopyClipboardPoll = null;
  let heroCopiedValue = "";
  let titleEditStartValue = "";
  const DISCOVERY_CALL_FALLBACK_IMAGE = "assets/img/happy_tourists.webp";

  function withBackendLang(pathname, params = {}) {
    const url = new URL(pathname, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
    const lang = typeof window.backendI18n?.getLang === "function"
      ? window.backendI18n.getLang()
      : String(new URLSearchParams(window.location.search).get("lang") || "").trim();
    if (lang) url.searchParams.set("lang", lang);
    return `${url.pathname}${url.search}`;
  }

  function closeBookingDetailScreen() {
    if (hasUnsavedBookingChanges?.() && !window.confirm(bookingT("booking.discard_navigation_confirm", "Discard unsaved edits and leave this page?"))) {
      return;
    }
    const fallbackHref = normalizeText(els.back?.href) || withBackendLang("/bookings.html", { section: "bookings" });
    window.location.href = fallbackHref;
  }

  function cloneStatus(message) {
    if (els.cloneStatus instanceof HTMLElement) {
      els.cloneStatus.textContent = message || "";
    }
  }

  function defaultCloneTitle(booking = state.booking) {
    const base = normalizeText(booking?.name) || normalizeText(booking?.id) || bookingT("booking.booking", "Booking");
    return bookingT("booking.clone_title_default", "{name} Copy", { name: base });
  }

  function syncCloneTitleInput({ force = false } = {}) {
    if (!(els.cloneTitleInput instanceof HTMLInputElement)) return;
    const nextDefault = defaultCloneTitle(state.booking);
    const previousDefault = normalizeText(els.cloneTitleInput.dataset.defaultValue);
    const currentValue = normalizeText(els.cloneTitleInput.value);
    const userEdited = els.cloneTitleInput.dataset.userEdited === "true";
    if (force || !userEdited || !currentValue || currentValue === previousDefault) {
      els.cloneTitleInput.value = nextDefault;
      els.cloneTitleInput.dataset.userEdited = "false";
    }
    els.cloneTitleInput.dataset.defaultValue = nextDefault;
    els.cloneTitleInput.placeholder = nextDefault;
  }

  function ensureCoreDraft() {
    if (!state.coreDraft || typeof state.coreDraft !== "object") {
      state.coreDraft = {
        name: "",
        assigned_keycloak_user_id: "",
        customer_language: "en",
        source_channel: "other",
        referral_kind: "none",
        referral_label: "",
        referral_staff_user_id: "",
        milestone_action_key: "",
        destinations: [],
        travel_styles: [],
        pdf_personalization: normalizePdfPersonalization(),
        notes: ""
      };
    }
    return state.coreDraft;
  }

  function savedCustomerLanguage(booking = state.booking) {
    return normalizeBookingContentLang(
      booking?.customer_language
      || booking?.web_form_submission?.preferred_language
      || "en"
    );
  }

  function savedMilestoneActionKey(booking = state.booking) {
    return resolveStatusPresentation(booking).currentActionKey;
  }

  function computedPdfDayCount(booking = state.booking) {
    const planDays = Array.isArray(booking?.travel_plan?.days) ? booking.travel_plan.days.length : 0;
    if (planDays > 0) return planDays;
    const exactDays = Number.parseInt(booking?.web_form_submission?.travel_duration_days_max || booking?.web_form_submission?.travel_duration_days_min, 10);
    return Number.isInteger(exactDays) && exactDays > 0 ? exactDays : 0;
  }

  function computedPdfCountryLabel(booking = state.booking) {
    const draft = ensureCoreDraft();
    const labels = destinationLabels(Array.isArray(draft.destinations) && draft.destinations.length ? draft.destinations : bookingDestinations(booking));
    return labels.join(", ");
  }

  function computedPdfTravelStyleLabel(booking = state.booking) {
    const draft = ensureCoreDraft();
    const labels = travelStyleLabels(Array.isArray(draft.travel_styles) && draft.travel_styles.length ? draft.travel_styles : booking?.travel_styles);
    return labels.join(", ");
  }

  function computedPdfSubtitlePlaceholder(booking = state.booking) {
    const dayCount = computedPdfDayCount(booking);
    const countryLabel = computedPdfCountryLabel(booking);
    if (dayCount > 0 && countryLabel) {
      return bookingT("booking.pdf.default_subtitle_days_countries", "{count} days in {countries}", {
        count: dayCount,
        countries: countryLabel
      });
    }
    if (countryLabel) return countryLabel;
    if (dayCount > 0) {
      return bookingT("booking.pdf.default_subtitle_days", "{count} days", { count: dayCount });
    }
    return "";
  }

  function computedTravelPlanWelcomePlaceholder(booking = state.booking) {
    const styleLabel = computedPdfTravelStyleLabel(booking);
    if (styleLabel) {
      return bookingT(
        "booking.pdf.travel_plan.default_welcome_styles",
        "This is your current {styles} travel plan. Please let us know if you would like to modify anything.",
        { styles: styleLabel }
      );
    }
    return bookingT(
      "booking.pdf.travel_plan.default_welcome",
      "This is your current travel plan. Please let us know if you would like to modify anything."
    );
  }

  function computedOfferWelcomePlaceholder(booking = state.booking) {
    const styleLabel = computedPdfTravelStyleLabel(booking);
    if (styleLabel) {
      return bookingT(
        "booking.pdf.offer.default_welcome_styles",
        "This offer is based on your current {styles} itinerary. Please let us know if you would like to adjust anything.",
        { styles: styleLabel }
      );
    }
    return bookingT(
      "booking.pdf.offer.default_welcome",
      "This is your current offer. Please let us know if you would like to adjust anything."
    );
  }

  function computedClosingPlaceholder() {
    return bookingT("booking.pdf.default_closing", "We would be happy to hear from you.");
  }

  function renderCheckboxOptions(container, values, selectedValues, dataAttr, disabled, formatter) {
    if (!(container instanceof HTMLElement)) return;
    const selected = new Set(selectedValues);
    container.innerHTML = values.map((value) => {
      const checked = selected.has(value);
      const label = formatter(value);
      return `
        <label class="booking-multiselect__option">
          <input type="checkbox" data-${dataAttr}="${escapeHtml(value)}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} />
          <span>${escapeHtml(label)}</span>
        </label>
      `;
    }).join("");
  }

  function updateMultiselectSummary(summaryEl, labels, emptyLabel) {
    if (!(summaryEl instanceof HTMLElement)) return;
    summaryEl.textContent = labels.length ? labels.join(", ") : emptyLabel;
    summaryEl.classList.toggle("is-empty", labels.length === 0);
  }

  function readCheckedValues(container, dataAttr) {
    if (!(container instanceof HTMLElement)) return [];
    return Array.from(container.querySelectorAll(`input[type="checkbox"][data-${dataAttr}]`))
      .filter((input) => input instanceof HTMLInputElement && input.checked)
      .map((input) => String(input.getAttribute(`data-${dataAttr}`) || "").trim())
      .filter(Boolean);
  }

  function readLocalizedBookingPdfField(scope, field, existingValue) {
    if (typeof document === "undefined" || !(document.querySelector instanceof Function)) {
      return normalizePdfTextField(existingValue, existingValue?.i18n || existingValue);
    }
    const sourceInput = document.querySelector(`[data-booking-pdf-field="${scope}.${field}"][data-localized-role="source"]`);
    const targetInput = document.querySelector(`[data-booking-pdf-field="${scope}.${field}"][data-localized-role="target"]`);
    const sourceValue = String(sourceInput?.value || "").trim();
    const localizedValue = String(targetInput?.value || "").trim();
    const payload = mergeDualLocalizedPayload(
      existingValue?.i18n ?? existingValue,
      sourceValue,
      localizedValue
    );
    return {
      text: payload.text,
      i18n: payload.map
    };
  }

  function readBookingPdfToggle(toggleKey) {
    if (typeof document === "undefined" || !(document.querySelector instanceof Function)) return undefined;
    const input = document.querySelector(`[data-booking-pdf-toggle="${toggleKey}"]`);
    return input instanceof HTMLInputElement ? input.checked : undefined;
  }

  function buildPdfPersonalizationBranchDraft(scope, existingBranch = {}) {
    const panelConfig = BOOKING_PDF_PERSONALIZATION_PANELS.find((panel) => panel.scope === scope);
    if (!panelConfig) return existingBranch;
    const nextBranch = { ...(existingBranch && typeof existingBranch === "object" ? existingBranch : {}) };
    panelConfig.items.forEach((item) => {
      if (item.kind === "localized") {
        const payload = readLocalizedBookingPdfField(scope, item.field, existingBranch?.[`${item.field}_i18n`]);
        nextBranch[item.field] = payload.text;
        nextBranch[`${item.field}_i18n`] = payload.i18n;
        if (item.includeField) {
          const toggleValue = readBookingPdfToggle(`${scope}.${item.includeField}`);
          nextBranch[item.includeField] = item.defaultChecked === true
            ? toggleValue !== false
            : toggleValue === true;
        }
        return;
      }
      const toggleValue = readBookingPdfToggle(`${scope}.${item.field}`);
      nextBranch[item.field] = item.defaultChecked === true
        ? toggleValue !== false
        : toggleValue === true;
    });
    return nextBranch;
  }

  function customerReferenceNote(booking = state.booking) {
    return normalizeText(booking?.web_form_submission?.notes);
  }

  function renderPdfPersonalizationFields() {
    const draft = ensureCoreDraft();
    const disabled = !state.permissions.canEditBooking;
    renderCheckboxOptions(
      els.destinationsOptions,
      TOUR_DESTINATION_OPTIONS.map((option) => option.value),
      normalizeCodeArray(draft.destinations),
      "booking-destination-option",
      disabled,
      (value) => TOUR_DESTINATION_LABEL_BY_CODE.get(value) || value
    );
    renderCheckboxOptions(
      els.travelStylesOptions,
      TOUR_STYLE_CODE_OPTIONS.map((option) => String(option.value || "").trim().toLowerCase()).filter(Boolean),
      normalizeTravelStyleArray(draft.travel_styles),
      "booking-travel-style-option",
      disabled,
      (value) => TRAVEL_STYLE_LABEL_BY_VALUE.get(value) || value
    );
    updateMultiselectSummary(
      els.destinationsSummary,
      destinationLabels(draft.destinations),
      bookingT("booking.destinations_placeholder", "Select destinations")
    );
    updateMultiselectSummary(
      els.travelStylesSummary,
      travelStyleLabels(draft.travel_styles),
      bookingT("booking.travel_styles_placeholder", "Select travel style")
    );

    const travelPlan = normalizePdfPersonalization(draft.pdf_personalization).travel_plan;
    const offer = normalizePdfPersonalization(draft.pdf_personalization).offer;
    const bookingConfirmation = normalizePdfPersonalization(draft.pdf_personalization).booking_confirmation;
    const pdfBranches = {
      travel_plan: travelPlan,
      offer,
      booking_confirmation: bookingConfirmation
    };
    const renderField = (mount, scope, field, label, placeholder, rows = 2) => {
      if (!(mount instanceof HTMLElement)) return;
      const branch = pdfBranches[scope] || {};
      const config = getBookingPdfPersonalizationItemConfig(scope, field);
      const includeField = config?.includeField || "";
      const enabled = includeField
        ? branch?.[includeField] !== false
        : true;
      const fieldMarkup = renderLocalizedStackedField({
        escapeHtml,
        idBase: `booking_pdf_${scope}_${field}`,
        label,
        showLabel: false,
        type: rows > 1 ? "textarea" : "input",
        rows,
        commonData: { "booking-pdf-field": `${scope}.${field}` },
        sourceValue: resolveLocalizedEditorBranchText(branch?.[`${field}_i18n`] ?? branch?.[field], bookingSourceLang(), ""),
        localizedValue: resolveLocalizedEditorBranchText(branch?.[`${field}_i18n`] ?? branch?.[field], bookingContentLang(), ""),
        englishPlaceholder: placeholder,
        localizedPlaceholder: placeholder,
        disabled,
        translateEnabled: false
      });
      mount.innerHTML = includeField
        ? `
          <div class="booking-pdf-panel__field">
            <label class="booking-pdf-panel__toggle-label" for="booking_pdf_${scope}_${includeField}">
              <input
                id="booking_pdf_${scope}_${includeField}"
                type="checkbox"
                data-booking-pdf-toggle="${scope}.${includeField}"
                ${enabled ? "checked" : ""}
                ${disabled ? "disabled" : ""}
              />
              <span>${escapeHtml(label)}</span>
            </label>
            <div class="booking-pdf-panel__field-body">
              ${fieldMarkup}
            </div>
          </div>
        `
        : fieldMarkup;
    };
    const resolvePlaceholder = (placeholderKey) => {
      switch (placeholderKey) {
        case "subtitle":
          return computedPdfSubtitlePlaceholder();
        case "travel_plan_welcome":
          return computedTravelPlanWelcomePlaceholder();
        case "offer_welcome":
          return computedOfferWelcomePlaceholder();
        case "closing":
          return computedClosingPlaceholder();
        default:
          return "";
      }
    };
    const renderToggle = (mount, scope, config) => {
      if (!(mount instanceof HTMLElement)) return;
      const branch = pdfBranches[scope] || {};
      const checked = config.defaultChecked === true
        ? branch?.[config.field] !== false
        : branch?.[config.field] === true;
      const previewMarkup = config.previewKey === "offer_cancellation_policy"
        ? `<div class="micro">${offerCancellationPolicyPreviewMarkup()}</div>`
        : "";
      mount.innerHTML = `
        <div class="booking-pdf-panel__toggle">
          <label class="booking-pdf-panel__toggle-label" for="booking_pdf_${scope}_${config.field}">
            <input
              id="booking_pdf_${scope}_${config.field}"
              type="checkbox"
              data-booking-pdf-toggle="${scope}.${config.field}"
              ${checked ? "checked" : ""}
              ${disabled ? "disabled" : ""}
            />
            <span>${escapeHtml(bookingT(config.labelKey, config.labelFallback))}</span>
          </label>
          ${previewMarkup}
        </div>
      `;
    };

    BOOKING_PDF_PERSONALIZATION_PANELS.forEach((panelConfig) => {
      panelConfig.items.forEach((item) => {
        const mount = els[item.elsKey];
        if (item.kind === "localized") {
          renderField(
            mount,
            panelConfig.scope,
            item.field,
            bookingT(item.labelKey, item.labelFallback),
            resolvePlaceholder(item.placeholderKey),
            item.rows
          );
          return;
        }
        renderToggle(mount, panelConfig.scope, item);
      });
    });

    const submissionNote = customerReferenceNote();
    BOOKING_PDF_PERSONALIZATION_PANELS.forEach((panelConfig) => {
      const mount = els[panelConfig.referenceElsKey];
      if (!(mount instanceof HTMLElement)) return;
      mount.innerHTML = `
        <div class="booking-pdf-reference__item">
          <div class="booking-pdf-reference__value">${escapeHtml(submissionNote || bookingT("booking.web_form.no_note", "(no note)"))}</div>
        </div>
      `;
    });
  }

  function syncCoreDraftFromBooking({ force = false } = {}) {
    if (!state.booking) return ensureCoreDraft();
    const draft = ensureCoreDraft();
    if (force || !state.dirty.core) {
      draft.name = normalizeText(state.booking.name) || "";
      draft.assigned_keycloak_user_id = normalizeText(state.booking.assigned_keycloak_user_id) || "";
      draft.customer_language = savedCustomerLanguage(state.booking);
      draft.source_channel = normalizeText(state.booking.source_channel).toLowerCase() || "other";
      draft.referral_kind = normalizeText(state.booking.referral_kind).toLowerCase() || "none";
      draft.referral_label = normalizeText(state.booking.referral_label) || "";
      draft.referral_staff_user_id = normalizeText(state.booking.referral_staff_user_id) || "";
      draft.milestone_action_key = savedMilestoneActionKey(state.booking);
      draft.destinations = bookingDestinations(state.booking);
      draft.travel_styles = normalizeTravelStyleArray(state.booking.travel_styles);
      draft.pdf_personalization = normalizePdfPersonalization(state.booking.pdf_personalization);
    }
    if (force || !state.dirty.note) {
      draft.notes = normalizeText(state.booking.notes) || "";
      state.originalNote = draft.notes;
    }
    return draft;
  }

  function offerCancellationPolicyPreviewMarkup() {
    const travelerCount = resolveOfferCancellationPolicyTravelerCount(state.booking);
    const section = OFFER_CANCELLATION_POLICY_SECTIONS.find((entry) => (
      Number.isInteger(travelerCount)
      && travelerCount >= entry.minTravelers
      && travelerCount <= entry.maxTravelers
    )) || null;
    if (!section) {
      return `<div class="booking-pdf-panel__policy-section">${escapeHtml("Set traveler count to show the applicable cancellation policy section.")}</div>`;
    }
    const title = bookingT(
      "booking.pdf.offer.cancellation_policy_preview_title",
      "Cancellation policy ({travelerRange})",
      { travelerRange: offerCancellationPolicyHeadingLabel(section) }
    );
    return `<div class="booking-pdf-panel__policy-section">`
      + `<strong>${escapeHtml(title)}</strong><br />`
      + `${section.lines.map((line) => escapeHtml(line)).join("<br />")}`
      + `</div>`;
  }

  function resolveOfferCancellationPolicyTravelerCount(booking) {
    const explicit = Number.parseInt(
      booking?.number_of_travelers ?? booking?.web_form_submission?.number_of_travelers,
      10
    );
    if (Number.isInteger(explicit) && explicit > 0) return explicit;
    const travelerCount = (Array.isArray(booking?.persons) ? booking.persons : []).filter((person) => (
      person
      && typeof person === "object"
      && !Array.isArray(person)
      && Array.isArray(person.roles)
      && person.roles.includes("traveler")
    )).length;
    return travelerCount > 0 ? travelerCount : null;
  }

  function normalizeCoreComparableState(values = {}) {
    const referralKind = normalizeText(values.referral_kind).toLowerCase() || "none";
    return {
      name: normalizeText(values.name) || "",
      assigned_keycloak_user_id: normalizeText(values.assigned_keycloak_user_id) || "",
      customer_language: normalizeBookingContentLang(values.customer_language || "en"),
      source_channel: normalizeText(values.source_channel).toLowerCase() || "other",
      referral_kind: referralKind,
      referral_label: referralKind === "b2b_partner" || referralKind === "other_customer"
        ? normalizeText(values.referral_label) || ""
        : "",
      referral_staff_user_id: referralKind === "atp_staff"
        ? normalizeText(values.referral_staff_user_id) || ""
        : "",
      milestone_action_key: normalizeText(values.milestone_action_key).toUpperCase(),
      destinations: JSON.stringify(normalizeCodeArray(values.destinations)),
      travel_styles: JSON.stringify(normalizeTravelStyleArray(values.travel_styles)),
      pdf_personalization: JSON.stringify(normalizePdfPersonalization(values.pdf_personalization))
    };
  }

  function coreComparableStateFromBooking() {
    return normalizeCoreComparableState({
      name: normalizeText(state.booking?.name) || "",
      assigned_keycloak_user_id: normalizeText(state.booking?.assigned_keycloak_user_id) || "",
      customer_language: savedCustomerLanguage(state.booking),
      source_channel: normalizeText(state.booking?.source_channel).toLowerCase() || "other",
      referral_kind: normalizeText(state.booking?.referral_kind).toLowerCase() || "none",
      referral_label: normalizeText(state.booking?.referral_label) || "",
      referral_staff_user_id: normalizeText(state.booking?.referral_staff_user_id) || "",
      milestone_action_key: savedMilestoneActionKey(state.booking),
      destinations: bookingDestinations(state.booking),
      travel_styles: state.booking?.travel_styles,
      pdf_personalization: state.booking?.pdf_personalization
    });
  }

  function coreComparableStateFromDraft() {
    const draft = ensureCoreDraft();
    return normalizeCoreComparableState({
      name: normalizeText(draft.name) || "",
      assigned_keycloak_user_id: normalizeText(draft.assigned_keycloak_user_id) || "",
      customer_language: normalizeBookingContentLang(draft.customer_language || savedCustomerLanguage(state.booking)),
      source_channel: normalizeText(draft.source_channel).toLowerCase() || "other",
      referral_kind: normalizeText(draft.referral_kind).toLowerCase() || "none",
      referral_label: normalizeText(draft.referral_label) || "",
      referral_staff_user_id: normalizeText(draft.referral_staff_user_id) || "",
      milestone_action_key: normalizeText(draft.milestone_action_key || savedMilestoneActionKey(state.booking)).toUpperCase(),
      destinations: draft.destinations,
      travel_styles: draft.travel_styles,
      pdf_personalization: draft.pdf_personalization
    });
  }

  function coreSnapshotFromBooking() {
    return JSON.stringify(coreComparableStateFromBooking());
  }

  function coreSnapshotFromDraft() {
    return JSON.stringify(coreComparableStateFromDraft());
  }

  function updateCoreDirtyState() {
    if (!state.permissions.canEditBooking) {
      setBookingSectionDirty("core", false, null);
      return false;
    }
    const draft = ensureCoreDraft();
    if (els.titleInput) draft.name = normalizeText(els.titleInput.value) || "";
    if (els.ownerSelect) draft.assigned_keycloak_user_id = normalizeText(els.ownerSelect.value) || "";
    if (els.sourceChannelSelect) draft.source_channel = normalizeText(els.sourceChannelSelect.value).toLowerCase() || "other";
    if (els.referralKindSelect) draft.referral_kind = normalizeText(els.referralKindSelect.value).toLowerCase() || "none";
    if (els.referralLabelInput) draft.referral_label = normalizeText(els.referralLabelInput.value) || "";
    if (els.referralStaffSelect) draft.referral_staff_user_id = normalizeText(els.referralStaffSelect.value) || "";
    draft.destinations = normalizeCodeArray(readCheckedValues(els.destinationsOptions, "booking-destination-option"));
    draft.travel_styles = normalizeTravelStyleArray(readCheckedValues(els.travelStylesOptions, "booking-travel-style-option"));
    draft.pdf_personalization = Object.fromEntries(
      BOOKING_PDF_PERSONALIZATION_PANELS.map((panelConfig) => [
        panelConfig.scope,
        buildPdfPersonalizationBranchDraft(panelConfig.scope, draft.pdf_personalization?.[panelConfig.scope])
      ])
    );
    if (draft.referral_kind === "none") {
      draft.referral_label = "";
      draft.referral_staff_user_id = "";
    } else if (draft.referral_kind === "b2b_partner" || draft.referral_kind === "other_customer") {
      draft.referral_staff_user_id = "";
    } else if (draft.referral_kind === "atp_staff") {
      draft.referral_label = "";
    }
    draft.customer_language = normalizeBookingContentLang(draft.customer_language || savedCustomerLanguage(state.booking));
    draft.milestone_action_key = normalizeText(draft.milestone_action_key || savedMilestoneActionKey(state.booking)).toUpperCase();
    const savedState = state.booking ? coreComparableStateFromBooking() : null;
    const draftState = state.booking ? coreComparableStateFromDraft() : null;
    const changedFields = savedState && draftState
      ? Object.keys(savedState).filter((key) => savedState[key] !== draftState[key])
      : [];
    const isDirty = changedFields.length > 0;
    setBookingSectionDirty(
      "core",
      isDirty,
      isDirty
        ? {
            reason: "core_snapshot_mismatch",
            changed_fields: changedFields,
            saved: savedState,
            draft: draftState
          }
        : null
    );
    return isDirty;
  }

  function milestoneActionLabel(actionKey) {
    const meta = BOOKING_MILESTONE_ACTION_BY_KEY[normalizeText(actionKey).toUpperCase()];
    if (!meta) return "";
    return bookingT(meta.labelKey, meta.labelFallback);
  }

  function referralModeConfig(referralKind) {
    return REFERRAL_MODE_CONFIG[normalizeText(referralKind).toLowerCase()] || null;
  }

  function resolveAtpStaffDisplayName(user, fallbackProfile = null) {
    return normalizeText(fallbackProfile?.full_name)
      || normalizeText(user?.staff_profile?.full_name)
      || normalizeText(user?.full_name)
      || normalizeText(fallbackProfile?.name)
      || normalizeText(user?.name)
      || displayKeycloakUser(user)
      || normalizeText(user?.username)
      || normalizeText(user?.id)
      || "";
  }

  function resolveStatusPresentation(booking) {
    const milestones = booking?.milestones && typeof booking.milestones === "object" ? booking.milestones : null;
    const currentAction = BOOKING_MILESTONE_ACTION_BY_KEY[normalizeText(booking?.last_action).toUpperCase()] || null;
    const currentTimestamp = normalizeText(booking?.last_action_at) || normalizeText(currentAction ? milestones?.[currentAction.field] : "");
    const depositRecorded = Boolean(
      normalizeText(booking?.deposit_received_at)
      || normalizeText(milestones?.deposit_received_at)
    );

    if (currentAction) {
      const currentActionKey = currentAction.key === "DEPOSIT_RECEIVED" ? "IN_PROGRESS" : currentAction.key;
      const lastActionLabel = currentAction.key === "DEPOSIT_RECEIVED"
        ? bookingT("booking.milestone.action.deposit_received", "Deposit received")
        : milestoneActionLabel(currentActionKey);
      return {
        currentActionKey,
        lastAction: currentTimestamp
          ? bookingT(
              "booking.milestone.last_action_at",
              "Last action: {action} on {date}",
              {
                action: lastActionLabel,
                date: formatDateTime(currentTimestamp)
              }
            )
          : lastActionLabel
      };
    }

    const fallback = BOOKING_STAGE_FALLBACKS[normalizeText(booking?.stage).toUpperCase()] || BOOKING_STAGE_FALLBACKS.NEW_BOOKING;
    return {
      currentActionKey: depositRecorded && fallback.currentActionKey === "DEPOSIT_REQUEST_SENT"
        ? "IN_PROGRESS"
        : fallback.currentActionKey,
      lastAction: ""
    };
  }

  function formatRelativeActionTime(value) {
    const text = normalizeText(value);
    if (!text) return "";
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return "";
    const deltaMs = Date.now() - date.getTime();
    if (!Number.isFinite(deltaMs)) return "";
    if (deltaMs < 60_000) return bookingT("booking.last_updated.just_now", "just now");
    const minutes = Math.floor(deltaMs / 60_000);
    if (minutes < 60) {
      return bookingT("booking.last_updated.minutes_ago", "{count} min ago", { count: minutes });
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return bookingT("booking.last_updated.hours_ago", "{count} h ago", { count: hours });
    }
    const days = Math.floor(hours / 24);
    if (days < 7) {
      return bookingT("booking.last_updated.days_ago", "{count} d ago", { count: days });
    }
    return formatDateTime(text);
  }

  function resolveNewestBookingTimestamp(...values) {
    let latestValue = "";
    let latestTimeMs = Number.NEGATIVE_INFINITY;
    for (const value of values) {
      const text = normalizeText(value);
      if (!text) continue;
      const timeMs = new Date(text).getTime();
      if (!Number.isFinite(timeMs)) continue;
      if (timeMs > latestTimeMs) {
        latestTimeMs = timeMs;
        latestValue = text;
      }
    }
    return latestValue;
  }

  function blockPersistedAction() {
    if (!hasUnsavedBookingChanges?.()) return false;
    reportPersistedActionBlocked?.();
    return true;
  }

  function renderBookingHeader() {
    if (!state.booking) return;
    const draft = syncCoreDraftFromBooking();
    const primaryContact = getPrimaryContact(state.booking);
    const title = normalizeText(draft.name) || primaryContact?.name || getSubmittedContact(state.booking)?.name || bookingT("booking.title", "Booking");
    if (els.title) els.title.textContent = title;
    if (els.titleInput && document.activeElement !== els.titleInput) {
      els.titleInput.value = normalizeText(draft.name) || title;
    }
    if (els.titleEditBtn) {
      els.titleEditBtn.hidden = !state.permissions.canEditBooking;
      els.titleEditBtn.disabled = !state.permissions.canEditBooking;
    }
    if (els.heroPhotoBtn) {
      els.heroPhotoBtn.disabled = !state.permissions.canEditBooking;
      els.heroPhotoBtn.classList.toggle("is-editable", state.permissions.canEditBooking);
      els.heroPhotoBtn.setAttribute(
        "aria-label",
        state.permissions.canEditBooking
          ? bookingT("booking.change_picture", "Change booking picture")
          : bookingT("booking.picture", "Booking picture")
      );
    }
    if (els.subtitle) {
      const bookingId = normalizeText(state.booking.id);
      const shortId = bookingId ? bookingId.slice(-6) : "-";
      const latestHeaderTimestamp = resolveNewestBookingTimestamp(
        state.latestActivityAt,
        state.booking?.updated_at,
        state.booking?.last_action_at
      );
      const relativeLastAction = formatRelativeActionTime(latestHeaderTimestamp);
      const lastUpdatedLabel = relativeLastAction
        ? bookingT("booking.last_updated", "last updated {value}", { value: relativeLastAction })
        : "";
      const idNode = document.getElementById("detail_sub_title_id");
      const updatedNode = document.getElementById("detail_sub_title_updated");
      if (idNode && updatedNode) {
        idNode.textContent = `${bookingT("booking.id_short", "ID")}: ${shortId}`;
        updatedNode.textContent = lastUpdatedLabel
          ? `· ${lastUpdatedLabel}`
          : "";
      } else {
        els.subtitle.textContent = lastUpdatedLabel
          ? `${bookingT("booking.id_short", "ID")}: ${shortId} · ${lastUpdatedLabel}`
          : `${bookingT("booking.id_short", "ID")}: ${shortId}`;
      }
      els.subtitle.hidden = false;
    }
    if (heroCopiedValue && heroCopiedValue !== getCurrentBookingIdentifier()) {
      clearHeroCopyStatus();
    }
    renderBookingHeroImage();
  }

  function renderBookingHeroImage() {
    if (!els.heroImage) return;
    const bookingImage = normalizeText(state.booking?.image);
    if (bookingImage) {
      els.heroImage.src = resolveBookingImageSrc(bookingImage);
      els.heroImage.alt = normalizeText(state.booking?.name) || bookingT("booking.picture", "Booking picture");
      els.heroImage.hidden = false;
      els.heroImage.style.display = "block";
      if (els.heroInitials) els.heroInitials.hidden = true;
      if (els.heroInitials) els.heroInitials.style.display = "none";
      return;
    }

    if (normalizeText(state.tour_image)) {
      els.heroImage.src = resolveBookingImageSrc(state.tour_image);
      els.heroImage.alt = normalizeText(state.booking?.web_form_submission?.booking_name) || bookingT("booking.tour_picture", "Tour picture");
      els.heroImage.hidden = false;
      els.heroImage.style.display = "block";
      if (els.heroInitials) els.heroInitials.hidden = true;
      if (els.heroInitials) els.heroInitials.style.display = "none";
      return;
    }

    if (shouldUseDiscoveryCallFallbackImage(state.booking)) {
      els.heroImage.src = DISCOVERY_CALL_FALLBACK_IMAGE;
      els.heroImage.alt = normalizeText(state.booking?.web_form_submission?.booking_name) || bookingT("booking.tour_picture", "Tour picture");
      els.heroImage.hidden = false;
      els.heroImage.style.display = "block";
      if (els.heroInitials) els.heroInitials.hidden = true;
      if (els.heroInitials) els.heroInitials.style.display = "none";
      return;
    }

    const representativeTraveler = getRepresentativeTraveler(state.booking);

    if (representativeTraveler && normalizeText(representativeTraveler.photo_ref)) {
      els.heroImage.src = resolvePersonPhotoSrc(representativeTraveler.photo_ref);
      els.heroImage.alt = representativeTraveler.name ? `${representativeTraveler.name}` : "";
      els.heroImage.hidden = false;
      els.heroImage.style.display = "block";
      if (els.heroInitials) els.heroInitials.hidden = true;
      if (els.heroInitials) els.heroInitials.style.display = "none";
      return;
    }

    if (representativeTraveler && normalizeText(representativeTraveler.name)) {
      els.heroImage.hidden = true;
      els.heroImage.style.display = "none";
      if (els.heroInitials) {
        els.heroInitials.textContent = getPersonInitials(representativeTraveler.name);
        els.heroInitials.hidden = false;
        els.heroInitials.style.display = "block";
      }
      return;
    }

    els.heroImage.src = "assets/img/profile_person.png";
    els.heroImage.alt = "";
    els.heroImage.hidden = false;
    els.heroImage.style.display = "block";
    if (els.heroInitials) els.heroInitials.hidden = true;
    if (els.heroInitials) els.heroInitials.style.display = "none";
  }

  function getCurrentBookingIdentifier() {
    return normalizeText(state.booking?.id) || "";
  }

  function setHeroCopyStatus(message, copiedValue = "") {
    if (els.heroCopyStatus) {
      els.heroCopyStatus.textContent = message || "";
    }
    heroCopiedValue = copiedValue || "";
    if (heroCopyClipboardPoll) {
      window.clearInterval(heroCopyClipboardPoll);
      heroCopyClipboardPoll = null;
    }
    if (heroCopiedValue) {
      startHeroClipboardWatcher();
    }
  }

  function clearHeroCopyStatus() {
    setHeroCopyStatus("");
  }

  function startHeroClipboardWatcher() {
    if (!heroCopiedValue || !navigator.clipboard?.readText) return;
    heroCopyClipboardPoll = window.setInterval(async () => {
      try {
        const clipboardText = await navigator.clipboard.readText();
        if (clipboardText !== heroCopiedValue) {
          clearHeroCopyStatus();
        }
      } catch {
        if (heroCopyClipboardPoll) {
          window.clearInterval(heroCopyClipboardPoll);
          heroCopyClipboardPoll = null;
        }
      }
    }, 1800);
  }

  async function copyHeroIdToClipboard() {
    const id = getCurrentBookingIdentifier();
    if (!id || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(id);
      setHeroCopyStatus(bookingT("booking.copied", "Copied"), id);
    } catch {
      setHeroCopyStatus(bookingT("booking.copy_failed", "Copy failed"));
    }
  }

  function renderBookingData() {
    if (!state.booking) return;
    rerenderWhatsApp?.(state.booking);
    const booking = state.booking;
    const submittedContact = getSubmittedContact(booking);
    const submissionPreferredLanguage = normalizeText(booking.web_form_submission?.preferred_language)
      ? bookingContentLanguageLabel(normalizeBookingContentLang(booking.web_form_submission.preferred_language))
      : "";
    const sections = [{
      title: bookingT("booking.web_form.title", "Web form submission"),
      summaryClassName: "booking-section__summary--inline-pad-16",
      entries: [
        ["name", booking.web_form_submission?.name || submittedContact?.name],
        ["email", booking.web_form_submission?.email || submittedContact?.email],
        ["phone_number", booking.web_form_submission?.phone_number || submittedContact?.phone_number],
        ["booking_name", booking.web_form_submission?.booking_name],
        ["preferred_language", submissionPreferredLanguage],
        ["preferred_currency", booking.web_form_submission?.preferred_currency],
        ["destinations", Array.isArray(booking.web_form_submission?.destinations) ? booking.web_form_submission.destinations.join(", ") : booking.web_form_submission?.destinations],
        ["travel_style", Array.isArray(booking.web_form_submission?.travel_style) ? booking.web_form_submission.travel_style.join(", ") : booking.web_form_submission?.travel_style],
        ["travel_month", booking.web_form_submission?.travel_month],
        ["number_of_travelers", booking.web_form_submission?.number_of_travelers],
        ["travel_duration_days_min", booking.web_form_submission?.travel_duration_days_min],
        ["travel_duration_days_max", booking.web_form_submission?.travel_duration_days_max],
        ["budget_lower_usd", booking.web_form_submission?.budget_lower_usd],
        ["budget_upper_usd", booking.web_form_submission?.budget_upper_usd],
        ["tour_id", booking.web_form_submission?.tour_id],
        ["page_url", booking.web_form_submission?.page_url],
        ["ip_address", booking.web_form_submission?.ip_address],
        ["ip_country_guess", booking.web_form_submission?.ip_country_guess],
        ["referrer", booking.web_form_submission?.referrer],
        ["utm_source", booking.web_form_submission?.utm_source],
        ["utm_medium", booking.web_form_submission?.utm_medium],
        ["utm_campaign", booking.web_form_submission?.utm_campaign],
        ["notes", booking.web_form_submission?.notes],
        ["submitted_at", formatDateTime(booking.web_form_submission?.submitted_at)]
      ].map(([key, value]) => ({ key: webFormFieldLabel(key), value: String(value ?? "-") }))
    }];

    renderSections(sections);
  }

  function renderSections(sections) {
    if (!els.booking_data_view) return;
    const html = sections
      .map((section) => {
        const summaryClassName = String(section.summaryClassName || "").trim();
        const rows = (section.entries || [])
          .map((entry) => `<tr><th>${escapeHtml(entry.key)}</th><td>${escapeHtml(String(entry.value || "-"))}</td></tr>`)
          .join("");
        return `
        <article class="booking-section">
          ${buildBookingSectionHeadMarkup({ primary: section.title, summaryClassName })}
          <div class="booking-section__body">
            <div class="backend-table-wrap">
              <table class="backend-table"><tbody>${rows || '<tr><td colspan="2">-</td></tr>'}</tbody></table>
            </div>
          </div>
        </article>
      `;
      })
      .join("");
    els.booking_data_view.innerHTML = html;
    initializeBookingSections(els.booking_data_view);
  }

  function renderActionControls() {
    if (!state.booking) return;
    const draft = syncCoreDraftFromBooking();
    const statusPresentation = resolveStatusPresentation(state.booking);
    const draftMilestoneActionKey = normalizeText(draft.milestone_action_key).toUpperCase() || statusPresentation.currentActionKey;
    const hasPendingMilestoneChange = draftMilestoneActionKey !== statusPresentation.currentActionKey;

    if (els.ownerSelect) {
      const currentOwnerId = normalizeText(draft.assigned_keycloak_user_id) || normalizeText(state.booking.assigned_keycloak_user_id);
      const knownOwners = new Map((state.keycloakUsers || []).map((user) => [String(user.id || ""), user]));
      const currentOwner = knownOwners.get(currentOwnerId) || resolveCurrentAuthKeycloakUser(currentOwnerId);
      const currentOwnerName = resolveAtpStaffDisplayName(currentOwner, state.booking?.assigned_atp_staff) || currentOwnerId;
      if (currentOwnerId && currentOwnerName && !knownOwners.has(currentOwnerId)) {
        knownOwners.set(currentOwnerId, {
          ...(currentOwner && typeof currentOwner === "object" ? currentOwner : {}),
          id: currentOwnerId,
          name: currentOwnerName || currentOwnerId,
          username: normalizeText(currentOwner?.username) || normalizeText(state.booking?.assigned_atp_staff?.username) || null,
          full_name: normalizeText(state.booking?.assigned_atp_staff?.full_name) || normalizeText(currentOwner?.full_name) || ""
        });
      }

      const options = state.permissions.canChangeAssignment
        ? [`<option value="">${escapeHtml(bookingT("common.unassigned", "Unassigned"))}</option>`]
            .concat([...knownOwners.values()].map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(resolveAtpStaffDisplayName(user) || user.id)}</option>`))
            .join("")
        : currentOwnerId
          ? `<option value="${escapeHtml(currentOwnerId)}">${escapeHtml(currentOwnerName || bookingT("booking.assigned_user", "Assigned user"))}</option>`
          : `<option value="">${escapeHtml(bookingT("common.unassigned", "Unassigned"))}</option>`;
      els.ownerSelect.innerHTML = options;
      els.ownerSelect.value = currentOwnerId || "";
      els.ownerSelect.disabled = !state.permissions.canChangeAssignment;
    }

    if (els.sourceChannelSelect) {
      els.sourceChannelSelect.innerHTML = BOOKING_SOURCE_CHANNEL_OPTIONS
        .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(bookingT(option.labelKey, option.labelFallback))}</option>`)
        .join("");
      els.sourceChannelSelect.value = normalizeText(draft.source_channel).toLowerCase() || "other";
      els.sourceChannelSelect.disabled = !state.permissions.canEditBooking;
    }

    if (els.referralKindSelect) {
      els.referralKindSelect.innerHTML = BOOKING_REFERRAL_KIND_OPTIONS
        .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(bookingT(option.labelKey, option.labelFallback))}</option>`)
        .join("");
      els.referralKindSelect.value = normalizeText(draft.referral_kind).toLowerCase() || "none";
      els.referralKindSelect.disabled = !state.permissions.canEditBooking;
    }

    const referralKind = normalizeText(draft.referral_kind).toLowerCase() || "none";
    const referralConfig = referralModeConfig(referralKind);
    const showReferralDetail = Boolean(referralConfig);
    const showReferralLabel = referralConfig?.kind === "text";
    const showReferralStaff = referralConfig?.kind === "select";
    if (els.referralLabelField) els.referralLabelField.hidden = !showReferralDetail;
    if (els.referralLabelLabel) {
      els.referralLabelLabel.textContent = bookingT(
        referralConfig?.labelKey || "booking.referral.partner_name",
        referralConfig?.labelFallback || "B2B partner name"
      );
      els.referralLabelLabel.htmlFor = referralConfig?.controlId || "booking_referral_label_input";
    }
    if (els.referralLabelHint) {
      els.referralLabelHint.textContent = "";
      els.referralLabelHint.hidden = true;
    }
    if (els.referralLabelInput) {
      if (document.activeElement !== els.referralLabelInput) {
        els.referralLabelInput.value = normalizeText(draft.referral_label) || "";
      }
      els.referralLabelInput.hidden = !showReferralLabel;
      els.referralLabelInput.disabled = !state.permissions.canEditBooking || !showReferralLabel;
    }
    if (els.referralStaffSelect) {
      const staffOptions = [`<option value="">${escapeHtml(bookingT("booking.referral.staff_placeholder", "Select ATP staff"))}</option>`]
        .concat((state.keycloakUsers || []).map((user) => (
          `<option value="${escapeHtml(user.id)}">${escapeHtml(resolveAtpStaffDisplayName(user) || user.id)}</option>`
        )))
        .join("");
      els.referralStaffSelect.innerHTML = staffOptions;
      els.referralStaffSelect.value = normalizeText(draft.referral_staff_user_id) || "";
      els.referralStaffSelect.hidden = !showReferralStaff;
      els.referralStaffSelect.disabled = !state.permissions.canEditBooking || !showReferralStaff;
    }

    if (els.lastActionDetail) {
      const text = hasPendingMilestoneChange
        ? bookingT("booking.milestone.pending_action", "Unsaved status: {action}", {
            action: milestoneActionLabel(draftMilestoneActionKey)
          })
        : statusPresentation.lastAction;
      els.lastActionDetail.textContent = text;
      els.lastActionDetail.hidden = !text;
    }
    if (els.milestoneActionsBefore || els.milestoneActionsAfter) {
      const hasRecordedDeposit = Boolean(
        normalizeText(state.booking?.deposit_received_at)
        || normalizeText(state.booking?.milestones?.deposit_received_at)
      );
      const renderActionRows = (actionRows) => actionRows.map((row) => {
        const rowButtons = row.actions.map((actionKey) => {
          const action = BOOKING_MILESTONE_ACTION_BY_KEY[actionKey];
          if (!action) return "";
          const disabled = !state.permissions.canChangeStage || !row.isEnabled;
          const isCurrent = draftMilestoneActionKey === action.key && !disabled;
          const classes = [
            "btn",
            "btn-ghost",
            "booking-milestone-actions__btn",
            isCurrent ? "booking-milestone-actions__btn--current" : "",
            action.key === "BOOKING_LOST" ? "booking-milestone-actions__btn--lost" : ""
          ].filter(Boolean).join(" ");
          return `<button
            class="${classes}"
            type="button"
            data-booking-milestone-action="${escapeHtml(action.key)}"
            aria-pressed="${isCurrent ? "true" : "false"}"
            ${disabled ? " disabled" : ""}
          >${escapeHtml(milestoneActionLabel(action.key))}</button>`;
        }).join("");
        return `<div class="${row.className}">${rowButtons}</div>`;
      }).join("");
      if (els.milestoneActionsBefore) {
        els.milestoneActionsBefore.innerHTML = renderActionRows([
          {
            className: "booking-milestone-actions__row",
            actions: ["NEW_BOOKING", "TRAVEL_PLAN_SENT", "OFFER_SENT", "NEGOTIATION_STARTED", "DEPOSIT_REQUEST_SENT"],
            isEnabled: !hasRecordedDeposit
          },
          {
            className: "booking-milestone-actions__row booking-milestone-actions__row--terminal",
            actions: ["BOOKING_LOST"],
            isEnabled: !hasRecordedDeposit
          }
        ]);
      }
      if (els.milestoneActionsAfter) {
        els.milestoneActionsAfter.innerHTML = renderActionRows([
          {
            className: "booking-milestone-actions__row",
            actions: ["IN_PROGRESS", "TRIP_COMPLETED"],
            isEnabled: hasRecordedDeposit
          },
          {
            className: "booking-milestone-actions__row booking-milestone-actions__row--terminal",
            actions: ["BOOKING_LOST"],
            isEnabled: hasRecordedDeposit
          }
        ]);
      }
      els.bookingStatusPhaseBefore?.classList.toggle("booking-status-panel__phase--inactive", hasRecordedDeposit);
      els.bookingStatusPhaseAfter?.classList.toggle("booking-status-panel__phase--inactive", !hasRecordedDeposit);
    }
    if (els.noteInput) {
      els.noteInput.disabled = !state.permissions.canEditBooking;
      if (document.activeElement !== els.noteInput) {
        els.noteInput.value = draft.notes || "";
      }
    }
    renderPdfPersonalizationFields();
    updateCoreDirtyState();
    updateNoteSaveButtonState();
    if (els.cloneTitleLabel) {
      els.cloneTitleLabel.textContent = bookingT("booking.clone_new_title", "New title");
    }
    if (els.cloneIncludeTravelersLabel) {
      els.cloneIncludeTravelersLabel.textContent = bookingT("booking.clone_include_travelers", "Include travelers");
    }
    syncCloneTitleInput();
    if (els.deleteBtn) {
      els.deleteBtn.style.display = state.permissions.canEditBooking ? "" : "none";
      els.deleteBtn.disabled = !state.permissions.canEditBooking;
    }
    if (els.cloneBtn) {
      els.cloneBtn.textContent = bookingT("booking.clone_booking", "Clone booking");
      els.cloneBtn.style.display = state.permissions.canEditBooking ? "" : "none";
      els.cloneBtn.disabled = !state.permissions.canEditBooking || state.cloneBookingInFlight;
    }
    if (els.cloneTitleInput) {
      els.cloneTitleInput.disabled = !state.permissions.canEditBooking || state.cloneBookingInFlight;
    }
    if (els.cloneIncludeTravelersInput) {
      els.cloneIncludeTravelersInput.disabled = !state.permissions.canEditBooking || state.cloneBookingInFlight;
    }
  }

  async function ensureTourImageLoaded() {
    if (!state.booking) return;
    if (normalizeText(state.booking.image)) {
      state.tour_image = "";
      state.tour_image_tour_id = "";
      return;
    }
    const tourId = normalizeText(state.booking?.web_form_submission?.tour_id);
    if (!tourId) {
      state.tour_image = "";
      state.tour_image_tour_id = "";
      return;
    }
    if (state.tour_image_tour_id === tourId) return;

    const request = tourDetailRequest({ baseURL: apiOrigin, params: { tour_id: tourId } });
    const payload = await fetchApi(request.url);
    if (!payload?.tour) return;
    if (normalizeText(state.booking?.web_form_submission?.tour_id) !== tourId) return;
    state.tour_image_tour_id = tourId;
    state.tour_image = normalizeText(payload.tour.image) || "";
  }

  function handleBookingDetailKeydown(event) {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    if (els.personModal?.hidden === false) return;
    if (els.travelPlanServiceLibraryModal?.hidden === false) return;
    if (els.travelPlanImagePreviewModal?.hidden === false) return;
    if (!els.titleInput?.hidden) return;
    if (event.target === els.titleInput) return;
    event.preventDefault();
    closeBookingDetailScreen();
  }

  function triggerBookingPhotoPicker() {
    if (!state.permissions.canEditBooking || blockPersistedAction()) return;
    els.heroPhotoInput?.click();
  }

  async function uploadBookingPhoto() {
    if (!state.permissions.canEditBooking || !state.booking || blockPersistedAction()) return;
    const file = els.heroPhotoInput?.files?.[0] || null;
    if (!file) return;
    const base64 = await fileToBase64(file);
    const request = bookingImageRequest({
      baseURL: apiOrigin,
      params: { booking_id: state.booking.id }
    });
    const result = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_core_revision: getBookingRevision("core_revision"),
        filename: file.name,
        data_base64: base64,
        actor: state.user
      }
    });
    if (els.heroPhotoInput) els.heroPhotoInput.value = "";
    if (!result?.booking) return;
    applyBookingPayload(result);
    renderBookingHeader();
    renderBookingData();
    renderActionControls();
    renderPersonsEditor();
  }

  async function fileToBase64(file) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const value = String(reader.result || "");
        const comma = value.indexOf(",");
        resolve(comma >= 0 ? value.slice(comma + 1) : value);
      };
      reader.onerror = () => reject(new Error(bookingT("booking.error.read_file", "Failed to read file")));
      reader.readAsDataURL(file);
    });
  }

  async function deleteBooking() {
    if (!state.permissions.canEditBooking || !state.booking?.id || blockPersistedAction()) return;
    const label = normalizeText(getPrimaryContact(state.booking)?.name) || state.booking.id;
    if (!window.confirm(bookingT("booking.delete_confirm", "Delete booking for {name}? This cannot be undone.", { name: label }))) return;

    if (els.deleteBtn) els.deleteBtn.disabled = true;
    const request = bookingDeleteRequest({ baseURL: apiOrigin, params: { booking_id: state.booking.id } });
    const result = await fetchApi(request.url, {
      method: request.method,
      body: {
        expected_core_revision: getBookingRevision("core_revision")
      }
    });
    if (els.deleteBtn) els.deleteBtn.disabled = false;
    if (!result?.deleted) return;

    window.location.href = withBackendLang("/bookings.html", { section: "bookings" });
  }

  async function cloneBooking() {
    if (!state.permissions.canEditBooking || !state.booking?.id || state.cloneBookingInFlight || blockPersistedAction()) return;
    const nextName = normalizeText(els.cloneTitleInput?.value);
    if (!nextName) {
      cloneStatus(bookingT("booking.clone_missing_title", "Enter a title for the cloned booking."));
      return;
    }

    const includeTravelers = els.cloneIncludeTravelersInput?.checked === true;
    const label = normalizeText(getPrimaryContact(state.booking)?.name) || state.booking.id;
    if (!window.confirm(
      bookingT("booking.clone_confirm", "Clone booking for {name} as {title}?", {
        name: label,
        title: nextName
      })
    )) {
      return;
    }

    state.cloneBookingInFlight = true;
    cloneStatus(bookingT("booking.cloning", "Cloning booking..."));
    renderActionControls();

    try {
      const result = await fetchBookingMutation(
        resolveApiUrl(apiBase, `/api/v1/bookings/${encodeURIComponent(state.booking.id)}/clone`),
        {
          method: "POST",
          body: {
            expected_core_revision: getBookingRevision("core_revision"),
            name: nextName,
            include_travelers: includeTravelers,
            actor: state.user
          }
        }
      );
      const clonedId = normalizeText(result?.booking?.id);
      if (!clonedId) {
        cloneStatus(bookingT("booking.clone_failed", "Could not clone booking."));
        return;
      }
      if (canReadAllBookingsInUi?.()) {
        window.location.href = withBackendLang("/booking.html", {
          id: clonedId,
          content_lang: savedCustomerLanguage(result.booking)
        });
        return;
      }
      cloneStatus(bookingT(
        "booking.clone_success_unassigned",
        "Cloned as {bookingId}. The new booking is unassigned, so you may no longer be able to open it.",
        { bookingId: clonedId }
      ));
      syncCloneTitleInput({ force: true });
      if (els.cloneIncludeTravelersInput instanceof HTMLInputElement) {
        els.cloneIncludeTravelersInput.checked = false;
      }
    } finally {
      state.cloneBookingInFlight = false;
      renderActionControls();
    }
  }

  function updateNoteSaveButtonState() {
    if (!els.noteInput) return false;
    const draft = ensureCoreDraft();
    const current = normalizeText(els.noteInput.value);
    draft.notes = current;
    const original = normalizeText(state.booking?.notes);
    const isDirty = state.permissions.canEditBooking && current !== original;
    setBookingSectionDirty("note", isDirty);
    return isDirty;
  }

  async function saveCoreEdits() {
    if (!state.permissions.canEditBooking || !state.booking) return true;
    updateCoreDirtyState();
    if (!state.dirty.core) return true;
    const draft = ensureCoreDraft();
    let latestBooking = state.booking;

    if (normalizeText(draft.name) !== normalizeText(latestBooking.name)) {
      const request = bookingNameRequest({ baseURL: apiOrigin, params: { booking_id: latestBooking.id } });
      const result = await fetchBookingMutation(request.url, {
        method: request.method,
        body: {
          expected_core_revision: Number(latestBooking.core_revision || 0),
          name: normalizeText(draft.name) || "",
          actor: state.user
        }
      });
      if (!result?.booking) return false;
      latestBooking = result.booking;
      state.booking = latestBooking;
    }

    if (state.permissions.canChangeAssignment && normalizeText(draft.assigned_keycloak_user_id) !== normalizeText(latestBooking.assigned_keycloak_user_id)) {
      const request = bookingOwnerRequest({ baseURL: apiOrigin, params: { booking_id: latestBooking.id } });
      const result = await fetchBookingMutation(request.url, {
        method: request.method,
        body: {
          expected_core_revision: Number(latestBooking.core_revision || 0),
          assigned_keycloak_user_id: normalizeText(draft.assigned_keycloak_user_id) || null,
          actor: state.user
        }
      });
      if (!result?.booking) return false;
      latestBooking = result.booking;
      state.booking = latestBooking;
    }

    const nextCustomerLanguage = normalizeBookingContentLang(draft.customer_language || "en");
    if (nextCustomerLanguage !== savedCustomerLanguage(latestBooking)) {
      const request = bookingCustomerLanguageRequest({ baseURL: apiOrigin, params: { booking_id: latestBooking.id } });
      const result = await fetchBookingMutation(request.url, {
        method: request.method,
        body: {
          expected_core_revision: Number(latestBooking.core_revision || 0),
          customer_language: nextCustomerLanguage,
          actor: state.user
        }
      });
      if (!result?.booking) return false;
      latestBooking = result.booking;
      state.booking = latestBooking;
      setPendingSavedCustomerLanguage?.(nextCustomerLanguage);
      updateContentLangInUrl?.(nextCustomerLanguage);
    }

    const nextSourceChannel = normalizeText(draft.source_channel).toLowerCase() || "other";
    const nextReferralKind = normalizeText(draft.referral_kind).toLowerCase() || "none";
    const nextReferralLabel = nextReferralKind === "b2b_partner" || nextReferralKind === "other_customer"
      ? normalizeText(draft.referral_label) || null
      : null;
    const nextReferralStaffUserId = nextReferralKind === "atp_staff"
      ? normalizeText(draft.referral_staff_user_id) || null
      : null;
    const nextDestinations = normalizeCodeArray(draft.destinations);
    const nextTravelStyles = normalizeTravelStyleArray(draft.travel_styles);
    const nextPdfPersonalization = normalizePdfPersonalization(draft.pdf_personalization);
    if (
      nextSourceChannel !== (normalizeText(latestBooking.source_channel).toLowerCase() || "other")
      || nextReferralKind !== (normalizeText(latestBooking.referral_kind).toLowerCase() || "none")
      || nextReferralLabel !== (normalizeText(latestBooking.referral_label) || null)
      || nextReferralStaffUserId !== (normalizeText(latestBooking.referral_staff_user_id) || null)
      || JSON.stringify(nextDestinations) !== JSON.stringify(bookingDestinations(latestBooking))
      || JSON.stringify(nextTravelStyles) !== JSON.stringify(normalizeTravelStyleArray(latestBooking.travel_styles))
      || JSON.stringify(nextPdfPersonalization) !== JSON.stringify(normalizePdfPersonalization(latestBooking.pdf_personalization))
    ) {
      const request = bookingSourceRequest({ baseURL: apiOrigin, params: { booking_id: latestBooking.id } });
      const result = await fetchBookingMutation(request.url, {
        method: request.method,
        body: {
          expected_core_revision: Number(latestBooking.core_revision || 0),
          source_channel: nextSourceChannel,
          referral_kind: nextReferralKind,
          referral_label: nextReferralLabel,
          referral_staff_user_id: nextReferralStaffUserId,
          destinations: nextDestinations,
          travel_styles: nextTravelStyles,
          pdf_personalization: nextPdfPersonalization,
          actor: state.user
        }
      });
      if (!result?.booking) return false;
      latestBooking = result.booking;
      state.booking = latestBooking;
    }

    const nextMilestoneActionKey = normalizeText(draft.milestone_action_key).toUpperCase();
    if (nextMilestoneActionKey && nextMilestoneActionKey !== savedMilestoneActionKey(latestBooking)) {
      const request = bookingMilestoneActionRequest({
        baseURL: apiOrigin,
        params: { booking_id: latestBooking.id }
      });
      const result = await fetchBookingMutation(request.url, {
        method: request.method,
        body: {
          expected_core_revision: Number(latestBooking.core_revision || 0),
          action: nextMilestoneActionKey,
          actor: state.user
        }
      });
      if (!result?.booking) return false;
      latestBooking = result.booking;
      state.booking = latestBooking;
    }

    setBookingSectionDirty("core", false);
    syncCoreDraftFromBooking({ force: true });
    renderBookingHeader();
    renderBookingData();
    renderActionControls();
    renderPersonsEditor();
    return true;
  }

  async function recordBookingMilestoneAction(actionKey) {
    if (!state.permissions.canChangeStage || !state.booking) return false;
    const normalizedAction = normalizeText(actionKey).toUpperCase();
    if (!BOOKING_MILESTONE_ACTION_BY_KEY[normalizedAction]) return false;
    ensureCoreDraft().milestone_action_key = normalizedAction;
    updateCoreDirtyState();
    renderActionControls();
    return true;
  }

  async function saveNoteEdits() {
    if (!state.permissions.canEditBooking || !state.booking || !els.noteInput) return true;
    updateNoteSaveButtonState();
    if (!state.dirty.note) return true;
    const request = bookingNotesRequest({ baseURL: apiOrigin, params: { booking_id: state.booking.id } });
    const result = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_notes_revision: getBookingRevision("notes_revision"),
        notes: normalizeText(ensureCoreDraft().notes) || "",
        actor: state.user
      }
    });
    if (!result?.booking) return false;
    state.booking = result.booking;
    setBookingSectionDirty("note", false);
    syncCoreDraftFromBooking({ force: true });
    renderBookingHeader();
    renderBookingData();
    renderActionControls();
    renderPersonsEditor();
    return true;
  }

  function startBookingTitleEdit() {
    if (!state.permissions.canEditBooking || !els.title || !els.titleInput) return;
    titleEditStartValue = normalizeText(ensureCoreDraft().name) || normalizeText(state.booking?.name) || "";
    els.title.hidden = true;
    els.titleInput.hidden = false;
    els.titleInput.value = titleEditStartValue || els.title.textContent || "";
    window.requestAnimationFrame(() => {
      els.titleInput.focus();
      const length = els.titleInput.value.length;
      try {
        els.titleInput.setSelectionRange(length, length);
      } catch {
        // Ignore browsers that do not support explicit caret placement here.
      }
    });
  }

  function stopBookingTitleEdit() {
    if (!els.title || !els.titleInput) return;
    els.title.hidden = false;
    els.titleInput.hidden = true;
  }

  function commitBookingTitleEdit() {
    if (!els.titleInput || els.titleInput.hidden) return;
    ensureCoreDraft().name = normalizeText(els.titleInput.value) || "";
    updateCoreDirtyState();
    stopBookingTitleEdit();
  }

  function handleBookingTitleInputKeydown(event) {
    if (!(event.target instanceof HTMLInputElement)) return;
    if (event.key === "Enter") {
      event.preventDefault();
      commitBookingTitleEdit();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      ensureCoreDraft().name = titleEditStartValue;
      event.target.value = titleEditStartValue;
      updateCoreDirtyState();
      stopBookingTitleEdit();
    }
  }

  function applyBookingPayload(payload = {}, options = {}) {
    const previousTourId = normalizeText(state.booking?.web_form_submission?.tour_id);
    if (payload?.booking) {
      state.latestActivityAt = "";
    }
    state.booking = payload.booking || state.booking || null;
    syncCoreDraftFromBooking({ force: options.forceDraftReset === true });
    const nextTourId = normalizeText(state.booking?.web_form_submission?.tour_id);
    if (normalizeText(state.booking?.image)) {
      state.tour_image = "";
      state.tour_image_tour_id = "";
    } else if (nextTourId !== previousTourId) {
      state.tour_image = "";
      state.tour_image_tour_id = "";
    }
  }

  function getSubmittedContact(booking) {
    const submission = booking?.web_form_submission || {};
    return {
      name: normalizeText(submission.name) || "",
      email: normalizeText(submission.email) || "",
      phone_number: normalizeText(submission.phone_number) || ""
    };
  }

  function getPrimaryContact(booking) {
    const persons = ctx.getBookingPersons(booking);
    return persons.find((person) => person.roles.includes("primary_contact")) || persons[0] || null;
  }

  function shouldUseDiscoveryCallFallbackImage(booking) {
    if (!booking) return false;
    if (normalizeText(booking.image)) return false;
    if (normalizeText(booking?.web_form_submission?.tour_id)) return false;
    return Boolean(normalizeText(booking?.web_form_submission?.page_url));
  }

  return {
    closeBookingDetailScreen,
    renderBookingHeader,
    renderBookingData,
    renderActionControls,
    ensureTourImageLoaded,
    handleBookingDetailKeydown,
    triggerBookingPhotoPicker,
    uploadBookingPhoto,
    updateCoreDirtyState,
    updateNoteSaveButtonState,
    saveCoreEdits,
    saveNoteEdits,
    startBookingTitleEdit,
    commitBookingTitleEdit,
    handleBookingTitleInputKeydown,
    copyHeroIdToClipboard,
    deleteBooking,
    cloneBooking,
    recordBookingMilestoneAction,
    applyBookingPayload
  };
}
