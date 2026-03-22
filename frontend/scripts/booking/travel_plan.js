import {
  bookingTravelPlanRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import { logBrowserConsoleError } from "../shared/api.js";
import {
  bookingContentLang,
  bookingContentLanguageOption,
  bookingT
} from "./i18n.js";
import { formatMoneyDisplay } from "./pricing.js";
import { renderBookingSectionHeader } from "./sections.js";
import {
  buildDualLocalizedPayload,
  renderLocalizedStackedField,
  requestBookingFieldTranslation,
  resolveLocalizedEditorBranchText
} from "./localized_editor.js";
import {
  TRAVEL_PLAN_OFFER_COVERAGE_TYPE_OPTIONS,
  TRAVEL_PLAN_ITEM_KIND_OPTIONS
} from "../shared/generated_catalogs.js";
import {
  countTravelPlanItems,
  countUncoveredTravelPlanItems,
  createEmptyTravelPlan,
  createEmptyTravelPlanDay,
  createEmptyTravelPlanOfferComponentLink,
  createEmptyTravelPlanItem,
  getLinkableOfferComponents,
  TRAVEL_PLAN_TIMING_KIND_OPTIONS,
  getTravelPlanItemCoverageStatus,
  normalizeTravelPlanDraft
} from "./travel_plan_helpers.js";
import {
  applyTravelPlanDatePickerValue as applyTravelPlanDatePickerValueImpl,
  combineDateAndTime as combineDateAndTimeImpl,
  deriveNextTravelPlanDayDate as deriveNextTravelPlanDayDateImpl,
  openTravelPlanDatePicker as openTravelPlanDatePickerImpl,
  renderTravelPlanDateInput as renderTravelPlanDateInputImpl,
  splitDateTimeValue as splitDateTimeValueImpl,
  validateTravelPlanDateFieldsInDom as validateTravelPlanDateFieldsInDomImpl,
  validateTravelPlanDateTextInput as validateTravelPlanDateTextInputImpl,
  isValidIsoCalendarDate as isValidIsoCalendarDateImpl
} from "./travel_plan_dates.js";
import { validateTravelPlanDraft as validateTravelPlanDraftState } from "./travel_plan_validation.js";
import { createBookingTravelPlanImagesModule } from "./travel_plan_images.js";
import { createBookingTravelPlanItemLibraryModule } from "./travel_plan_item_library.js";

export function createBookingTravelPlanModule(ctx) {
  const {
    state,
    els,
    apiOrigin,
    fetchBookingMutation,
    getBookingRevision,
    renderBookingHeader,
    renderBookingData,
    loadActivities,
    escapeHtml,
    setBookingSectionDirty
  } = ctx;

  function findDraftDay(dayId) {
    return (Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : []).find((day) => day.id === dayId) || null;
  }

  function findDraftItem(dayId, itemId) {
    const day = findDraftDay(dayId);
    return (Array.isArray(day?.items) ? day.items : []).find((item) => item.id === itemId) || null;
  }

  function applyTravelPlanMutationBooking(booking) {
    if (!booking) return;
    state.booking = booking;
    renderBookingHeader();
    renderBookingData();
    applyBookingPayload();
    renderTravelPlanPanel();
  }

  function travelPlanStatus(message, type = "info") {
    if (!els.travel_plan_status) return;
    els.travel_plan_status.textContent = message;
    els.travel_plan_status.classList.remove(
      "booking-inline-status--error",
      "booking-inline-status--success",
      "booking-inline-status--info"
    );
    if (!message) return;
    const normalizedType = type === "error" || type === "success" ? type : "info";
    els.travel_plan_status.classList.add(`booking-inline-status--${normalizedType}`);
  }

  function validateTravelPlanDraft(plan) {
    return validateTravelPlanDraftState(plan, {
      getOfferComponentsForLinks,
      validTimingKinds: new Set(TRAVEL_PLAN_TIMING_KIND_OPTIONS.map((option) => option.value)),
      validItemKinds: new Set(TRAVEL_PLAN_ITEM_KIND_OPTIONS.map((option) => option.value)),
      validCoverageTypes: new Set(TRAVEL_PLAN_OFFER_COVERAGE_TYPE_OPTIONS.map((option) => option.value)),
      splitDateTimeValue,
      isValidIsoCalendarDate
    });
  }

  function getOfferComponentsForLinks() {
    return getLinkableOfferComponents(state.booking?.offer?.components || []);
  }

  function setTravelPlanDirty(isDirty) {
    state.travelPlanDirty = Boolean(isDirty) && state.permissions.canEditBooking;
    setBookingSectionDirty("travel_plan", state.travelPlanDirty);
  }

  function buildTravelPlanPayload(plan = state.travelPlanDraft) {
    return normalizeTravelPlanDraft({
      ...plan,
      offer_component_links: (Array.isArray(plan?.offer_component_links) ? plan.offer_component_links : [])
        .filter((link) => String(link?.offer_component_id || "").trim())
    }, getOfferComponentsForLinks());
  }

  function getTravelPlanSnapshot(plan = state.travelPlanDraft) {
    return JSON.stringify(normalizeTravelPlanDraft(plan, getOfferComponentsForLinks()));
  }

  function updateTravelPlanDirtyState() {
    state.travelPlanDraft = normalizeTravelPlanDraft(state.travelPlanDraft, getOfferComponentsForLinks());
    const isDirty = getTravelPlanSnapshot() !== state.originalTravelPlanSnapshot;
    setTravelPlanDirty(isDirty);
    if (isDirty) {
      travelPlanStatus("");
    }
  }

  async function ensureTravelPlanReadyForMutation() {
    if (!state.permissions.canEditBooking || !state.booking?.id) return false;
    if (!state.travelPlanDirty) return true;
    travelPlanStatus("Save edits to enable.", "info");
    return false;
  }

  async function finalizeTravelPlanMutation(result, successMessage) {
    if (!result?.booking) return false;
    applyTravelPlanMutationBooking(result.booking);
    await loadActivities();
    travelPlanStatus(successMessage, "success");
    return true;
  }

  function applyBookingPayload() {
    state.travelPlanDraft = normalizeTravelPlanDraft(state.booking?.travel_plan || createEmptyTravelPlan(), getOfferComponentsForLinks());
    state.originalTravelPlanSnapshot = getTravelPlanSnapshot(state.travelPlanDraft);
    setTravelPlanDirty(false);
    travelPlanStatus("");
    travelPlanItemLibraryModule.populateTravelPlanItemLibraryKindOptions();
  }

  function resolveLocalizedDraftBranchText(map, lang = "en", fallback = "") {
    return resolveLocalizedEditorBranchText(map, lang, fallback);
  }

  function renderTravelPlanLocalizedField({ label, idBase, dataScope, dayId = "", itemId = "", field, type = "input", rows = 3, englishValue = "", localizedValue = "" }) {
    return renderLocalizedStackedField({
      escapeHtml,
      idBase,
      label,
      type,
      rows,
      targetLang: bookingContentLang(),
      disabled: !state.permissions.canEditBooking,
      translateEnabled: Boolean(state.booking?.translation_enabled),
      englishValue,
      localizedValue,
      commonData: {
        [dataScope]: field,
        ...(dayId ? { "travel-plan-day-id": dayId } : {}),
        ...(itemId ? { "travel-plan-item-id": itemId } : {})
      },
      translatePayload: {
        "travel-plan-translate": field,
        ...(dayId ? { "travel-plan-day-id": dayId } : {}),
        ...(itemId ? { "travel-plan-item-id": itemId } : {})
      }
    });
  }

  function formatTravelPlanDayHeading(dayIndex) {
    return bookingT("booking.travel_plan.day_heading", "Day {day}", { day: dayIndex + 1 });
  }

  const travelPlanImagesModule = createBookingTravelPlanImagesModule({
    state,
    els,
    apiOrigin,
    fetchBookingMutation,
    getBookingRevision,
    escapeHtml,
    ensureTravelPlanReadyForMutation,
    finalizeTravelPlanMutation,
    findDraftItem,
    applyTravelPlanMutationBooking,
    applyBookingPayload,
    loadActivities,
    travelPlanStatus
  });

  const travelPlanItemLibraryModule = createBookingTravelPlanItemLibraryModule({
    state,
    els,
    apiOrigin,
    fetchBookingMutation,
    getBookingRevision,
    escapeHtml,
    ensureTravelPlanReadyForMutation,
    finalizeTravelPlanMutation,
    findDraftDay,
    formatTravelPlanDayHeading
  });

  function isIsoDateString(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
  }

  function formatIsoLocalDate(date) {
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function nextIsoDate(value) {
    const raw = String(value || "").trim();
    if (!isIsoDateString(raw)) return "";
    const date = new Date(`${raw}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    date.setDate(date.getDate() + 1);
    return formatIsoLocalDate(date);
  }

  function deriveNextTravelPlanDayDate(days) {
    const items = Array.isArray(days) ? days : [];
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const candidate = nextIsoDate(items[index]?.date);
      if (candidate) return candidate;
    }
    return "";
  }

  function travelPlanSummary() {
    const days = Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days.length : 0;
    const items = countTravelPlanItems(state.travelPlanDraft);
    const uncovered = countUncoveredTravelPlanItems(state.travelPlanDraft);
    if (!days && !items) {
      return {
        primary: bookingT("booking.travel_plan", "Travel plan"),
        secondary: bookingT("booking.no_travel_plan", "No travel plan yet.")
      };
    }
    const secondary = [
      bookingT(
        days === 1 ? "booking.travel_plan.summary.day" : "booking.travel_plan.summary.days",
        days === 1 ? "{count} day" : "{count} days",
        { count: days }
      ),
      bookingT(
        items === 1 ? "booking.travel_plan.summary.item" : "booking.travel_plan.summary.items",
        items === 1 ? "{count} travel plan item" : "{count} travel plan items",
        { count: items }
      )
    ];
    if (uncovered > 0) secondary.push(bookingT("booking.travel_plan.summary.uncovered", "{count} uncovered", { count: uncovered }));
    return {
      primary: bookingT("booking.travel_plan", "Travel plan"),
      secondary: secondary.join(" · ")
    };
  }

  function coverageBadgeLabel(status) {
    switch (status) {
      case "covered":
        return bookingT("booking.travel_plan.coverage.covered", "Covered");
      case "partially_covered":
        return bookingT("booking.travel_plan.coverage.partially_covered", "Partially covered");
      case "not_applicable":
        return bookingT("booking.travel_plan.coverage.not_applicable", "Not applicable");
      case "not_covered":
      default:
        return bookingT("booking.travel_plan.coverage.not_covered", "Not covered");
    }
  }

  function offerComponentSelectOptions(selectedId = "") {
    const selected = String(selectedId || "").trim();
    const options = [`<option value="">${escapeHtml(bookingT("booking.travel_plan.select_offer_component", "Select offer component"))}</option>`];
    for (const component of getOfferComponentsForLinks()) {
      const labelParts = [];
      const category = String(component?.category || "").trim();
      const details = String(component?.details || component?.label || "").trim();
      if (category) labelParts.push(category.replace(/_/g, " ").toLowerCase());
      if (details) labelParts.push(details);
      labelParts.push(formatMoneyDisplay(component?.line_total_amount_cents || 0, component?.currency || state.booking?.offer?.currency || "USD"));
      options.push(
        `<option value="${escapeHtml(component.id)}"${component.id === selected ? " selected" : ""}>${escapeHtml(labelParts.join(" · "))}</option>`
      );
    }
    return options.join("");
  }

  function coverageTypeOptions(selectedValue = "full") {
    return TRAVEL_PLAN_OFFER_COVERAGE_TYPE_OPTIONS.map((option) => (
      `<option value="${escapeHtml(option.value)}"${option.value === selectedValue ? " selected" : ""}>${escapeHtml(bookingT(`booking.travel_plan.coverage_type.${option.value}`, option.label))}</option>`
    )).join("");
  }

  function itemKindOptions(selectedValue = "other") {
    return TRAVEL_PLAN_ITEM_KIND_OPTIONS.map((option) => (
      `<option value="${escapeHtml(option.value)}"${option.value === selectedValue ? " selected" : ""}>${escapeHtml(bookingT(`booking.travel_plan.kind.${option.value}`, option.label))}</option>`
    )).join("");
  }

  function timingKindOptions(selectedValue = "label") {
    return TRAVEL_PLAN_TIMING_KIND_OPTIONS.map((option) => (
      `<option value="${escapeHtml(option.value)}"${option.value === selectedValue ? " selected" : ""}>${escapeHtml(option.label)}</option>`
    )).join("");
  }

  function formatDateTimeLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function alignDateTimeLocalValue(value) {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
    if (!match) return raw;
    const date = new Date(`${match[1]}T${match[2]}:${match[3]}:00`);
    if (Number.isNaN(date.getTime())) return raw;
    date.setSeconds(0, 0);
    date.setMinutes(Math.round(date.getMinutes() / 5) * 5);
    return formatDateTimeLocal(date);
  }

  function toDateTimeLocalValue(dayDate, value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const isoDateTimeMatch = raw.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
    if (isoDateTimeMatch) return alignDateTimeLocalValue(isoDateTimeMatch[1]);
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(raw)) return alignDateTimeLocalValue(raw.replace(" ", "T"));
    if (/^\d{2}:\d{2}$/.test(raw) && String(dayDate || "").trim()) {
      return alignDateTimeLocalValue(`${String(dayDate).trim()}T${raw}`);
    }
    return "";
  }

  function splitDateTimeValue(dayDate, value) {
    const aligned = toDateTimeLocalValue(dayDate, value);
    const match = aligned.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/);
    if (!match) {
      return {
        date: String(dayDate || "").trim(),
        time: ""
      };
    }
    return {
      date: match[1],
      time: match[2]
    };
  }

  function combineDateAndTime(dateValue, timeValue) {
    const date = String(dateValue || "").trim();
    const time = String(timeValue || "").trim();
    if (!date || !time) return "";
    return alignDateTimeLocalValue(`${date}T${time}`);
  }

  function isValidIsoCalendarDate(value) {
    const normalized = String(value || "").trim();
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    return (
      candidate.getUTCFullYear() === year &&
      candidate.getUTCMonth() === month - 1 &&
      candidate.getUTCDate() === day
    );
  }

  function getTravelPlanDateValidationMessage(value, { allowPartial = false } = {}) {
    const normalized = String(value || "").trim();
    if (!normalized) return "";
    if (allowPartial && normalized.length < 10) return "";
    if (!isValidIsoCalendarDate(normalized)) {
      return bookingT("booking.travel_plan.date_invalid", "Use YYYY-MM-DD, for example 1963-08-20.");
    }
    return "";
  }

  function renderTravelPlanDateInput({ id, dataAttribute, value = "", disabled = false, ariaLabel = "" }) {
    return `
      <div class="booking-person-modal__date-input travel-plan-date-input">
        <input
          id="${escapeHtml(id)}"
          class="travel-plan-date-input__text"
          data-travel-plan-date-text="true"
          ${dataAttribute}
          type="text"
          inputmode="numeric"
          spellcheck="false"
          placeholder="YYYY-MM-DD"
          pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
          maxlength="10"
          value="${escapeHtml(value || "")}"
          ${disabled ? "disabled" : ""}
          ${ariaLabel ? `aria-label="${escapeHtml(ariaLabel)}"` : ""}
        />
        <button
          class="booking-person-modal__date-picker-btn travel-plan-date-input__picker-btn"
          data-travel-plan-date-picker-btn="${escapeHtml(id)}"
          type="button"
          aria-label="${escapeHtml(bookingT("booking.open_date_picker", "Open date picker"))}"
          ${disabled ? "disabled" : ""}
        >📅</button>
        <input
          id="${escapeHtml(`${id}_picker`)}"
          type="date"
          tabindex="-1"
          aria-hidden="true"
          class="booking-person-modal__date-picker-proxy"
          data-travel-plan-date-picker-for="${escapeHtml(id)}"
          ${disabled ? "disabled" : ""}
        />
      </div>
      <div class="error" data-travel-plan-date-error="${escapeHtml(id)}"></div>
    `;
  }

  function setTravelPlanDateFieldValidation(textInput, message) {
    const field = textInput?.closest(".field");
    if (field instanceof HTMLElement) field.classList.toggle("invalid", Boolean(message));
    const errorNode = field?.querySelector(`[data-travel-plan-date-error="${textInput?.id || ""}"]`);
    if (errorNode instanceof HTMLElement) {
      errorNode.textContent = message || "";
    }
  }

  function syncTravelPlanDatePickerValue(textInput, pickerInput) {
    if (!(textInput instanceof HTMLInputElement) || !(pickerInput instanceof HTMLInputElement)) return;
    const normalized = String(textInput.value || "").trim();
    pickerInput.value = isValidIsoCalendarDate(normalized) ? normalized : "";
  }

  function validateTravelPlanDateTextInput(textInput, { allowPartial = false } = {}) {
    if (!(textInput instanceof HTMLInputElement)) return true;
    const message = getTravelPlanDateValidationMessage(textInput.value, { allowPartial });
    setTravelPlanDateFieldValidation(textInput, message);
    const pickerInput = document.getElementById(`${textInput.id}_picker`);
    if (pickerInput instanceof HTMLInputElement) {
      syncTravelPlanDatePickerValue(textInput, pickerInput);
    }
    return !message;
  }

  function applyTravelPlanDatePickerValue(pickerInput) {
    if (!(pickerInput instanceof HTMLInputElement)) return null;
    const targetId = String(pickerInput.getAttribute("data-travel-plan-date-picker-for") || "").trim();
    const textInput = targetId ? document.getElementById(targetId) : null;
    if (!(textInput instanceof HTMLInputElement)) return null;
    textInput.value = String(pickerInput.value || "").trim();
    validateTravelPlanDateTextInput(textInput, { allowPartial: false });
    return textInput;
  }

  function openTravelPlanDatePicker(button) {
    const targetId = String(button?.getAttribute("data-travel-plan-date-picker-btn") || "").trim();
    const pickerInput = targetId ? document.getElementById(`${targetId}_picker`) : null;
    const textInput = targetId ? document.getElementById(targetId) : null;
    if (!(pickerInput instanceof HTMLInputElement) || pickerInput.disabled) return;
    if (textInput instanceof HTMLInputElement) {
      syncTravelPlanDatePickerValue(textInput, pickerInput);
    }
    if (typeof pickerInput.showPicker === "function") {
      try {
        pickerInput.showPicker();
        return;
      } catch (_) {
        // Fall through.
      }
    }
    pickerInput.focus();
    pickerInput.click();
  }

  function validateTravelPlanDateFieldsInDom({ allowPartial = false, focusFirstInvalid = false } = {}) {
    if (!els.travel_plan_editor) return { ok: true, message: "" };
    const dateInputs = Array.from(els.travel_plan_editor.querySelectorAll('[data-travel-plan-date-text="true"]'));
    let firstInvalid = null;
    for (const textInput of dateInputs) {
      const isValid = validateTravelPlanDateTextInput(textInput, { allowPartial });
      if (!isValid && !firstInvalid) {
        firstInvalid = textInput;
      }
    }
    if (focusFirstInvalid && firstInvalid instanceof HTMLInputElement) {
      firstInvalid.focus();
    }
    return {
      ok: !firstInvalid,
      message: firstInvalid
        ? getTravelPlanDateValidationMessage(firstInvalid.value, { allowPartial: false })
        : ""
    };
  }

  function timeSelectOptions(selectedValue = "") {
    const selected = String(selectedValue || "").trim();
    const options = ['<option value=""></option>'];
    for (let hour = 0; hour < 24; hour += 1) {
      for (let minute = 0; minute < 60; minute += 5) {
        const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        options.push(`<option value="${value}"${value === selected ? " selected" : ""}>${value}</option>`);
      }
    }
    return options.join("");
  }

  function renderTravelPlanTimingFields(day, item) {
    const timingKind = String(item?.timing_kind || "label");
    if (timingKind === "point") {
      const pointParts = splitDateTimeValue(day?.date, item.time_point);
      return `
        <div class="field">
          <label for="travel_plan_timing_kind_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.time_information", "Time information"))}</label>
          <select id="travel_plan_timing_kind_${escapeHtml(item.id)}" data-travel-plan-item-field="timing_kind">
            ${timingKindOptions(timingKind)}
          </select>
        </div>
        <div class="field">
          <label for="travel_plan_time_point_date_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.date", "Date"))}</label>
          ${renderTravelPlanDateInput({
            id: `travel_plan_time_point_date_${item.id}`,
            dataAttribute: 'data-travel-plan-item-field="time_point_date"',
            value: pointParts.date,
            disabled: !state.permissions.canEditBooking,
            ariaLabel: bookingT("booking.date", "Date")
          })}
        </div>
        <div class="field">
          <label for="travel_plan_time_point_time_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.time", "Time"))}</label>
          <select id="travel_plan_time_point_time_${escapeHtml(item.id)}" data-travel-plan-item-field="time_point_time">
            ${timeSelectOptions(pointParts.time)}
          </select>
        </div>
      `;
    }
    if (timingKind === "range") {
      const startParts = splitDateTimeValue(day?.date, item.start_time);
      const endParts = splitDateTimeValue(day?.date, item.end_time);
      return `
        <div class="field">
          <label for="travel_plan_timing_kind_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.time_information", "Time information"))}</label>
          <select id="travel_plan_timing_kind_${escapeHtml(item.id)}" data-travel-plan-item-field="timing_kind">
            ${timingKindOptions(timingKind)}
          </select>
        </div>
        <div class="field">
          <label for="travel_plan_start_time_date_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.start_date", "Start date"))}</label>
          ${renderTravelPlanDateInput({
            id: `travel_plan_start_time_date_${item.id}`,
            dataAttribute: 'data-travel-plan-item-field="start_time_date"',
            value: startParts.date,
            disabled: !state.permissions.canEditBooking,
            ariaLabel: bookingT("booking.travel_plan.start_date", "Start date")
          })}
        </div>
        <div class="field">
          <label for="travel_plan_start_time_time_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.start_time", "Start time"))}</label>
          <select id="travel_plan_start_time_time_${escapeHtml(item.id)}" data-travel-plan-item-field="start_time_time">
            ${timeSelectOptions(startParts.time)}
          </select>
        </div>
        <div class="field">
          <label for="travel_plan_end_time_date_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.end_date", "End date"))}</label>
          ${renderTravelPlanDateInput({
            id: `travel_plan_end_time_date_${item.id}`,
            dataAttribute: 'data-travel-plan-item-field="end_time_date"',
            value: endParts.date,
            disabled: !state.permissions.canEditBooking,
            ariaLabel: bookingT("booking.travel_plan.end_date", "End date")
          })}
        </div>
        <div class="field">
          <label for="travel_plan_end_time_time_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.end_time", "End time"))}</label>
          <select id="travel_plan_end_time_time_${escapeHtml(item.id)}" data-travel-plan-item-field="end_time_time">
            ${timeSelectOptions(endParts.time)}
          </select>
        </div>
      `;
    }
    return `
      <div class="field">
        <label for="travel_plan_timing_kind_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.time_information", "Time information"))}</label>
        <select id="travel_plan_timing_kind_${escapeHtml(item.id)}" data-travel-plan-item-field="timing_kind">
          ${timingKindOptions(timingKind)}
        </select>
      </div>
      <div class="field">
        ${renderTravelPlanLocalizedField({
          label: bookingT("booking.travel_plan.human_readable_time", "Human readable time"),
          idBase: `travel_plan_time_${item.id}`,
          dataScope: "travel-plan-item-field",
          dayId: day.id,
          itemId: item.id,
          field: "time_label",
          type: "input",
          englishValue: resolveLocalizedDraftBranchText(item.time_label_i18n ?? item.time_label, "en", ""),
          localizedValue: resolveLocalizedDraftBranchText(item.time_label_i18n ?? item.time_label, bookingContentLang(), "")
        })}
      </div>
    `;
  }

  function renderTravelPlanLinkRows(itemId) {
    const itemLinks = (Array.isArray(state.travelPlanDraft?.offer_component_links) ? state.travelPlanDraft.offer_component_links : [])
      .filter((link) => link.travel_plan_item_id === itemId);

    if (!itemLinks.length) {
      return `
        <div class="travel-plan-link-empty">
          ${getOfferComponentsForLinks().length
            ? escapeHtml(bookingT("booking.travel_plan.no_linked_components", "No linked offer components yet."))
            : escapeHtml(bookingT("booking.travel_plan.save_offer_first", "Save offer components first to link financial coverage."))}
        </div>
      `;
    }

    return itemLinks.map((link) => `
      <div class="travel-plan-link-row" data-travel-plan-link="${escapeHtml(link.id)}">
        <select data-travel-plan-link-component="${escapeHtml(link.id)}">
          ${offerComponentSelectOptions(link.offer_component_id)}
        </select>
        <select data-travel-plan-link-coverage-type="${escapeHtml(link.id)}">
          ${coverageTypeOptions(link.coverage_type)}
        </select>
        <button class="btn btn-ghost offer-remove-btn" data-travel-plan-remove-link="${escapeHtml(link.id)}" type="button" aria-label="${escapeHtml(bookingT("booking.travel_plan.remove_linked_offer_component", "Remove linked offer component"))}">&times;</button>
      </div>
    `).join("");
  }

  function renderTravelPlanItem(day, item, itemIndex) {
    const links = (Array.isArray(state.travelPlanDraft?.offer_component_links) ? state.travelPlanDraft.offer_component_links : [])
      .filter((link) => link.travel_plan_item_id === item.id && link.offer_component_id);
    const coverageStatus = getTravelPlanItemCoverageStatus(item.kind, links);
    const coverageLabel = coverageBadgeLabel(coverageStatus);
    return `
      <div class="travel-plan-item travel-plan-item--${escapeHtml(coverageStatus.replace(/_/g, "-"))}" data-travel-plan-item="${escapeHtml(item.id)}">
        <div class="travel-plan-item__head">
          <div class="travel-plan-item__title">
            <span class="travel-plan-item__index">${escapeHtml(bookingT("booking.travel_plan.item_heading", "Travel plan item {item}", { item: itemIndex + 1 }))}</span>
            <span class="travel-plan-coverage-badge travel-plan-coverage-badge--${escapeHtml(coverageStatus.replace(/_/g, "-"))}" data-travel-plan-coverage-badge="${escapeHtml(item.id)}">${escapeHtml(coverageLabel)}</span>
          </div>
          <div class="travel-plan-item__actions">
            <button class="btn btn-ghost travel-plan-move-btn" data-travel-plan-move-item-up="${escapeHtml(item.id)}" type="button" aria-label="${escapeHtml(bookingT("booking.travel_plan.move_item_up", "Move travel plan item up"))}">&#8593;</button>
            <button class="btn btn-ghost travel-plan-move-btn" data-travel-plan-move-item-down="${escapeHtml(item.id)}" type="button" aria-label="${escapeHtml(bookingT("booking.travel_plan.move_item_down", "Move travel plan item down"))}">&#8595;</button>
            <button class="btn btn-ghost offer-remove-btn" data-travel-plan-remove-item="${escapeHtml(item.id)}" type="button" aria-label="${escapeHtml(bookingT("booking.travel_plan.remove_item", "Remove travel plan item"))}">&times;</button>
          </div>
        </div>
        <div class="travel-plan-grid">
          <div class="field">
            ${renderTravelPlanLocalizedField({
              label: bookingT("booking.travel_plan.item_title", "Travel plan item title"),
              idBase: `travel_plan_title_${item.id}`,
              dataScope: "travel-plan-item-field",
              dayId: day.id,
              itemId: item.id,
              field: "title",
              type: "input",
              englishValue: resolveLocalizedDraftBranchText(item.title_i18n ?? item.title, "en", ""),
              localizedValue: resolveLocalizedDraftBranchText(item.title_i18n ?? item.title, bookingContentLang(), "")
            })}
          </div>
          <div class="field">
            ${renderTravelPlanLocalizedField({
              label: bookingT("booking.location", "Location"),
              idBase: `travel_plan_location_${item.id}`,
              dataScope: "travel-plan-item-field",
              dayId: day.id,
              itemId: item.id,
              field: "location",
              type: "input",
              englishValue: resolveLocalizedDraftBranchText(item.location_i18n ?? item.location, "en", ""),
              localizedValue: resolveLocalizedDraftBranchText(item.location_i18n ?? item.location, bookingContentLang(), "")
            })}
          </div>
          <div class="field">
            <label for="travel_plan_kind_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.kind_label", "Kind"))}</label>
            <select id="travel_plan_kind_${escapeHtml(item.id)}" data-travel-plan-item-field="kind">
              ${itemKindOptions(item.kind)}
            </select>
          </div>
        </div>
        <div class="travel-plan-grid travel-plan-grid--item travel-plan-grid--item-timing">
          ${renderTravelPlanTimingFields(day, item)}
        </div>
        <div class="travel-plan-grid travel-plan-grid--item">
          <div class="field">
            ${renderTravelPlanLocalizedField({
              label: bookingT("booking.details", "Details"),
              idBase: `travel_plan_details_${item.id}`,
              dataScope: "travel-plan-item-field",
              dayId: day.id,
              itemId: item.id,
              field: "details",
              type: "textarea",
              rows: 3,
              englishValue: resolveLocalizedDraftBranchText(item.details_i18n ?? item.details, "en", ""),
              localizedValue: resolveLocalizedDraftBranchText(item.details_i18n ?? item.details, bookingContentLang(), "")
            })}
          </div>
          <div class="field">
            <label for="travel_plan_financial_note_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.financial_note", "Financial note (ATP internal)"))}</label>
            <textarea class="booking-text-field booking-text-field--internal" id="travel_plan_financial_note_${escapeHtml(item.id)}" data-travel-plan-item-field="financial_note" rows="3">${escapeHtml(item.financial_note || "")}</textarea>
          </div>
        </div>
        ${travelPlanImagesModule.renderTravelPlanItemImages(day, item)}
        <div class="travel-plan-links">
          <div class="travel-plan-links__head">
            <h4>${escapeHtml(bookingT("booking.travel_plan.financial_coverage", "Financial coverage"))}</h4>
            <button class="btn btn-ghost travel-plan-link-add-btn" data-travel-plan-add-link="${escapeHtml(item.id)}" type="button">${escapeHtml(bookingT("booking.travel_plan.link_offer_component", "Add offer component"))}</button>
          </div>
          ${renderTravelPlanLinkRows(item.id)}
        </div>
      </div>
    `;
  }

  function renderTravelPlanDay(day, dayIndex) {
    const items = Array.isArray(day.items) ? day.items : [];
    return `
      <section class="travel-plan-day" data-travel-plan-day="${escapeHtml(day.id)}">
        <div class="travel-plan-day__head">
        <div class="travel-plan-day__title-row">
          <h3>${escapeHtml(formatTravelPlanDayHeading(dayIndex))}:</h3>
          <div class="field travel-plan-day__date-field">
            ${renderTravelPlanDateInput({
              id: `travel_plan_day_date_${day.id}`,
              dataAttribute: 'data-travel-plan-day-field="date"',
              value: day.date,
              disabled: !state.permissions.canEditBooking,
              ariaLabel: `${formatTravelPlanDayHeading(dayIndex)} ${bookingT("booking.date", "Date")}`
            })}
          </div>
        </div>
          <button class="btn btn-ghost offer-remove-btn" data-travel-plan-remove-day="${escapeHtml(day.id)}" type="button" aria-label="${escapeHtml(bookingT("booking.travel_plan.remove_day", "Remove day"))}">&times;</button>
        </div>
        <div class="travel-plan-grid">
          <div class="field">
            ${renderTravelPlanLocalizedField({
              label: bookingT("booking.travel_plan.day_title", "Day title"),
              idBase: `travel_plan_day_title_${day.id}`,
              dataScope: "travel-plan-day-field",
              dayId: day.id,
              field: "title",
              type: "input",
              englishValue: resolveLocalizedDraftBranchText(day.title_i18n ?? day.title, "en", ""),
              localizedValue: resolveLocalizedDraftBranchText(day.title_i18n ?? day.title, bookingContentLang(), "")
            })}
          </div>
          <div class="field">
            ${renderTravelPlanLocalizedField({
              label: bookingT("booking.travel_plan.overnight_location", "Overnight location"),
              idBase: `travel_plan_day_overnight_${day.id}`,
              dataScope: "travel-plan-day-field",
              dayId: day.id,
              field: "overnight_location",
              type: "input",
              englishValue: resolveLocalizedDraftBranchText(day.overnight_location_i18n ?? day.overnight_location, "en", ""),
              localizedValue: resolveLocalizedDraftBranchText(day.overnight_location_i18n ?? day.overnight_location, bookingContentLang(), "")
            })}
          </div>
        </div>
        <div class="field">
          ${renderTravelPlanLocalizedField({
            label: bookingT("booking.travel_plan.day_notes", "Day notes"),
            idBase: `travel_plan_day_notes_${day.id}`,
            dataScope: "travel-plan-day-field",
            dayId: day.id,
            field: "notes",
            type: "textarea",
            rows: 3,
            englishValue: resolveLocalizedDraftBranchText(day.notes_i18n ?? day.notes, "en", ""),
            localizedValue: resolveLocalizedDraftBranchText(day.notes_i18n ?? day.notes, bookingContentLang(), "")
          })}
        </div>
        ${items.map((item, itemIndex) => renderTravelPlanItem(day, item, itemIndex)).join("")}
        <div class="travel-plan-day__footer">
          <button class="btn btn-ghost travel-plan-day-add-btn" data-travel-plan-add-item="${escapeHtml(day.id)}" type="button">${escapeHtml(bookingT("booking.travel_plan.new_item", "New travel plan item"))}</button>
          <button class="btn btn-ghost travel-plan-day-add-btn" data-travel-plan-open-import="${escapeHtml(day.id)}" data-requires-clean-state type="button">${escapeHtml(bookingT("booking.travel_plan.insert_existing", "Insert existing"))}</button>
        </div>
      </section>
    `;
  }

  function renderTravelPlanPanel() {
    if (!els.travel_plan_panel || !els.travel_plan_editor || !state.booking) return;
    state.travelPlanDraft = normalizeTravelPlanDraft(state.travelPlanDraft || state.booking.travel_plan, getOfferComponentsForLinks());
    renderBookingSectionHeader(els.travel_plan_panel_summary, travelPlanSummary());
    els.travel_plan_editor.innerHTML = `
      ${(Array.isArray(state.travelPlanDraft.days) ? state.travelPlanDraft.days : []).map((day, dayIndex) => renderTravelPlanDay(day, dayIndex)).join("") || `<p class="travel-plan-empty">${escapeHtml(bookingT("booking.travel_plan.no_days", "No travel-plan days yet."))}</p>`}
      <div class="travel-plan-footer">
        <button class="btn btn-ghost booking-offer-add-btn travel-plan-add-day-btn" data-travel-plan-add-day type="button">${escapeHtml(bookingT("booking.travel_plan.new_day", "New day"))}</button>
      </div>
    `;
    updateTravelPlanDirtyState();
  }

  function readLocalizedFieldPayload(container, dataScope, field) {
    const englishInput = container?.querySelector(`[data-${dataScope}="${field}"][data-localized-lang="en"][data-localized-role="source"]`);
    const targetLang = bookingContentLang();
    const localizedInput = targetLang === "en"
      ? null
      : container?.querySelector(`[data-${dataScope}="${field}"][data-localized-lang="${targetLang}"][data-localized-role="target"]`);
    const englishValue = String(englishInput?.value || "").trim();
    const localizedValue = targetLang === "en" ? "" : String(localizedInput?.value || "").trim();
    return buildDualLocalizedPayload(englishValue, localizedValue, targetLang);
  }

  function syncTravelPlanDraftFromDom() {
    if (!els.travel_plan_editor) return state.travelPlanDraft;
    const previousItemsById = new Map(
      (Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : [])
        .flatMap((day) => (Array.isArray(day?.items) ? day.items : []))
        .map((item) => [item.id, item])
    );
    const draft = createEmptyTravelPlan();
    draft.days = Array.from(els.travel_plan_editor.querySelectorAll("[data-travel-plan-day]")).map((dayNode, dayIndex) => {
      const dayId = String(dayNode.getAttribute("data-travel-plan-day") || "").trim();
      const day = createEmptyTravelPlanDay(dayIndex);
      day.id = dayId || day.id;
      day.day_number = dayIndex + 1;
      const dayTitle = readLocalizedFieldPayload(dayNode, "travel-plan-day-field", "title");
      day.title = dayTitle.text;
      day.title_i18n = dayTitle.map;
      day.date = String(dayNode.querySelector('[data-travel-plan-day-field="date"]')?.value || "").trim();
      const overnight = readLocalizedFieldPayload(dayNode, "travel-plan-day-field", "overnight_location");
      day.overnight_location = overnight.text;
      day.overnight_location_i18n = overnight.map;
      const dayNotes = readLocalizedFieldPayload(dayNode, "travel-plan-day-field", "notes");
      day.notes = dayNotes.text;
      day.notes_i18n = dayNotes.map;
      day.items = Array.from(dayNode.querySelectorAll("[data-travel-plan-item]")).map((itemNode) => {
        const itemId = String(itemNode.getAttribute("data-travel-plan-item") || "").trim();
        const previousItem = previousItemsById.get(itemId);
        const item = createEmptyTravelPlanItem();
        item.id = itemId || item.id;
        item.timing_kind = String(itemNode.querySelector('[data-travel-plan-item-field="timing_kind"]')?.value || "label").trim();
        const timeLabel = readLocalizedFieldPayload(itemNode, "travel-plan-item-field", "time_label");
        item.time_label = timeLabel.text;
        item.time_label_i18n = timeLabel.map;
        item.time_point = combineDateAndTime(
          String(itemNode.querySelector('[data-travel-plan-item-field="time_point_date"]')?.value || day.date || "").trim(),
          String(itemNode.querySelector('[data-travel-plan-item-field="time_point_time"]')?.value || "").trim()
        );
        item.kind = String(itemNode.querySelector('[data-travel-plan-item-field="kind"]')?.value || "").trim();
        const itemTitle = readLocalizedFieldPayload(itemNode, "travel-plan-item-field", "title");
        item.title = itemTitle.text;
        item.title_i18n = itemTitle.map;
        const itemLocation = readLocalizedFieldPayload(itemNode, "travel-plan-item-field", "location");
        item.location = itemLocation.text;
        item.location_i18n = itemLocation.map;
        const itemDetails = readLocalizedFieldPayload(itemNode, "travel-plan-item-field", "details");
        item.details = itemDetails.text;
        item.details_i18n = itemDetails.map;
        item.start_time = combineDateAndTime(
          String(itemNode.querySelector('[data-travel-plan-item-field="start_time_date"]')?.value || day.date || "").trim(),
          String(itemNode.querySelector('[data-travel-plan-item-field="start_time_time"]')?.value || "").trim()
        );
        item.end_time = combineDateAndTime(
          String(itemNode.querySelector('[data-travel-plan-item-field="end_time_date"]')?.value || day.date || "").trim(),
          String(itemNode.querySelector('[data-travel-plan-item-field="end_time_time"]')?.value || "").trim()
        );
        item.financial_note = String(itemNode.querySelector('[data-travel-plan-item-field="financial_note"]')?.value || "").trim();
        item.images = Array.isArray(previousItem?.images) ? previousItem.images : [];
        item.copied_from = previousItem?.copied_from || null;
        return item;
      });
      return day;
    });
    draft.offer_component_links = Array.from(els.travel_plan_editor.querySelectorAll("[data-travel-plan-link]")).map((linkNode) => ({
      id: String(linkNode.getAttribute("data-travel-plan-link") || "").trim(),
      travel_plan_item_id: String(linkNode.closest("[data-travel-plan-item]")?.getAttribute("data-travel-plan-item") || "").trim(),
      offer_component_id: String(linkNode.querySelector("[data-travel-plan-link-component]")?.value || "").trim(),
      coverage_type: String(linkNode.querySelector("[data-travel-plan-link-coverage-type]")?.value || "full").trim()
    }));
    state.travelPlanDraft = normalizeTravelPlanDraft(draft, getOfferComponentsForLinks());
    return state.travelPlanDraft;
  }

  function findDayIndex(dayId) {
    return (Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : []).findIndex((day) => day.id === dayId);
  }

  function removeItemLinks(itemId) {
    state.travelPlanDraft.offer_component_links = (Array.isArray(state.travelPlanDraft.offer_component_links)
      ? state.travelPlanDraft.offer_component_links
      : []).filter((link) => link.travel_plan_item_id !== itemId);
  }

  function addDay() {
    syncTravelPlanDraftFromDom();
    const days = Array.isArray(state.travelPlanDraft.days) ? state.travelPlanDraft.days : [];
    const nextDay = createEmptyTravelPlanDay(days.length);
    nextDay.date = deriveNextTravelPlanDayDate(days);
    days.push(nextDay);
    state.travelPlanDraft.days = days;
    renderTravelPlanPanel();
  }

  function removeDay(dayId) {
    syncTravelPlanDraftFromDom();
    const dayIndex = findDayIndex(dayId);
    if (dayIndex < 0) return;
    if (!window.confirm(bookingT("booking.travel_plan.remove_day_confirm", "Remove this day and all its travel plan items?"))) return;
    const [removedDay] = state.travelPlanDraft.days.splice(dayIndex, 1);
    for (const item of Array.isArray(removedDay?.items) ? removedDay.items : []) {
      removeItemLinks(item.id);
    }
    renderTravelPlanPanel();
  }

  function addItem(dayId) {
    syncTravelPlanDraftFromDom();
    const dayIndex = findDayIndex(dayId);
    if (dayIndex < 0) return;
    const day = state.travelPlanDraft.days[dayIndex];
    day.items = Array.isArray(day.items) ? day.items : [];
    day.items.push(createEmptyTravelPlanItem());
    renderTravelPlanPanel();
  }

  function removeItem(itemId) {
    syncTravelPlanDraftFromDom();
    if (!window.confirm(bookingT("booking.travel_plan.remove_item_confirm", "Remove this travel plan item?"))) return;
    for (const day of Array.isArray(state.travelPlanDraft.days) ? state.travelPlanDraft.days : []) {
      const itemIndex = (Array.isArray(day.items) ? day.items : []).findIndex((item) => item.id === itemId);
      if (itemIndex < 0) continue;
      day.items.splice(itemIndex, 1);
      removeItemLinks(itemId);
      renderTravelPlanPanel();
      return;
    }
  }

  function moveItem(itemId, direction) {
    syncTravelPlanDraftFromDom();
    for (const day of Array.isArray(state.travelPlanDraft.days) ? state.travelPlanDraft.days : []) {
      const items = Array.isArray(day.items) ? day.items : [];
      const itemIndex = items.findIndex((item) => item.id === itemId);
      if (itemIndex < 0) continue;
      const nextIndex = direction === "up" ? itemIndex - 1 : itemIndex + 1;
      if (nextIndex < 0 || nextIndex >= items.length) return;
      const [item] = items.splice(itemIndex, 1);
      items.splice(nextIndex, 0, item);
      renderTravelPlanPanel();
      return;
    }
  }

  function addLink(itemId) {
    syncTravelPlanDraftFromDom();
    state.travelPlanDraft.offer_component_links = Array.isArray(state.travelPlanDraft.offer_component_links)
      ? state.travelPlanDraft.offer_component_links
      : [];
    state.travelPlanDraft.offer_component_links.push(createEmptyTravelPlanOfferComponentLink(itemId));
    renderTravelPlanPanel();
  }

  function removeLink(linkId) {
    syncTravelPlanDraftFromDom();
    state.travelPlanDraft.offer_component_links = (Array.isArray(state.travelPlanDraft.offer_component_links)
      ? state.travelPlanDraft.offer_component_links
      : []).filter((link) => link.id !== linkId);
    renderTravelPlanPanel();
  }

  async function persistTravelPlan() {
    if (!state.permissions.canEditBooking || !state.booking || !state.travelPlanDirty || state.travelPlanSaving) return false;
    const dateFieldValidation = validateTravelPlanDateFieldsInDom({ allowPartial: false, focusFirstInvalid: true });
    if (!dateFieldValidation.ok) {
      travelPlanStatus(dateFieldValidation.message, "error");
      return false;
    }
    syncTravelPlanDraftFromDom();
    const travelPlanPayload = buildTravelPlanPayload();
    const validation = validateTravelPlanDraft(travelPlanPayload);
    if (!validation.ok) {
      travelPlanStatus(validation.error, "error");
      return false;
    }
    state.travelPlanSaving = true;
    travelPlanStatus(bookingT("booking.travel_plan.saving", "Saving travel plan..."), "info");
    try {
      const request = bookingTravelPlanRequest({
        baseURL: apiOrigin,
        params: { booking_id: state.booking.id },
        body: {
          expected_travel_plan_revision: getBookingRevision("travel_plan_revision"),
          travel_plan: travelPlanPayload,
          lang: bookingContentLang()
        }
      });
      const response = await fetchBookingMutation(request.url, {
        method: request.method,
        body: request.body
      });
      if (!response?.booking) {
        travelPlanStatus("");
        return false;
      }
      state.booking = response.booking;
      renderBookingHeader();
      renderBookingData();
      applyBookingPayload();
      renderTravelPlanPanel();
      await loadActivities();
      travelPlanStatus(response.unchanged
        ? bookingT("booking.travel_plan.no_changes", "No travel-plan changes.")
        : bookingT("booking.travel_plan.saved", "Travel plan saved."), response.unchanged ? "info" : "success");
      return true;
    } finally {
      state.travelPlanSaving = false;
    }
  }

  async function saveTravelPlan() {
    return await persistTravelPlan();
  }

  async function translateTravelPlanField(button) {
    if (!state.permissions.canEditBooking || !state.booking?.id) return;
    const editor = button.closest(".localized-pair");
    if (!editor) return;
    const direction = String(button.getAttribute("data-localized-translate-direction") || "source-to-target").trim();
    const englishInput = editor?.querySelector('[data-localized-lang="en"][data-localized-role="source"]');
    const targetLang = bookingContentLang();
    const localizedInput = targetLang === "en"
      ? null
      : editor?.querySelector(`[data-localized-lang="${targetLang}"][data-localized-role="target"]`);
    if (!englishInput || !localizedInput || targetLang === "en") return;
    const sourceInput = direction === "target-to-source" ? localizedInput : englishInput;
    const destinationInput = direction === "target-to-source" ? englishInput : localizedInput;
    const sourceLang = direction === "target-to-source" ? targetLang : "en";
    const destinationLang = direction === "target-to-source" ? "en" : targetLang;
    const sourceText = String(sourceInput?.value || "").trim();
    if (!sourceText) return;
    const targetOption = bookingContentLanguageOption(targetLang);
    const statusMessage = direction === "target-to-source"
      ? bookingT("booking.translation.translating_field_to_english", "Translating field to English...")
      : bookingT("booking.translation.translating_field_from_english", "Translating field from English...");
    travelPlanStatus(statusMessage);
    let translated = "";
    try {
      const translatedEntries = await requestBookingFieldTranslation({
        bookingId: state.booking?.id,
        entries: { value: sourceText },
        fetchBookingMutation,
        apiBase: apiOrigin,
        sourceLang,
        targetLang: destinationLang
      });
      translated = String(translatedEntries?.value || "").trim();
      if (!translated) throw new Error(bookingT("booking.translation.error", "Could not translate this section."));
    } catch (error) {
      logBrowserConsoleError("[travel-plan] Failed to translate a travel-plan field.", {
        booking_id: state.booking?.id || "",
        day_id: button.getAttribute("data-travel-plan-day-id") || "",
        item_id: button.getAttribute("data-travel-plan-item-id") || "",
        field: button.getAttribute("data-travel-plan-translate") || "",
        source_lang: sourceLang,
        target_lang: destinationLang,
        source_text: sourceText,
        direction
      }, error);
      travelPlanStatus(error?.message || bookingT("booking.translation.error", "Could not translate this section."));
      return;
    }
    destinationInput.value = translated;
    syncTravelPlanDraftFromDom();
    updateTravelPlanDirtyState();
    renderBookingSectionHeader(els.travel_plan_panel_summary, travelPlanSummary());
    travelPlanStatus(
      direction === "target-to-source"
        ? bookingT("booking.translation.field_translated_to_english", "Field translated to English.")
        : bookingT("booking.translation.field_translated_to_customer_language", "Field translated to {lang}.", { lang: targetOption.shortLabel })
    );
  }

  function bindEvents() {
    if (els.travel_plan_editor && els.travel_plan_editor.dataset.travelPlanBound !== "true") {
      els.travel_plan_editor.addEventListener("input", (event) => {
        const target = event.target;
        if (target?.matches?.('[data-travel-plan-date-text="true"]')) {
          validateTravelPlanDateTextInput(target, { allowPartial: true });
        }
        syncTravelPlanDraftFromDom();
        updateTravelPlanDirtyState();
        renderBookingSectionHeader(els.travel_plan_panel_summary, travelPlanSummary());
      });
      els.travel_plan_editor.addEventListener("change", (event) => {
        const target = event.target;
        if (target?.matches?.("[data-travel-plan-date-picker-for]")) {
          applyTravelPlanDatePickerValue(target);
        }
        if (target?.matches?.('[data-travel-plan-date-text="true"]')) {
          validateTravelPlanDateTextInput(target, { allowPartial: false });
        }
        syncTravelPlanDraftFromDom();
        updateTravelPlanDirtyState();
        renderBookingSectionHeader(els.travel_plan_panel_summary, travelPlanSummary());
        const shouldRerender = Boolean(
          target?.matches?.('[data-travel-plan-item-field="timing_kind"]')
          || target?.matches?.("[data-travel-plan-link-component]")
          || target?.matches?.("[data-travel-plan-link-coverage-type]")
        );
        if (shouldRerender) {
          renderTravelPlanPanel();
        }
      });
      els.travel_plan_editor.addEventListener("click", (event) => {
        const button = event.target.closest("button");
        if (!button) return;
        if (button.hasAttribute("data-travel-plan-add-day")) {
          addDay();
          return;
        }
        if (button.hasAttribute("data-travel-plan-remove-day")) {
          removeDay(button.getAttribute("data-travel-plan-remove-day"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-add-item")) {
          addItem(button.getAttribute("data-travel-plan-add-item"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-open-import")) {
          travelPlanItemLibraryModule.openTravelPlanItemLibrary(button.getAttribute("data-travel-plan-open-import"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-remove-item")) {
          removeItem(button.getAttribute("data-travel-plan-remove-item"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-move-item-up")) {
          moveItem(button.getAttribute("data-travel-plan-move-item-up"), "up");
          return;
        }
        if (button.hasAttribute("data-travel-plan-move-item-down")) {
          moveItem(button.getAttribute("data-travel-plan-move-item-down"), "down");
          return;
        }
        if (button.hasAttribute("data-travel-plan-add-link")) {
          addLink(button.getAttribute("data-travel-plan-add-link"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-add-image")) {
          travelPlanImagesModule.triggerTravelPlanItemImagePicker(
            button.getAttribute("data-travel-plan-day-id"),
            button.getAttribute("data-travel-plan-add-image")
          );
          return;
        }
        if (button.hasAttribute("data-travel-plan-move-image-left")) {
          void travelPlanImagesModule.reorderTravelPlanItemImage(
            button.getAttribute("data-travel-plan-day-id"),
            button.getAttribute("data-travel-plan-item-id"),
            button.getAttribute("data-travel-plan-move-image-left"),
            "left"
          );
          return;
        }
        if (button.hasAttribute("data-travel-plan-move-image-right")) {
          void travelPlanImagesModule.reorderTravelPlanItemImage(
            button.getAttribute("data-travel-plan-day-id"),
            button.getAttribute("data-travel-plan-item-id"),
            button.getAttribute("data-travel-plan-move-image-right"),
            "right"
          );
          return;
        }
        if (button.hasAttribute("data-travel-plan-remove-image")) {
          void travelPlanImagesModule.removeTravelPlanItemImage(
            button.getAttribute("data-travel-plan-day-id"),
            button.getAttribute("data-travel-plan-item-id"),
            button.getAttribute("data-travel-plan-remove-image")
          );
          return;
        }
        if (button.hasAttribute("data-localized-translate")) {
          void translateTravelPlanField(button);
          return;
        }
        if (button.hasAttribute("data-travel-plan-date-picker-btn")) {
          openTravelPlanDatePicker(button);
          return;
        }
        if (button.hasAttribute("data-travel-plan-remove-link")) {
          removeLink(button.getAttribute("data-travel-plan-remove-link"));
        }
      });
      els.travel_plan_editor.addEventListener("focusout", (event) => {
        const target = event.target;
        if (target?.matches?.('[data-travel-plan-date-text="true"]')) {
          validateTravelPlanDateTextInput(target, { allowPartial: false });
        }
      });
      els.travel_plan_editor.dataset.travelPlanBound = "true";
    }
    travelPlanItemLibraryModule.bindTravelPlanItemLibrary();
    travelPlanImagesModule.bindTravelPlanImageInput();
  }

  return {
    applyBookingPayload,
    bindEvents,
    renderTravelPlanPanel,
    updateTravelPlanDirtyState,
    saveTravelPlan
  };
}
