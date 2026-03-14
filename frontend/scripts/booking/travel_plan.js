import { bookingTravelPlanRequest } from "../../Generated/API/generated_APIRequestFactory.js?v=6c388c7e525c";
import { formatMoneyDisplay } from "./pricing.js?v=6c388c7e525c";
import { renderBookingSegmentHeader } from "./segment_headers.js?v=6c388c7e525c";
import {
  TRAVEL_PLAN_OFFER_COVERAGE_TYPE_OPTIONS,
  TRAVEL_PLAN_SEGMENT_KIND_OPTIONS
} from "../shared/generated_catalogs.js?v=6c388c7e525c";
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
} from "./travel_plan_helpers.js?v=6c388c7e525c";

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

  function travelPlanStatus(message) {
    if (!els.travel_plan_status) return;
    els.travel_plan_status.textContent = message;
  }

  function getOfferComponentsForLinks() {
    return getLinkableOfferComponents(state.booking?.offer?.components || []);
  }

  function setTravelPlanDirty(isDirty) {
    setBookingSectionDirty("travel_plan", Boolean(isDirty) && state.permissions.canEditBooking);
  }

  function getTravelPlanSnapshot(plan = state.travelPlanDraft) {
    return JSON.stringify(normalizeTravelPlanDraft(plan, getOfferComponentsForLinks()));
  }

  function updateTravelPlanDirtyState() {
    state.travelPlanDraft = normalizeTravelPlanDraft(state.travelPlanDraft, getOfferComponentsForLinks());
    setTravelPlanDirty(getTravelPlanSnapshot() !== state.originalTravelPlanSnapshot);
  }

  function applyBookingPayload() {
    state.travelPlanDraft = normalizeTravelPlanDraft(state.booking?.travel_plan || createEmptyTravelPlan(), getOfferComponentsForLinks());
    state.originalTravelPlanSnapshot = getTravelPlanSnapshot(state.travelPlanDraft);
    setTravelPlanDirty(false);
    travelPlanStatus("");
  }

  function travelPlanSummary() {
    const days = Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days.length : 0;
    const segments = countTravelPlanSegments(state.travelPlanDraft);
    const uncovered = countUncoveredTravelPlanSegments(state.travelPlanDraft);
    if (!days && !segments) {
      return { primary: "Travel plan", secondary: "No travel plan yet." };
    }
    const secondary = [`${days} day${days === 1 ? "" : "s"}`, `${segments} segment${segments === 1 ? "" : "s"}`];
    if (uncovered > 0) secondary.push(`${uncovered} uncovered`);
    return {
      primary: "Travel plan",
      secondary: secondary.join(" · ")
    };
  }

  function coverageBadgeLabel(status) {
    switch (status) {
      case "covered":
        return "Covered";
      case "partially_covered":
        return "Partially covered";
      case "not_applicable":
        return "Not applicable";
      case "not_covered":
      default:
        return "Not covered";
    }
  }

  function offerComponentSelectOptions(selectedId = "") {
    const selected = String(selectedId || "").trim();
    const options = ['<option value="">Select offer component</option>'];
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
      `<option value="${escapeHtml(option.value)}"${option.value === selectedValue ? " selected" : ""}>${escapeHtml(option.label)}</option>`
    )).join("");
  }

  function segmentKindOptions(selectedValue = "other") {
    return TRAVEL_PLAN_SEGMENT_KIND_OPTIONS.map((option) => (
      `<option value="${escapeHtml(option.value)}"${option.value === selectedValue ? " selected" : ""}>${escapeHtml(option.label)}</option>`
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
          <label for="travel_plan_timing_kind_${escapeHtml(segment.id)}">Time information</label>
          <select id="travel_plan_timing_kind_${escapeHtml(segment.id)}" data-travel-plan-segment-field="timing_kind">
            ${timingKindOptions(timingKind)}
          </select>
        </div>
        <div class="field">
          <label for="travel_plan_time_point_date_${escapeHtml(segment.id)}">Date</label>
          <input id="travel_plan_time_point_date_${escapeHtml(segment.id)}" data-travel-plan-segment-field="time_point_date" type="date" value="${escapeHtml(pointParts.date)}" />
        </div>
        <div class="field">
          <label for="travel_plan_time_point_time_${escapeHtml(segment.id)}">Time</label>
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
          <label for="travel_plan_timing_kind_${escapeHtml(segment.id)}">Time information</label>
          <select id="travel_plan_timing_kind_${escapeHtml(segment.id)}" data-travel-plan-segment-field="timing_kind">
            ${timingKindOptions(timingKind)}
          </select>
        </div>
        <div class="field">
          <label for="travel_plan_start_time_date_${escapeHtml(segment.id)}">Start date</label>
          <input id="travel_plan_start_time_date_${escapeHtml(segment.id)}" data-travel-plan-segment-field="start_time_date" type="date" value="${escapeHtml(startParts.date)}" />
        </div>
        <div class="field">
          <label for="travel_plan_start_time_time_${escapeHtml(segment.id)}">Start time</label>
          <select id="travel_plan_start_time_time_${escapeHtml(segment.id)}" data-travel-plan-segment-field="start_time_time">
            ${timeSelectOptions(startParts.time)}
          </select>
        </div>
        <div class="field">
          <label for="travel_plan_end_time_date_${escapeHtml(segment.id)}">End date</label>
          <input id="travel_plan_end_time_date_${escapeHtml(segment.id)}" data-travel-plan-segment-field="end_time_date" type="date" value="${escapeHtml(endParts.date)}" />
        </div>
        <div class="field">
          <label for="travel_plan_end_time_time_${escapeHtml(segment.id)}">End time</label>
          <select id="travel_plan_end_time_time_${escapeHtml(segment.id)}" data-travel-plan-segment-field="end_time_time">
            ${timeSelectOptions(endParts.time)}
          </select>
        </div>
      `;
    }
    return `
      <div class="field">
        <label for="travel_plan_timing_kind_${escapeHtml(segment.id)}">Time information</label>
        <select id="travel_plan_timing_kind_${escapeHtml(segment.id)}" data-travel-plan-segment-field="timing_kind">
          ${timingKindOptions(timingKind)}
        </select>
      </div>
      <div class="field">
        <label for="travel_plan_time_${escapeHtml(segment.id)}">Human readable time</label>
        <input id="travel_plan_time_${escapeHtml(segment.id)}" data-travel-plan-segment-field="time_label" type="text" value="${escapeHtml(segment.time_label || "")}" placeholder="e.g. morning" />
      </div>
    `;
  }

  function renderTravelPlanLinkRows(segmentId) {
    const segmentLinks = (Array.isArray(state.travelPlanDraft?.offer_component_links) ? state.travelPlanDraft.offer_component_links : [])
      .filter((link) => link.travel_plan_segment_id === segmentId);

    if (!segmentLinks.length) {
      return `
        <div class="travel-plan-link-empty">
          ${getOfferComponentsForLinks().length ? "No linked offer components yet." : "Save offer components first to link financial coverage."}
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
        <button class="btn btn-ghost offer-remove-btn" data-travel-plan-remove-link="${escapeHtml(link.id)}" type="button" aria-label="Remove linked offer component">&times;</button>
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
            <span class="travel-plan-segment__index">Segment ${segmentIndex + 1}</span>
            <span class="travel-plan-coverage-badge travel-plan-coverage-badge--${escapeHtml(coverageStatus.replace(/_/g, "-"))}" data-travel-plan-coverage-badge="${escapeHtml(segment.id)}">${escapeHtml(coverageLabel)}</span>
          </div>
          <div class="travel-plan-segment__actions">
            <button class="btn btn-ghost travel-plan-move-btn" data-travel-plan-move-segment-up="${escapeHtml(segment.id)}" type="button" aria-label="Move segment up">&#8593;</button>
            <button class="btn btn-ghost travel-plan-move-btn" data-travel-plan-move-segment-down="${escapeHtml(segment.id)}" type="button" aria-label="Move segment down">&#8595;</button>
            <button class="btn btn-ghost offer-remove-btn" data-travel-plan-remove-segment="${escapeHtml(segment.id)}" type="button" aria-label="Remove segment">&times;</button>
          </div>
        </div>
        <div class="travel-plan-grid">
          <div class="field">
            <label for="travel_plan_title_${escapeHtml(segment.id)}">Title</label>
            <input id="travel_plan_title_${escapeHtml(segment.id)}" data-travel-plan-segment-field="title" type="text" value="${escapeHtml(segment.title || "")}" />
          </div>
          <div class="field">
            <label for="travel_plan_location_${escapeHtml(segment.id)}">Location</label>
            <input id="travel_plan_location_${escapeHtml(segment.id)}" data-travel-plan-segment-field="location" type="text" value="${escapeHtml(segment.location || "")}" />
          </div>
          <div class="field">
            <label for="travel_plan_kind_${escapeHtml(segment.id)}">Kind</label>
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
            <label for="travel_plan_details_${escapeHtml(segment.id)}">Details</label>
            <textarea id="travel_plan_details_${escapeHtml(segment.id)}" data-travel-plan-segment-field="details" rows="3">${escapeHtml(segment.details || "")}</textarea>
          </div>
          <div class="field">
            <label for="travel_plan_financial_note_${escapeHtml(segment.id)}">Financial Note (APT internal)</label>
            <textarea id="travel_plan_financial_note_${escapeHtml(segment.id)}" data-travel-plan-segment-field="financial_note" rows="3">${escapeHtml(segment.financial_note || "")}</textarea>
          </div>
        </div>
        <div class="travel-plan-links">
          <div class="travel-plan-links__head">
            <h4>Financial coverage</h4>
            <button class="btn btn-ghost travel-plan-link-add-btn" data-travel-plan-add-link="${escapeHtml(segment.id)}" type="button">link offer component</button>
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
          <div>
            <h3>Day ${dayIndex + 1}</h3>
          </div>
          <button class="btn btn-ghost offer-remove-btn" data-travel-plan-remove-day="${escapeHtml(day.id)}" type="button" aria-label="Remove day">&times;</button>
        </div>
        <div class="travel-plan-grid">
          <div class="field">
            <label for="travel_plan_day_title_${escapeHtml(day.id)}">Day title</label>
            <input id="travel_plan_day_title_${escapeHtml(day.id)}" data-travel-plan-day-field="title" type="text" value="${escapeHtml(day.title || "")}" />
          </div>
          <div class="field">
            <label for="travel_plan_day_date_${escapeHtml(day.id)}">Date</label>
            <input id="travel_plan_day_date_${escapeHtml(day.id)}" data-travel-plan-day-field="date" type="date" value="${escapeHtml(day.date || "")}" />
          </div>
          <div class="field">
            <label for="travel_plan_day_overnight_${escapeHtml(day.id)}">Overnight location</label>
            <input id="travel_plan_day_overnight_${escapeHtml(day.id)}" data-travel-plan-day-field="overnight_location" type="text" value="${escapeHtml(day.overnight_location || "")}" />
          </div>
        </div>
        <div class="field">
          <label for="travel_plan_day_notes_${escapeHtml(day.id)}">Day notes</label>
          <textarea id="travel_plan_day_notes_${escapeHtml(day.id)}" data-travel-plan-day-field="notes" rows="3">${escapeHtml(day.notes || "")}</textarea>
        </div>
        ${segments.map((segment, segmentIndex) => renderTravelPlanSegment(day, segment, segmentIndex)).join("") || '<p class="travel-plan-empty">No segments yet.</p>'}
        <div class="travel-plan-day__footer">
          <button class="btn btn-ghost travel-plan-day-add-btn" data-travel-plan-add-segment="${escapeHtml(day.id)}" type="button">new segment</button>
        </div>
      </section>
    `;
  }

  function renderTravelPlanPanel() {
    if (!els.travel_plan_panel || !els.travel_plan_editor || !state.booking) return;
    state.travelPlanDraft = normalizeTravelPlanDraft(state.travelPlanDraft || state.booking.travel_plan, getOfferComponentsForLinks());
    renderBookingSegmentHeader(els.travel_plan_panel_summary, travelPlanSummary());
    els.travel_plan_editor.innerHTML = `
      ${(Array.isArray(state.travelPlanDraft.days) ? state.travelPlanDraft.days : []).map((day, dayIndex) => renderTravelPlanDay(day, dayIndex)).join("") || '<p class="travel-plan-empty">No travel-plan days yet.</p>'}
      <div class="travel-plan-footer">
        <button class="btn btn-ghost booking-offer-add-btn travel-plan-add-day-btn" data-travel-plan-add-day type="button">new day</button>
      </div>
    `;
    if (els.travel_plan_save_btn) {
      els.travel_plan_save_btn.disabled = !state.permissions.canEditBooking;
    }
    updateTravelPlanDirtyState();
  }

  function syncTravelPlanDraftFromDom() {
    if (!els.travel_plan_editor) return state.travelPlanDraft;
    const draft = createEmptyTravelPlan();
    draft.days = Array.from(els.travel_plan_editor.querySelectorAll("[data-travel-plan-day]")).map((dayNode, dayIndex) => {
      const dayId = String(dayNode.getAttribute("data-travel-plan-day") || "").trim();
      const day = createEmptyTravelPlanDay(dayIndex);
      day.id = dayId || day.id;
      day.day_number = dayIndex + 1;
      day.title = String(dayNode.querySelector('[data-travel-plan-day-field="title"]')?.value || "").trim();
      day.date = String(dayNode.querySelector('[data-travel-plan-day-field="date"]')?.value || "").trim();
      day.overnight_location = String(dayNode.querySelector('[data-travel-plan-day-field="overnight_location"]')?.value || "").trim();
      day.notes = String(dayNode.querySelector('[data-travel-plan-day-field="notes"]')?.value || "").trim();
      day.segments = Array.from(dayNode.querySelectorAll("[data-travel-plan-segment]")).map((segmentNode) => {
        const segmentId = String(segmentNode.getAttribute("data-travel-plan-segment") || "").trim();
        const segment = createEmptyTravelPlanSegment();
        segment.id = segmentId || segment.id;
        segment.timing_kind = String(segmentNode.querySelector('[data-travel-plan-segment-field="timing_kind"]')?.value || "label").trim();
        segment.time_label = String(segmentNode.querySelector('[data-travel-plan-segment-field="time_label"]')?.value || "").trim();
        segment.time_point = combineDateAndTime(
          String(segmentNode.querySelector('[data-travel-plan-segment-field="time_point_date"]')?.value || day.date || "").trim(),
          String(segmentNode.querySelector('[data-travel-plan-segment-field="time_point_time"]')?.value || "").trim()
        );
        segment.kind = String(segmentNode.querySelector('[data-travel-plan-segment-field="kind"]')?.value || "").trim();
        segment.title = String(segmentNode.querySelector('[data-travel-plan-segment-field="title"]')?.value || "").trim();
        segment.location = String(segmentNode.querySelector('[data-travel-plan-segment-field="location"]')?.value || "").trim();
        segment.details = String(segmentNode.querySelector('[data-travel-plan-segment-field="details"]')?.value || "").trim();
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
    days.push(createEmptyTravelPlanDay(days.length));
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
    if (!state.permissions.canEditBooking || !state.booking) return false;
    syncTravelPlanDraftFromDom();
    const travelPlanPayload = normalizeTravelPlanDraft({
      ...state.travelPlanDraft,
      offer_component_links: (Array.isArray(state.travelPlanDraft?.offer_component_links) ? state.travelPlanDraft.offer_component_links : [])
        .filter((link) => String(link?.offer_component_id || "").trim())
    }, getOfferComponentsForLinks());
    travelPlanStatus("Saving travel plan...");
    const request = bookingTravelPlanRequest({
      baseURL: apiOrigin,
      params: { booking_id: state.booking.id },
      body: {
        expected_travel_plan_revision: getBookingRevision("travel_plan_revision"),
        travel_plan: travelPlanPayload
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
    travelPlanStatus(response.unchanged ? "No travel-plan changes." : "Travel plan saved.");
    return true;
  }

  function bindEvents() {
    if (els.travel_plan_editor && els.travel_plan_editor.dataset.travelPlanBound !== "true") {
      els.travel_plan_editor.addEventListener("input", () => {
        syncTravelPlanDraftFromDom();
        updateTravelPlanDirtyState();
        renderBookingSegmentHeader(els.travel_plan_panel_summary, travelPlanSummary());
      });
      els.travel_plan_editor.addEventListener("change", (event) => {
        const target = event.target;
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
        if (button.hasAttribute("data-travel-plan-remove-link")) {
          removeLink(button.getAttribute("data-travel-plan-remove-link"));
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
