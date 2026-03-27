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
  bookingContentLanguageLabel,
  bookingT,
  normalizeBookingContentLang
} from "./i18n.js";

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
  ["other", "Other"],
  ["website", "Website"],
  ["email", "Email"],
  ["whatsapp", "WhatsApp"],
  ["facebook_messenger", "Facebook Messenger"],
  ["google_maps", "Google Maps"],
  ["instagram", "Instagram"],
  ["phone_call", "Phone call"],
  ["walk_in", "Walk-in"],
  ["zalo", "Zalo"]
]);

const BOOKING_REFERRAL_KIND_OPTIONS = Object.freeze([
  ["none", "No referral"],
  ["other_customer", "Other customer"],
  ["b2b_partner", "B2B partner"],
  ["atp_staff", "ATP staff"]
]);

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
    setBookingSectionDirty,
    hasUnsavedBookingChanges,
    reportPersistedActionBlocked,
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
    const fallbackHref = normalizeText(els.back?.href) || withBackendLang("/backend.html", { section: "bookings" });
    window.location.href = fallbackHref;
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
    }
    if (force || !state.dirty.note) {
      draft.notes = normalizeText(state.booking.notes) || "";
      state.originalNote = draft.notes;
    }
    return draft;
  }

  function coreSnapshotFromBooking() {
    return JSON.stringify([
      normalizeText(state.booking?.name) || "",
      normalizeText(state.booking?.assigned_keycloak_user_id) || "",
      savedCustomerLanguage(state.booking),
      normalizeText(state.booking?.source_channel).toLowerCase() || "other",
      normalizeText(state.booking?.referral_kind).toLowerCase() || "none",
      normalizeText(state.booking?.referral_label) || "",
      normalizeText(state.booking?.referral_staff_user_id) || "",
      savedMilestoneActionKey(state.booking)
    ]);
  }

  function coreSnapshotFromDraft() {
    const draft = ensureCoreDraft();
    return JSON.stringify([
      normalizeText(draft.name) || "",
      normalizeText(draft.assigned_keycloak_user_id) || "",
      normalizeBookingContentLang(draft.customer_language || "en"),
      normalizeText(draft.source_channel).toLowerCase() || "other",
      normalizeText(draft.referral_kind).toLowerCase() || "none",
      normalizeText(draft.referral_label) || "",
      normalizeText(draft.referral_staff_user_id) || "",
      normalizeText(draft.milestone_action_key).toUpperCase()
    ]);
  }

  function updateCoreDirtyState() {
    if (!state.permissions.canEditBooking) {
      setBookingSectionDirty("core", false);
      return false;
    }
    const draft = ensureCoreDraft();
    if (els.titleInput) draft.name = normalizeText(els.titleInput.value) || "";
    if (els.ownerSelect) draft.assigned_keycloak_user_id = normalizeText(els.ownerSelect.value) || "";
    if (els.sourceChannelSelect) draft.source_channel = normalizeText(els.sourceChannelSelect.value).toLowerCase() || "other";
    if (els.referralKindSelect) draft.referral_kind = normalizeText(els.referralKindSelect.value).toLowerCase() || "none";
    if (els.referralLabelInput) draft.referral_label = normalizeText(els.referralLabelInput.value) || "";
    if (els.referralStaffSelect) draft.referral_staff_user_id = normalizeText(els.referralStaffSelect.value) || "";
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
    const isDirty = state.booking ? coreSnapshotFromDraft() !== coreSnapshotFromBooking() : false;
    setBookingSectionDirty("core", isDirty);
    return isDirty;
  }

  function milestoneActionLabel(actionKey) {
    const meta = BOOKING_MILESTONE_ACTION_BY_KEY[normalizeText(actionKey).toUpperCase()];
    if (!meta) return "";
    return bookingT(meta.labelKey, meta.labelFallback);
  }

  function resolveAtpStaffDisplayName(user, fallbackProfile = null) {
    return normalizeText(fallbackProfile?.full_name)
      || normalizeText(user?.full_name)
      || displayKeycloakUser(user)
      || normalizeText(fallbackProfile?.name)
      || normalizeText(user?.name)
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
      const lastActionAt = normalizeText(state.booking?.last_action_at)
        || normalizeText(state.booking?.updated_at);
      const relativeLastAction = formatRelativeActionTime(lastActionAt);
      const idNode = document.getElementById("detail_sub_title_id");
      const updatedNode = document.getElementById("detail_sub_title_updated");
      if (idNode && updatedNode) {
        idNode.textContent = `${bookingT("booking.id_short", "ID")}: ${shortId}`;
        updatedNode.textContent = relativeLastAction
          ? `· ${bookingT("booking.last_updated", "last updated")} ${relativeLastAction}`
          : "";
      } else {
        els.subtitle.textContent = relativeLastAction
          ? `${bookingT("booking.id_short", "ID")}: ${shortId} · ${bookingT("booking.last_updated", "last updated")} ${relativeLastAction}`
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
        .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
        .join("");
      els.sourceChannelSelect.value = normalizeText(draft.source_channel).toLowerCase() || "other";
      els.sourceChannelSelect.disabled = !state.permissions.canEditBooking;
    }

    if (els.referralKindSelect) {
      els.referralKindSelect.innerHTML = BOOKING_REFERRAL_KIND_OPTIONS
        .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
        .join("");
      els.referralKindSelect.value = normalizeText(draft.referral_kind).toLowerCase() || "none";
      els.referralKindSelect.disabled = !state.permissions.canEditBooking;
    }

    const referralKind = normalizeText(draft.referral_kind).toLowerCase() || "none";
    const showReferralLabel = referralKind === "b2b_partner" || referralKind === "other_customer";
    const showReferralStaff = referralKind === "atp_staff";
    if (els.referralDetailRow) els.referralDetailRow.hidden = !(showReferralLabel || showReferralStaff);
    if (els.referralLabelField) els.referralLabelField.hidden = !showReferralLabel;
    if (els.referralStaffField) els.referralStaffField.hidden = !showReferralStaff;
    if (els.referralLabelLabel) {
      els.referralLabelLabel.textContent = referralKind === "other_customer"
        ? bookingT("booking.referral.customer_name", "Customer name")
        : bookingT("booking.referral.partner_name", "Partner name");
    }
    if (els.referralLabelHint) {
      els.referralLabelHint.textContent = referralKind === "other_customer"
        ? bookingT("booking.referral.customer_hint", "Shown only when the booking was referred by another customer.")
        : bookingT("booking.referral.partner_hint", "Shown only when the booking was referred by a B2B partner.");
    }
    if (els.referralLabelInput) {
      if (document.activeElement !== els.referralLabelInput) {
        els.referralLabelInput.value = normalizeText(draft.referral_label) || "";
      }
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
    updateCoreDirtyState();
    updateNoteSaveButtonState();
    if (els.deleteBtn) {
      els.deleteBtn.style.display = state.permissions.canEditBooking ? "" : "none";
      els.deleteBtn.disabled = !state.permissions.canEditBooking;
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

    window.location.href = withBackendLang("/backend.html", { section: "bookings" });
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
    if (
      nextSourceChannel !== (normalizeText(latestBooking.source_channel).toLowerCase() || "other")
      || nextReferralKind !== (normalizeText(latestBooking.referral_kind).toLowerCase() || "none")
      || nextReferralLabel !== (normalizeText(latestBooking.referral_label) || null)
      || nextReferralStaffUserId !== (normalizeText(latestBooking.referral_staff_user_id) || null)
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
    recordBookingMilestoneAction,
    applyBookingPayload
  };
}
