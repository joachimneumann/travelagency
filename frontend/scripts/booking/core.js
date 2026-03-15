import {
  bookingDeleteRequest,
  bookingImageRequest,
  bookingNameRequest,
  bookingNotesRequest,
  bookingOwnerRequest,
  bookingStageRequest,
  tourDetailRequest
} from "../../Generated/API/generated_APIRequestFactory.js?v=f09b901159f7";
import { buildBookingSegmentHeaderMarkup, initializeBookingCollapsibles } from "./segment_headers.js?v=f09b901159f7";
import {
  bookingContentLanguageLabel,
  bookingT,
  normalizeBookingContentLang
} from "./i18n.js?v=f09b901159f7";

function labelizeKey(key) {
  return String(key || "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function webFormFieldLabel(key) {
  return bookingT(`booking.web_form.${key}`, labelizeKey(key));
}

function bookingStageLabel(stage) {
  const normalized = String(stage || "").trim().toLowerCase();
  return bookingT(
    `booking.stage.${normalized}`,
    String(stage || "")
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
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
    resolveApiUrl,
    resolvePersonPhotoSrc,
    resolveBookingImageSrc,
    displayKeycloakUser,
    resolveCurrentAuthKeycloakUser,
    setBookingSectionDirty,
    rerenderWhatsApp,
    renderPersonsEditor
  } = ctx;

  let heroCopyClipboardPoll = null;
  let heroCopiedValue = "";

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
    const fallbackHref = normalizeText(els.back?.href) || withBackendLang("/backend.html", { section: "bookings" });
    window.location.href = fallbackHref;
  }

  function renderBookingHeader() {
    if (!state.booking) return;
    const primaryContact = getPrimaryContact(state.booking);
    const title = normalizeText(state.booking.name) || primaryContact?.name || getSubmittedContact(state.booking)?.name || bookingT("booking.title", "Booking");
    if (els.title) els.title.textContent = title;
    if (els.titleInput && document.activeElement !== els.titleInput) {
      els.titleInput.value = title;
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
      summaryClassName: "booking-collapsible__summary--inline-pad-16",
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
        const summaryClassAttribute = summaryClassName ? ` booking-collapsible__summary ${summaryClassName}` : "booking-collapsible__summary";
        const rows = (section.entries || [])
          .map((entry) => `<tr><th>${escapeHtml(entry.key)}</th><td>${escapeHtml(String(entry.value || "-"))}</td></tr>`)
          .join("");
        return `
        <article class="booking-collapsible">
          <button class="${summaryClassAttribute.trim()}" type="button">${buildBookingSegmentHeaderMarkup({ primary: section.title })}</button>
          <div class="booking-collapsible__body">
            <div class="backend-table-wrap">
              <table class="backend-table"><tbody>${rows || '<tr><td colspan="2">-</td></tr>'}</tbody></table>
            </div>
          </div>
        </article>
      `;
      })
      .join("");
    els.booking_data_view.innerHTML = html;
    initializeBookingCollapsibles(els.booking_data_view);
  }

  function renderActionControls() {
    if (!state.booking) return;

    if (els.stageSelect) {
      const options = ctx.stages.map((stage) => `<option value="${escapeHtml(stage)}">${escapeHtml(bookingStageLabel(stage))}</option>`).join("");
      els.stageSelect.innerHTML = options;
      els.stageSelect.value = state.booking.stage || ctx.stages[0];
    }

    if (els.ownerSelect) {
      const currentOwnerId = normalizeText(state.booking.assigned_keycloak_user_id);
      const knownOwners = new Map((state.keycloakUsers || []).map((user) => [String(user.id || ""), user]));
      const currentOwner = knownOwners.get(currentOwnerId) || resolveCurrentAuthKeycloakUser(currentOwnerId);
      const currentOwnerName = displayKeycloakUser(currentOwner) || currentOwnerId;
      if (currentOwnerId && currentOwnerName && !knownOwners.has(currentOwnerId)) {
        knownOwners.set(currentOwnerId, {
          id: currentOwnerId,
          name: displayKeycloakUser(currentOwner) || currentOwnerId,
          username: normalizeText(currentOwner?.username) || null
        });
      }

      const options = state.permissions.canChangeAssignment
        ? [`<option value="">${escapeHtml(bookingT("common.unassigned", "Unassigned"))}</option>`]
            .concat([...knownOwners.values()].map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(displayKeycloakUser(user) || user.id)}</option>`))
            .join("")
        : currentOwnerId
          ? `<option value="${escapeHtml(currentOwnerId)}">${escapeHtml(currentOwnerName || bookingT("booking.assigned_user", "Assigned user"))}</option>`
          : `<option value="">${escapeHtml(bookingT("common.unassigned", "Unassigned"))}</option>`;
      els.ownerSelect.innerHTML = options;
      els.ownerSelect.value = currentOwnerId || "";
      els.ownerSelect.disabled = !state.permissions.canChangeAssignment;
    }

    if (els.stageSelect) els.stageSelect.disabled = !state.permissions.canChangeStage;
    if (els.noteInput) {
      els.noteInput.disabled = !state.permissions.canEditBooking;
      els.noteInput.value = state.booking.notes || "";
    }
    state.originalNote = String(state.booking.notes || "");
    if (els.noteSaveBtn) {
      els.noteSaveBtn.style.display = state.permissions.canEditBooking ? "" : "none";
      updateNoteSaveButtonState();
    }
    if (els.invoice_create_btn) els.invoice_create_btn.style.display = state.permissions.canEditBooking ? "" : "none";
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
    if (!els.titleInput?.hidden) return;
    if (event.target === els.titleInput) return;
    event.preventDefault();
    closeBookingDetailScreen();
  }

  function triggerBookingPhotoPicker() {
    if (!state.permissions.canEditBooking) return;
    els.heroPhotoInput?.click();
  }

  async function uploadBookingPhoto() {
    if (!state.permissions.canEditBooking || !state.booking) return;
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
    if (!state.permissions.canEditBooking || !state.booking?.id) return;
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
    if (!els.noteSaveBtn || !els.noteInput) return;
    const current = normalizeText(els.noteInput.value);
    const original = normalizeText(state.originalNote);
    const isDirty = state.permissions.canEditBooking && current !== original;
    els.noteSaveBtn.disabled = !isDirty;
    setBookingSectionDirty("note", isDirty);
  }

  async function saveOwner() {
    if (!state.permissions.canChangeAssignment || !state.booking || !els.ownerSelect) return;
    const nextAssignedKeycloakUserId = normalizeText(els.ownerSelect.value) || null;
    const currentAssignedKeycloakUserId = normalizeText(state.booking.assigned_keycloak_user_id) || null;
    if (nextAssignedKeycloakUserId === currentAssignedKeycloakUserId) return;

    const request = bookingOwnerRequest({ baseURL: apiOrigin, params: { booking_id: state.booking.id } });
    const result = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_core_revision: getBookingRevision("core_revision"),
        assigned_keycloak_user_id: nextAssignedKeycloakUserId,
        actor: state.user
      }
    });
    if (!result?.booking) {
      renderActionControls();
      return;
    }

    applyBookingPayload(result);
    renderBookingHeader();
    renderBookingData();
    renderActionControls();
    renderPersonsEditor();
  }

  async function saveStage() {
    if (!state.permissions.canChangeStage || !state.booking || !els.stageSelect) return;
    const nextStage = normalizeText(els.stageSelect.value).toUpperCase();
    const currentStage = normalizeText(state.booking.stage).toUpperCase();
    if (!nextStage || nextStage === currentStage) return;

    const request = bookingStageRequest({ baseURL: apiOrigin, params: { booking_id: state.booking.id } });
    const result = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_core_revision: getBookingRevision("core_revision"),
        stage: nextStage,
        actor: state.user
      }
    });
    if (!result?.booking) {
      renderActionControls();
      return;
    }

    applyBookingPayload(result);
    renderBookingHeader();
    renderBookingData();
    renderActionControls();
    renderPersonsEditor();
  }

  async function saveNote() {
    if (!state.permissions.canEditBooking || !state.booking || !els.noteInput) return;
    const nextNote = normalizeText(els.noteInput.value);
    const currentNote = normalizeText(state.originalNote);
    if (nextNote === currentNote) {
      updateNoteSaveButtonState();
      return;
    }

    const request = bookingNotesRequest({ baseURL: apiOrigin, params: { booking_id: state.booking.id } });
    const result = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_notes_revision: getBookingRevision("notes_revision"),
        notes: nextNote,
        actor: state.user
      }
    });
    if (!result?.booking) {
      if (els.noteInput) els.noteInput.value = state.originalNote || "";
      updateNoteSaveButtonState();
      return;
    }

    applyBookingPayload(result);
    renderBookingHeader();
    renderBookingData();
    renderActionControls();
    renderPersonsEditor();
  }

  async function saveBookingName(nextNameOverride = null) {
    if (!state.permissions.canEditBooking || !state.booking) return;
    const nextName = normalizeText(nextNameOverride ?? els.titleInput?.value) || "";
    const previousName = normalizeText(state.booking.name) || "";
    state.booking.name = nextName;
    renderBookingHeader();
    const request = bookingNameRequest({ baseURL: apiOrigin, params: { booking_id: state.booking.id } });
    const result = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_core_revision: getBookingRevision("core_revision"),
        name: nextName,
        actor: state.user
      }
    });
    if (!result?.booking) {
      state.booking.name = previousName;
      renderBookingHeader();
      return;
    }

    applyBookingPayload(result);
    renderBookingHeader();
    renderBookingData();
    renderActionControls();
    renderPersonsEditor();
    stopBookingTitleEdit();
  }

  function startBookingTitleEdit() {
    if (!state.permissions.canEditBooking || !els.title || !els.titleInput) return;
    els.title.hidden = true;
    els.titleInput.hidden = false;
    els.titleInput.value = normalizeText(state.booking?.name) || els.title.textContent || "";
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

  async function commitBookingTitleEdit() {
    if (!els.titleInput || els.titleInput.hidden) return;
    const currentName = normalizeText(state.booking?.name) || "";
    const nextName = normalizeText(els.titleInput.value) || "";
    if (nextName === currentName) {
      stopBookingTitleEdit();
      return;
    }
    stopBookingTitleEdit();
    await saveBookingName(nextName);
  }

  function handleBookingTitleInputKeydown(event) {
    if (!(event.target instanceof HTMLInputElement)) return;
    if (event.key === "Enter") {
      event.preventDefault();
      void commitBookingTitleEdit();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.target.value = normalizeText(state.booking?.name) || "";
      stopBookingTitleEdit();
    }
  }

  function applyBookingPayload(payload = {}) {
    const previousTourId = normalizeText(state.booking?.web_form_submission?.tour_id);
    state.booking = payload.booking || state.booking || null;
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

  return {
    closeBookingDetailScreen,
    renderBookingHeader,
    renderBookingData,
    renderActionControls,
    ensureTourImageLoaded,
    handleBookingDetailKeydown,
    triggerBookingPhotoPicker,
    uploadBookingPhoto,
    updateNoteSaveButtonState,
    saveOwner,
    saveStage,
    saveNote,
    startBookingTitleEdit,
    commitBookingTitleEdit,
    handleBookingTitleInputKeydown,
    copyHeroIdToClipboard,
    deleteBooking,
    applyBookingPayload
  };
}
