import {
  bookingCustomerLanguageRequest,
  bookingDeleteRequest,
  bookingImageRequest,
  bookingMilestoneActionRequest,
  bookingNameRequest,
  bookingNotesRequest,
  bookingOwnerRequest,
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
    stage: "NEW",
    labelKey: "booking.milestone.action.new_booking",
    labelFallback: "New booking"
  }),
  Object.freeze({
    key: "TRAVEL_PLAN_SENT",
    field: "travel_plan_sent_at",
    stage: "QUALIFIED",
    labelKey: "booking.milestone.action.travel_plan_sent",
    labelFallback: "Travel plan sent to customer"
  }),
  Object.freeze({
    key: "OFFER_SENT",
    field: "offer_sent_at",
    stage: "PROPOSAL_SENT",
    labelKey: "booking.milestone.action.offer_sent",
    labelFallback: "Offer sent to customer"
  }),
  Object.freeze({
    key: "NEGOTIATION_STARTED",
    field: "negotiation_started_at",
    stage: "NEGOTIATION",
    labelKey: "booking.milestone.action.negotiation_started",
    labelFallback: "Negotiation started"
  }),
  Object.freeze({
    key: "DEPOSIT_REQUEST_SENT",
    field: "deposit_request_sent_at",
    stage: "INVOICE_SENT",
    labelKey: "booking.milestone.action.deposit_request_sent",
    labelFallback: "Deposit request sent"
  }),
  Object.freeze({
    key: "DEPOSIT_RECEIVED",
    field: "deposit_received_at",
    stage: "PAYMENT_RECEIVED",
    labelKey: "booking.milestone.action.deposit_received",
    labelFallback: "Deposit received"
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
    stage: "POST_TRIP",
    labelKey: "booking.milestone.action.trip_completed",
    labelFallback: "Trip completed"
  })
]);

const BOOKING_MILESTONE_ACTION_BY_KEY = Object.freeze(
  Object.fromEntries(BOOKING_MILESTONE_ACTIONS.map((action) => [action.key, action]))
);

const BOOKING_STAGE_FALLBACKS = Object.freeze({
  NEW: Object.freeze({
    currentActionKey: "NEW_BOOKING"
  }),
  QUALIFIED: Object.freeze({
    currentActionKey: "TRAVEL_PLAN_SENT"
  }),
  PROPOSAL_SENT: Object.freeze({
    currentActionKey: "OFFER_SENT"
  }),
  NEGOTIATION: Object.freeze({
    currentActionKey: "NEGOTIATION_STARTED"
  }),
  INVOICE_SENT: Object.freeze({
    currentActionKey: "DEPOSIT_REQUEST_SENT"
  }),
  PAYMENT_RECEIVED: Object.freeze({
    currentActionKey: "DEPOSIT_RECEIVED"
  }),
  LOST: Object.freeze({
    currentActionKey: "BOOKING_LOST"
  }),
  POST_TRIP: Object.freeze({
    currentActionKey: "TRIP_COMPLETED"
  })
});

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
      savedMilestoneActionKey(state.booking)
    ]);
  }

  function coreSnapshotFromDraft() {
    const draft = ensureCoreDraft();
    return JSON.stringify([
      normalizeText(draft.name) || "",
      normalizeText(draft.assigned_keycloak_user_id) || "",
      normalizeBookingContentLang(draft.customer_language || "en"),
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
    return normalizeText(user?.staff_profile?.full_name)
      || normalizeText(user?.full_name)
      || normalizeText(fallbackProfile?.full_name)
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

    if (currentAction) {
      return {
        currentActionKey: currentAction.key,
        lastAction: currentTimestamp
          ? bookingT(
              "booking.milestone.last_action_at",
              "Last action: {action} on {date}",
              {
                action: milestoneActionLabel(currentAction.key),
                date: formatDateTime(currentTimestamp)
              }
            )
          : milestoneActionLabel(currentAction.key)
      };
    }

    const fallback = BOOKING_STAGE_FALLBACKS[normalizeText(booking?.stage).toUpperCase()] || BOOKING_STAGE_FALLBACKS.NEW;
    return {
      currentActionKey: fallback.currentActionKey,
      lastAction: ""
    };
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
      els.subtitle.textContent = `${bookingT("booking.id_short", "ID")}: ${shortId}`;
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
          staff_profile: (
            currentOwner?.staff_profile && typeof currentOwner.staff_profile === "object"
          )
            ? currentOwner.staff_profile
            : (
              normalizeText(state.booking?.assigned_atp_staff?.full_name)
                ? { full_name: normalizeText(state.booking.assigned_atp_staff.full_name) }
                : null
            )
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

    if (els.lastActionDetail) {
      const text = hasPendingMilestoneChange
        ? bookingT("booking.milestone.pending_action", "Unsaved status: {action}", {
            action: milestoneActionLabel(draftMilestoneActionKey)
          })
        : statusPresentation.lastAction;
      els.lastActionDetail.textContent = text;
      els.lastActionDetail.hidden = !text;
    }
    if (els.milestoneActions) {
      const buttons = BOOKING_MILESTONE_ACTIONS.map((action) => {
        const isCurrent = draftMilestoneActionKey === action.key;
        const classes = [
          "btn",
          "btn-ghost",
          "booking-milestone-actions__btn",
          isCurrent ? "booking-milestone-actions__btn--current" : ""
        ].filter(Boolean).join(" ");
        return `<button
          class="${classes}"
          type="button"
          data-booking-milestone-action="${escapeHtml(action.key)}"
          aria-pressed="${isCurrent ? "true" : "false"}"
          ${state.permissions.canChangeStage ? "" : " disabled"}
        >${escapeHtml(milestoneActionLabel(action.key))}</button>`;
      }).join("");
      els.milestoneActions.innerHTML = buttons;
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
    if (els.travelPlanItemLibraryModal?.hidden === false) return;
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
