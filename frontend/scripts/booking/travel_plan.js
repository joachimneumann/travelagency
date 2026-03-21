import { bookingTravelPlanRequest } from "../../Generated/API/generated_APIRequestFactory.js";
import {
  bookingContentLang,
  bookingContentLanguageOption,
  bookingT
} from "./i18n.js";
import { formatMoneyDisplay } from "./pricing.js";
import { renderBookingSegmentHeader } from "./segment_headers.js";
import {
  buildDualLocalizedPayload,
  renderLocalizedStackedField,
  requestBookingFieldTranslation,
  resolveLocalizedEditorBranchText
} from "./localized_editor.js";
import {
  TRAVEL_PLAN_OFFER_COVERAGE_TYPE_OPTIONS,
  TRAVEL_PLAN_SEGMENT_KIND_OPTIONS
} from "../shared/generated_catalogs.js";
import {
  countTravelPlanSegments,
  countUncoveredTravelPlanSegments,
  createEmptyTravelPlan,
  createEmptyTravelPlanDay,
  createEmptyTravelPlanOfferComponentLink,
  createEmptyTravelPlanSegment,
  getLinkableOfferComponents,
  TRAVEL_PLAN_TIMING_KIND_OPTIONS,
  getTravelPlanSegmentCoverageStatus,
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
      validSegmentKinds: new Set(TRAVEL_PLAN_SEGMENT_KIND_OPTIONS.map((option) => option.value)),
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

  function updateTravelPlanSaveButtonState() {
    if (!els.travel_plan_save_btn) return;
    els.travel_plan_save_btn.disabled = !state.permissions.canEditBooking || !state.travelPlanDirty || Boolean(state.travelPlanSaving);
  }

  function getTravelPlanSnapshot(plan = state.travelPlanDraft) {
    return JSON.stringify(normalizeTravelPlanDraft(plan, getOfferComponentsForLinks()));
  }

  function updateTravelPlanDirtyState() {
    state.travelPlanDraft = normalizeTravelPlanDraft(state.travelPlanDraft, getOfferComponentsForLinks());
    setTravelPlanDirty(getTravelPlanSnapshot() !== state.originalTravelPlanSnapshot);
    updateTravelPlanSaveButtonState();
  }

  function applyBookingPayload() {
    state.travelPlanDraft = normalizeTravelPlanDraft(state.booking?.travel_plan || createEmptyTravelPlan(), getOfferComponentsForLinks());
    state.originalTravelPlanSnapshot = getTravelPlanSnapshot(state.travelPlanDraft);
    setTravelPlanDirty(false);
    updateTravelPlanSaveButtonState();
    travelPlanStatus("");
  }

  function resolveLocalizedDraftBranchText(map, lang = "en", fallback = "") {
    return resolveLocalizedEditorBranchText(map, lang, fallback);
  }

  function renderTravelPlanLocalizedField({ label, idBase, dataScope, dayId = "", segmentId = "", field, type = "input", rows = 3, englishValue = "", localizedValue = "" }) {
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
        ...(segmentId ? { "travel-plan-segment-id": segmentId } : {})
      },
      translatePayload: {
        "travel-plan-translate": field,
        ...(dayId ? { "travel-plan-day-id": dayId } : {}),
        ...(segmentId ? { "travel-plan-segment-id": segmentId } : {})
      }
    });
  }

  function formatTravelPlanDayHeading(dayIndex) {
    return bookingT("booking.travel_plan.day_heading", "Day {day}", { day: dayIndex + 1 });
  }

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
    const segments = countTravelPlanSegments(state.travelPlanDraft);
    const uncovered = countUncoveredTravelPlanSegments(state.travelPlanDraft);
    if (!days && !segments) {
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
        segments === 1 ? "booking.travel_plan.summary.segment" : "booking.travel_plan.summary.segments",
        segments === 1 ? "{count} segment" : "{count} segments",
        { count: segments }
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

  function segmentKindOptions(selectedValue = "other") {
    return TRAVEL_PLAN_SEGMENT_KIND_OPTIONS.map((option) => (
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

  function renderTravelPlanTimingFields(day, segment) {
    const timingKind = String(segment?.timing_kind || "label");
    if (timingKind === "point") {
      const pointParts = splitDateTimeValue(day?.date, segment.time_point);
      return `
        <div class="field">
          <label for="travel_plan_timing_kind_${escapeHtml(segment.id)}">${escapeHtml(bookingT("booking.travel_plan.time_information", "Time information"))}</label>
          <select id="travel_plan_timing_kind_${escapeHtml(segment.id)}" data-travel-plan-segment-field="timing_kind">
            ${timingKindOptions(timingKind)}
          </select>
        </div>
        <div class="field">
          <label for="travel_plan_time_point_date_${escapeHtml(segment.id)}">${escapeHtml(bookingT("booking.date", "Date"))}</label>
          ${renderTravelPlanDateInput({
            id: `travel_plan_time_point_date_${segment.id}`,
            dataAttribute: 'data-travel-plan-segment-field="time_point_date"',
            value: pointParts.date,
            disabled: !state.permissions.canEditBooking,
            ariaLabel: bookingT("booking.date", "Date")
          })}
        </div>
        <div class="field">
          <label for="travel_plan_time_point_time_${escapeHtml(segment.id)}">${escapeHtml(bookingT("booking.time", "Time"))}</label>
          <select id="travel_plan_time_point_time_${escapeHtml(segment.id)}" data-travel-plan-segment-field="time_point_time">
            ${timeSelectOptions(pointParts.time)}
          </select>
        </div>
      `;
    }
    if (timingKind === "range") {
      const startParts = splitDateTimeValue(day?.date, segment.start_time);
      const endParts = splitDateTimeValue(day?.date, segment.end_time);
      return `
        <div class="field">
          <label for="travel_plan_timing_kind_${escapeHtml(segment.id)}">${escapeHtml(bookingT("booking.travel_plan.time_information", "Time information"))}</label>
          <select id="travel_plan_timing_kind_${escapeHtml(segment.id)}" data-travel-plan-segment-field="timing_kind">
            ${timingKindOptions(timingKind)}
          </select>
        </div>
        <div class="field">
          <label for="travel_plan_start_time_date_${escapeHtml(segment.id)}">${escapeHtml(bookingT("booking.travel_plan.start_date", "Start date"))}</label>
          ${renderTravelPlanDateInput({
            id: `travel_plan_start_time_date_${segment.id}`,
            dataAttribute: 'data-travel-plan-segment-field="start_time_date"',
            value: startParts.date,
            disabled: !state.permissions.canEditBooking,
            ariaLabel: bookingT("booking.travel_plan.start_date", "Start date")
          })}
        </div>
        <div class="field">
          <label for="travel_plan_start_time_time_${escapeHtml(segment.id)}">${escapeHtml(bookingT("booking.travel_plan.start_time", "Start time"))}</label>
          <select id="travel_plan_start_time_time_${escapeHtml(segment.id)}" data-travel-plan-segment-field="start_time_time">
            ${timeSelectOptions(startParts.time)}
          </select>
        </div>
        <div class="field">
          <label for="travel_plan_end_time_date_${escapeHtml(segment.id)}">${escapeHtml(bookingT("booking.travel_plan.end_date", "End date"))}</label>
          ${renderTravelPlanDateInput({
            id: `travel_plan_end_time_date_${segment.id}`,
            dataAttribute: 'data-travel-plan-segment-field="end_time_date"',
            value: endParts.date,
            disabled: !state.permissions.canEditBooking,
            ariaLabel: bookingT("booking.travel_plan.end_date", "End date")
          })}
        </div>
        <div class="field">
          <label for="travel_plan_end_time_time_${escapeHtml(segment.id)}">${escapeHtml(bookingT("booking.travel_plan.end_time", "End time"))}</label>
          <select id="travel_plan_end_time_time_${escapeHtml(segment.id)}" data-travel-plan-segment-field="end_time_time">
            ${timeSelectOptions(endParts.time)}
          </select>
        </div>
      `;
    }
    return `
      <div class="field">
        <label for="travel_plan_timing_kind_${escapeHtml(segment.id)}">${escapeHtml(bookingT("booking.travel_plan.time_information", "Time information"))}</label>
        <select id="travel_plan_timing_kind_${escapeHtml(segment.id)}" data-travel-plan-segment-field="timing_kind">
          ${timingKindOptions(timingKind)}
        </select>
      </div>
      <div class="field">
        ${renderTravelPlanLocalizedField({
          label: bookingT("booking.travel_plan.human_readable_time", "Human readable time"),
          idBase: `travel_plan_time_${segment.id}`,
          dataScope: "travel-plan-segment-field",
          dayId: day.id,
          segmentId: segment.id,
          field: "time_label",
          type: "input",
          englishValue: resolveLocalizedDraftBranchText(segment.time_label_i18n ?? segment.time_label, "en", ""),
          localizedValue: resolveLocalizedDraftBranchText(segment.time_label_i18n ?? segment.time_label, bookingContentLang(), "")
        })}
      </div>
    `;
  }

  function renderTravelPlanLinkRows(segmentId) {
    const segmentLinks = (Array.isArray(state.travelPlanDraft?.offer_component_links) ? state.travelPlanDraft.offer_component_links : [])
      .filter((link) => link.travel_plan_segment_id === segmentId);

    if (!segmentLinks.length) {
      return `
        <div class="travel-plan-link-empty">
          ${getOfferComponentsForLinks().length
            ? escapeHtml(bookingT("booking.travel_plan.no_linked_components", "No linked offer components yet."))
            : escapeHtml(bookingT("booking.travel_plan.save_offer_first", "Save offer components first to link financial coverage."))}
        </div>
      `;
    }

    return segmentLinks.map((link) => `
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

  function renderTravelPlanSegment(day, segment, segmentIndex) {
    const links = (Array.isArray(state.travelPlanDraft?.offer_component_links) ? state.travelPlanDraft.offer_component_links : [])
      .filter((link) => link.travel_plan_segment_id === segment.id && link.offer_component_id);
    const coverageStatus = getTravelPlanSegmentCoverageStatus(segment.kind, links);
    const coverageLabel = coverageBadgeLabel(coverageStatus);
    return `
      <div class="travel-plan-segment travel-plan-segment--${escapeHtml(coverageStatus.replace(/_/g, "-"))}" data-travel-plan-segment="${escapeHtml(segment.id)}">
        <div class="travel-plan-segment__head">
          <div class="travel-plan-segment__title">
            <span class="travel-plan-segment__index">${escapeHtml(bookingT("booking.travel_plan.segment_heading", "Segment {segment}", { segment: segmentIndex + 1 }))}</span>
            <span class="travel-plan-coverage-badge travel-plan-coverage-badge--${escapeHtml(coverageStatus.replace(/_/g, "-"))}" data-travel-plan-coverage-badge="${escapeHtml(segment.id)}">${escapeHtml(coverageLabel)}</span>
          </div>
          <div class="travel-plan-segment__actions">
            <button class="btn btn-ghost travel-plan-move-btn" data-travel-plan-move-segment-up="${escapeHtml(segment.id)}" type="button" aria-label="${escapeHtml(bookingT("booking.travel_plan.move_segment_up", "Move segment up"))}">&#8593;</button>
            <button class="btn btn-ghost travel-plan-move-btn" data-travel-plan-move-segment-down="${escapeHtml(segment.id)}" type="button" aria-label="${escapeHtml(bookingT("booking.travel_plan.move_segment_down", "Move segment down"))}">&#8595;</button>
            <button class="btn btn-ghost offer-remove-btn" data-travel-plan-remove-segment="${escapeHtml(segment.id)}" type="button" aria-label="${escapeHtml(bookingT("booking.travel_plan.remove_segment", "Remove segment"))}">&times;</button>
          </div>
        </div>
        <div class="travel-plan-grid">
          <div class="field">
            ${renderTravelPlanLocalizedField({
              label: bookingT("booking.travel_plan.segment_title", "Segment title"),
              idBase: `travel_plan_title_${segment.id}`,
              dataScope: "travel-plan-segment-field",
              dayId: day.id,
              segmentId: segment.id,
              field: "title",
              type: "input",
              englishValue: resolveLocalizedDraftBranchText(segment.title_i18n ?? segment.title, "en", ""),
              localizedValue: resolveLocalizedDraftBranchText(segment.title_i18n ?? segment.title, bookingContentLang(), "")
            })}
          </div>
          <div class="field">
            ${renderTravelPlanLocalizedField({
              label: bookingT("booking.location", "Location"),
              idBase: `travel_plan_location_${segment.id}`,
              dataScope: "travel-plan-segment-field",
              dayId: day.id,
              segmentId: segment.id,
              field: "location",
              type: "input",
              englishValue: resolveLocalizedDraftBranchText(segment.location_i18n ?? segment.location, "en", ""),
              localizedValue: resolveLocalizedDraftBranchText(segment.location_i18n ?? segment.location, bookingContentLang(), "")
            })}
          </div>
          <div class="field">
            <label for="travel_plan_kind_${escapeHtml(segment.id)}">${escapeHtml(bookingT("booking.travel_plan.kind_label", "Kind"))}</label>
            <select id="travel_plan_kind_${escapeHtml(segment.id)}" data-travel-plan-segment-field="kind">
              ${segmentKindOptions(segment.kind)}
            </select>
          </div>
        </div>
        <div class="travel-plan-grid travel-plan-grid--segment travel-plan-grid--segment-timing">
          ${renderTravelPlanTimingFields(day, segment)}
        </div>
        <div class="travel-plan-grid travel-plan-grid--segment">
          <div class="field">
            ${renderTravelPlanLocalizedField({
              label: bookingT("booking.details", "Details"),
              idBase: `travel_plan_details_${segment.id}`,
              dataScope: "travel-plan-segment-field",
              dayId: day.id,
              segmentId: segment.id,
              field: "details",
              type: "textarea",
              rows: 3,
              englishValue: resolveLocalizedDraftBranchText(segment.details_i18n ?? segment.details, "en", ""),
              localizedValue: resolveLocalizedDraftBranchText(segment.details_i18n ?? segment.details, bookingContentLang(), "")
            })}
          </div>
          <div class="field">
            <label for="travel_plan_financial_note_${escapeHtml(segment.id)}">${escapeHtml(bookingT("booking.travel_plan.financial_note", "Financial note (ATP internal)"))}</label>
            <textarea id="travel_plan_financial_note_${escapeHtml(segment.id)}" data-travel-plan-segment-field="financial_note" rows="3">${escapeHtml(segment.financial_note || "")}</textarea>
          </div>
        </div>
        <div class="travel-plan-links">
          <div class="travel-plan-links__head">
            <h4>${escapeHtml(bookingT("booking.travel_plan.financial_coverage", "Financial coverage"))}</h4>
            <button class="btn btn-ghost travel-plan-link-add-btn" data-travel-plan-add-link="${escapeHtml(segment.id)}" type="button">${escapeHtml(bookingT("booking.travel_plan.link_offer_component", "Link offer component"))}</button>
          </div>
          ${renderTravelPlanLinkRows(segment.id)}
        </div>
      </div>
    `;
  }

  function renderTravelPlanDay(day, dayIndex) {
    const segments = Array.isArray(day.segments) ? day.segments : [];
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
        ${segments.map((segment, segmentIndex) => renderTravelPlanSegment(day, segment, segmentIndex)).join("")}
        <div class="travel-plan-day__footer">
          <button class="btn btn-ghost travel-plan-day-add-btn" data-travel-plan-add-segment="${escapeHtml(day.id)}" type="button">${escapeHtml(bookingT("booking.travel_plan.new_segment", "New segment"))}</button>
        </div>
      </section>
    `;
  }

  function renderTravelPlanPanel() {
    if (!els.travel_plan_panel || !els.travel_plan_editor || !state.booking) return;
    state.travelPlanDraft = normalizeTravelPlanDraft(state.travelPlanDraft || state.booking.travel_plan, getOfferComponentsForLinks());
    renderBookingSegmentHeader(els.travel_plan_panel_summary, travelPlanSummary());
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
      day.segments = Array.from(dayNode.querySelectorAll("[data-travel-plan-segment]")).map((segmentNode) => {
        const segmentId = String(segmentNode.getAttribute("data-travel-plan-segment") || "").trim();
        const segment = createEmptyTravelPlanSegment();
        segment.id = segmentId || segment.id;
        segment.timing_kind = String(segmentNode.querySelector('[data-travel-plan-segment-field="timing_kind"]')?.value || "label").trim();
        const timeLabel = readLocalizedFieldPayload(segmentNode, "travel-plan-segment-field", "time_label");
        segment.time_label = timeLabel.text;
        segment.time_label_i18n = timeLabel.map;
        segment.time_point = combineDateAndTime(
          String(segmentNode.querySelector('[data-travel-plan-segment-field="time_point_date"]')?.value || day.date || "").trim(),
          String(segmentNode.querySelector('[data-travel-plan-segment-field="time_point_time"]')?.value || "").trim()
        );
        segment.kind = String(segmentNode.querySelector('[data-travel-plan-segment-field="kind"]')?.value || "").trim();
        const segmentTitle = readLocalizedFieldPayload(segmentNode, "travel-plan-segment-field", "title");
        segment.title = segmentTitle.text;
        segment.title_i18n = segmentTitle.map;
        const segmentLocation = readLocalizedFieldPayload(segmentNode, "travel-plan-segment-field", "location");
        segment.location = segmentLocation.text;
        segment.location_i18n = segmentLocation.map;
        const segmentDetails = readLocalizedFieldPayload(segmentNode, "travel-plan-segment-field", "details");
        segment.details = segmentDetails.text;
        segment.details_i18n = segmentDetails.map;
        segment.start_time = combineDateAndTime(
          String(segmentNode.querySelector('[data-travel-plan-segment-field="start_time_date"]')?.value || day.date || "").trim(),
          String(segmentNode.querySelector('[data-travel-plan-segment-field="start_time_time"]')?.value || "").trim()
        );
        segment.end_time = combineDateAndTime(
          String(segmentNode.querySelector('[data-travel-plan-segment-field="end_time_date"]')?.value || day.date || "").trim(),
          String(segmentNode.querySelector('[data-travel-plan-segment-field="end_time_time"]')?.value || "").trim()
        );
        segment.financial_note = String(segmentNode.querySelector('[data-travel-plan-segment-field="financial_note"]')?.value || "").trim();
        return segment;
      });
      return day;
    });
    draft.offer_component_links = Array.from(els.travel_plan_editor.querySelectorAll("[data-travel-plan-link]")).map((linkNode) => ({
      id: String(linkNode.getAttribute("data-travel-plan-link") || "").trim(),
      travel_plan_segment_id: String(linkNode.closest("[data-travel-plan-segment]")?.getAttribute("data-travel-plan-segment") || "").trim(),
      offer_component_id: String(linkNode.querySelector("[data-travel-plan-link-component]")?.value || "").trim(),
      coverage_type: String(linkNode.querySelector("[data-travel-plan-link-coverage-type]")?.value || "full").trim()
    }));
    state.travelPlanDraft = normalizeTravelPlanDraft(draft, getOfferComponentsForLinks());
    return state.travelPlanDraft;
  }

  function findDayIndex(dayId) {
    return (Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : []).findIndex((day) => day.id === dayId);
  }

  function removeSegmentLinks(segmentId) {
    state.travelPlanDraft.offer_component_links = (Array.isArray(state.travelPlanDraft.offer_component_links)
      ? state.travelPlanDraft.offer_component_links
      : []).filter((link) => link.travel_plan_segment_id !== segmentId);
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
    const [removedDay] = state.travelPlanDraft.days.splice(dayIndex, 1);
    for (const segment of Array.isArray(removedDay?.segments) ? removedDay.segments : []) {
      removeSegmentLinks(segment.id);
    }
    renderTravelPlanPanel();
  }

  function addSegment(dayId) {
    syncTravelPlanDraftFromDom();
    const dayIndex = findDayIndex(dayId);
    if (dayIndex < 0) return;
    const day = state.travelPlanDraft.days[dayIndex];
    day.segments = Array.isArray(day.segments) ? day.segments : [];
    day.segments.push(createEmptyTravelPlanSegment());
    renderTravelPlanPanel();
  }

  function removeSegment(segmentId) {
    syncTravelPlanDraftFromDom();
    for (const day of Array.isArray(state.travelPlanDraft.days) ? state.travelPlanDraft.days : []) {
      const segmentIndex = (Array.isArray(day.segments) ? day.segments : []).findIndex((segment) => segment.id === segmentId);
      if (segmentIndex < 0) continue;
      day.segments.splice(segmentIndex, 1);
      removeSegmentLinks(segmentId);
      renderTravelPlanPanel();
      return;
    }
  }

  function moveSegment(segmentId, direction) {
    syncTravelPlanDraftFromDom();
    for (const day of Array.isArray(state.travelPlanDraft.days) ? state.travelPlanDraft.days : []) {
      const segments = Array.isArray(day.segments) ? day.segments : [];
      const segmentIndex = segments.findIndex((segment) => segment.id === segmentId);
      if (segmentIndex < 0) continue;
      const nextIndex = direction === "up" ? segmentIndex - 1 : segmentIndex + 1;
      if (nextIndex < 0 || nextIndex >= segments.length) return;
      const [segment] = segments.splice(segmentIndex, 1);
      segments.splice(nextIndex, 0, segment);
      renderTravelPlanPanel();
      return;
    }
  }

  function addLink(segmentId) {
    syncTravelPlanDraftFromDom();
    state.travelPlanDraft.offer_component_links = Array.isArray(state.travelPlanDraft.offer_component_links)
      ? state.travelPlanDraft.offer_component_links
      : [];
    state.travelPlanDraft.offer_component_links.push(createEmptyTravelPlanOfferComponentLink(segmentId));
    renderTravelPlanPanel();
  }

  function removeLink(linkId) {
    syncTravelPlanDraftFromDom();
    state.travelPlanDraft.offer_component_links = (Array.isArray(state.travelPlanDraft.offer_component_links)
      ? state.travelPlanDraft.offer_component_links
      : []).filter((link) => link.id !== linkId);
    renderTravelPlanPanel();
  }

  async function saveTravelPlan() {
    if (!state.permissions.canEditBooking || !state.booking || !state.travelPlanDirty || state.travelPlanSaving) return false;
    const dateFieldValidation = validateTravelPlanDateFieldsInDom({ allowPartial: false, focusFirstInvalid: true });
    if (!dateFieldValidation.ok) {
      travelPlanStatus(dateFieldValidation.message, "error");
      return false;
    }
    syncTravelPlanDraftFromDom();
    const travelPlanPayload = normalizeTravelPlanDraft({
      ...state.travelPlanDraft,
      offer_component_links: (Array.isArray(state.travelPlanDraft?.offer_component_links) ? state.travelPlanDraft.offer_component_links : [])
        .filter((link) => String(link?.offer_component_id || "").trim())
    }, getOfferComponentsForLinks());
    const validation = validateTravelPlanDraft(travelPlanPayload);
    if (!validation.ok) {
      travelPlanStatus(validation.error, "error");
      return false;
    }
    state.travelPlanSaving = true;
    updateTravelPlanSaveButtonState();
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
      updateTravelPlanSaveButtonState();
    }
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
        sourceLang,
        targetLang: destinationLang
      });
      translated = String(translatedEntries?.value || "").trim();
      if (!translated) throw new Error(bookingT("booking.translation.error", "Could not translate this section."));
    } catch (error) {
      travelPlanStatus(error?.message || bookingT("booking.translation.error", "Could not translate this section."));
      return;
    }
    destinationInput.value = translated;
    syncTravelPlanDraftFromDom();
    updateTravelPlanDirtyState();
    renderBookingSegmentHeader(els.travel_plan_panel_summary, travelPlanSummary());
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
        renderBookingSegmentHeader(els.travel_plan_panel_summary, travelPlanSummary());
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
        renderBookingSegmentHeader(els.travel_plan_panel_summary, travelPlanSummary());
        const shouldRerender = Boolean(
          target?.matches?.('[data-travel-plan-segment-field="timing_kind"]')
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
        if (button.hasAttribute("data-travel-plan-add-segment")) {
          addSegment(button.getAttribute("data-travel-plan-add-segment"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-remove-segment")) {
          removeSegment(button.getAttribute("data-travel-plan-remove-segment"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-move-segment-up")) {
          moveSegment(button.getAttribute("data-travel-plan-move-segment-up"), "up");
          return;
        }
        if (button.hasAttribute("data-travel-plan-move-segment-down")) {
          moveSegment(button.getAttribute("data-travel-plan-move-segment-down"), "down");
          return;
        }
        if (button.hasAttribute("data-travel-plan-add-link")) {
          addLink(button.getAttribute("data-travel-plan-add-link"));
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
    if (els.travel_plan_save_btn && els.travel_plan_save_btn.dataset.travelPlanBound !== "true") {
      els.travel_plan_save_btn.addEventListener("click", () => {
        void saveTravelPlan();
      });
      els.travel_plan_save_btn.dataset.travelPlanBound = "true";
    }
  }

  return {
    applyBookingPayload,
    bindEvents,
    renderTravelPlanPanel,
    updateTravelPlanDirtyState,
    saveTravelPlan
  };
}
