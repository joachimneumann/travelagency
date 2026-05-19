export const TRAVEL_PLAN_BOUNDARY_KINDS = Object.freeze(["arrival", "departure"]);

function defaultEscapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function translate(t, key, fallback, vars) {
  if (typeof t === "function") return t(key, fallback, vars);
  return String(fallback || "").replace(/\{([^}]+)\}/g, (_match, name) => (
    vars && Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : ""
  ));
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeBoundaryKind(value) {
  return normalizeText(value).toLowerCase() === "departure" ? "departure" : "arrival";
}

function normalizeBoundaryPlacement(value, boundaryKind) {
  const normalizedBoundaryKind = normalizeBoundaryKind(boundaryKind);
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "none") return "none";
  if (normalizedBoundaryKind === "departure") {
    return normalized === "after_last_day" ? "after_last_day" : "last_day";
  }
  return normalized === "before_first_day" ? "before_first_day" : "first_day";
}

export function normalizeAirportCatalogItems(value) {
  return (Array.isArray(value) ? value : [])
    .map((airport) => {
      const source = airport && typeof airport === "object" && !Array.isArray(airport) ? airport : {};
      const code = normalizeText(source.code).toUpperCase();
      const name = normalizeText(source.name);
      return code && name ? { code, name } : null;
    })
    .filter(Boolean);
}

export function travelPlanBoundaryLabel(boundaryKind, { t = null } = {}) {
  return normalizeBoundaryKind(boundaryKind) === "departure"
    ? translate(t, "booking.travel_plan.departure", "Departure")
    : translate(t, "booking.travel_plan.arrival", "Arrival");
}

export function travelPlanBoundaryTitleLabel(boundaryKind, { t = null, compact = false } = {}) {
  if (compact) return translate(t, "booking.travel_plan.title", "Title");
  return normalizeBoundaryKind(boundaryKind) === "departure"
    ? translate(t, "booking.travel_plan.departure_title", "Departure Title")
    : translate(t, "booking.travel_plan.arrival_title", "Arrival Title");
}

export function travelPlanBoundaryDetailsLabel(boundaryKind, { t = null, compact = false } = {}) {
  if (compact) return translate(t, "booking.travel_plan.details", "Details");
  return normalizeBoundaryKind(boundaryKind) === "departure"
    ? translate(t, "booking.travel_plan.departure_details", "Departure Details")
    : translate(t, "booking.travel_plan.arrival_details", "Arrival Details");
}

export function travelPlanBoundaryPlacementOptions(boundaryKind, { t = null } = {}) {
  return normalizeBoundaryKind(boundaryKind) === "departure"
    ? [
        { value: "none", label: translate(t, "booking.travel_plan.departure_none", "No departure") },
        { value: "last_day", label: translate(t, "booking.travel_plan.departure_last_day", "Departure on the last day") },
        { value: "after_last_day", label: translate(t, "booking.travel_plan.departure_after_last_day", "Departure after the last day") }
      ]
    : [
        { value: "none", label: translate(t, "booking.travel_plan.arrival_none", "No arrival") },
        { value: "first_day", label: translate(t, "booking.travel_plan.arrival_first_day", "Arrival on the first day") },
        { value: "before_first_day", label: translate(t, "booking.travel_plan.arrival_before_first_day", "Arrival before the first day") }
      ];
}

export function renderTravelPlanBoundaryPlacementOptions(boundaryKind, selectedValue, {
  escapeHtml = defaultEscapeHtml,
  t = null
} = {}) {
  const selected = normalizeBoundaryPlacement(selectedValue, boundaryKind);
  return travelPlanBoundaryPlacementOptions(boundaryKind, { t }).map((option) => (
    `<option value="${escapeHtml(option.value)}" ${option.value === selected ? "selected" : ""}>${escapeHtml(option.label)}</option>`
  )).join("");
}

function renderDefaultBoundaryField({
  boundaryKind,
  item,
  field,
  label,
  idBase,
  type,
  rows = 3,
  canEdit,
  disabled = false,
  escapeHtml
}) {
  const id = normalizeText(idBase) || `travel_plan_boundary_${field}_${normalizeBoundaryKind(boundaryKind)}`;
  const disabledAttr = canEdit && !disabled ? "" : "disabled";
  const value = normalizeText(item?.[field]);
  if (type === "textregion") {
    const normalizedRows = Math.max(1, Number.parseInt(rows, 10) || 3);
    return `
      <label for="${escapeHtml(id)}">${escapeHtml(label)}</label>
      <textarea id="${escapeHtml(id)}" data-travel-plan-boundary-field="${escapeHtml(field)}" rows="${escapeHtml(normalizedRows)}" ${disabledAttr}>${escapeHtml(value)}</textarea>
    `;
  }
  return `
    <label for="${escapeHtml(id)}">${escapeHtml(label)}</label>
    <input id="${escapeHtml(id)}" data-travel-plan-boundary-field="${escapeHtml(field)}" value="${escapeHtml(value)}" ${disabledAttr} />
  `;
}

export function createTravelPlanBoundarySectionsRenderer({
  escapeHtml = defaultEscapeHtml,
  t = null,
  canEdit = true,
  allowAirportSelect = false,
  allowServiceDetails = true,
  allowTiming = false,
  airportCatalog = [],
  airportLabelIconSrc = "/assets/img/arrival.png",
  resolvePlacementValue = null,
  renderLocalizedField = null,
  renderTimingFields = null
} = {}) {
  const airports = normalizeAirportCatalogItems(airportCatalog);

  function label(boundaryKind) {
    return travelPlanBoundaryLabel(boundaryKind, { t });
  }

  function titleLabel(boundaryKind) {
    return travelPlanBoundaryTitleLabel(boundaryKind, { t, compact: allowAirportSelect });
  }

  function detailsLabel(boundaryKind) {
    return travelPlanBoundaryDetailsLabel(boundaryKind, { t, compact: allowAirportSelect });
  }

  function selectedPlacement(item, boundaryKind) {
    if (typeof resolvePlacementValue === "function") {
      return resolvePlacementValue(item, boundaryKind);
    }
    if (item?.enabled === false) return "none";
    return normalizeBoundaryPlacement(item?.presentation?.attach_to || item?.mode || "", boundaryKind);
  }

  function renderAirportOptions(selectedCode) {
    const normalizedSelectedCode = normalizeText(selectedCode).toUpperCase();
    const hasSelectedAirport = airports.some((airport) => airport.code === normalizedSelectedCode);
    const selectedFallbackOption = normalizedSelectedCode && !hasSelectedAirport
      ? `<option value="${escapeHtml(normalizedSelectedCode)}" selected>${escapeHtml(normalizedSelectedCode)}</option>`
      : "";
    return [
      `<option value="">${escapeHtml(translate(t, "booking.travel_plan.no_airport", "No airport"))}</option>`,
      selectedFallbackOption,
      ...airports.map((airport) => (
        `<option value="${escapeHtml(airport.code)}" data-airport-code="${escapeHtml(airport.code)}" data-airport-name="${escapeHtml(airport.name)}" ${airport.code === normalizedSelectedCode ? "selected" : ""}>${escapeHtml(`${airport.code} - ${airport.name}`)}</option>`
      ))
    ].join("");
  }

  function renderAirportField(boundaryKind, item, { disabled: forceDisabled = false } = {}) {
    const normalizedBoundaryKind = normalizeBoundaryKind(boundaryKind);
    const selectedCode = normalizeText(item?.airport_code).toUpperCase();
    const disabled = canEdit && !forceDisabled ? "" : "disabled";
    if (allowAirportSelect) {
      const airportLabel = translate(t, "booking.travel_plan.airport", "Airport");
      const airportLabelMarkup = normalizedBoundaryKind === "arrival" && normalizeText(airportLabelIconSrc)
        ? `<span class="travel-plan-boundary__airport-label-icon" aria-hidden="true"><img src="${escapeHtml(airportLabelIconSrc)}" alt="" loading="lazy" decoding="async" /></span><span class="visually-hidden">${escapeHtml(airportLabel)}</span>`
        : escapeHtml(airportLabel);
      return `
        <div class="field travel-plan-boundary__airport-field">
          <label for="travel_plan_boundary_airport_${escapeHtml(normalizedBoundaryKind)}">${airportLabelMarkup}</label>
          <select id="travel_plan_boundary_airport_${escapeHtml(normalizedBoundaryKind)}" data-travel-plan-boundary-field="airport_code" data-travel-plan-boundary-airport-select="${escapeHtml(normalizedBoundaryKind)}" ${disabled}>
            ${renderAirportOptions(selectedCode)}
          </select>
        </div>
      `;
    }
    return `
      <div class="field travel-plan-boundary__airport-field">
        <label for="travel_plan_boundary_airport_${escapeHtml(normalizedBoundaryKind)}">${escapeHtml(translate(t, "booking.travel_plan.airport_code", "Airport code"))}</label>
        <input id="travel_plan_boundary_airport_${escapeHtml(normalizedBoundaryKind)}" data-travel-plan-boundary-field="airport_code" value="${escapeHtml(selectedCode)}" ${disabled} />
      </div>
    `;
  }

  function renderBoundaryLocalizedField(options) {
    if (typeof renderLocalizedField === "function") return renderLocalizedField(options);
    return renderDefaultBoundaryField({ ...options, canEdit, escapeHtml });
  }

  function renderTitleField(boundaryKind, item, { disabled = false } = {}) {
    const normalizedBoundaryKind = normalizeBoundaryKind(boundaryKind);
    return `
      <div class="field travel-plan-boundary__title-field">
        ${renderBoundaryLocalizedField({
          boundaryKind: normalizedBoundaryKind,
          item,
          field: "title",
          label: titleLabel(normalizedBoundaryKind),
          idBase: `travel_plan_boundary_title_${normalizedBoundaryKind}_${normalizeText(item?.id)}`,
          type: "input",
          disabled
        })}
      </div>
    `;
  }

  function renderDetailsField(boundaryKind, item, { disabled = false } = {}) {
    if (!allowServiceDetails) return "";
    const normalizedBoundaryKind = normalizeBoundaryKind(boundaryKind);
    return `
      <div class="field travel-plan-boundary__details-field">
        ${renderBoundaryLocalizedField({
          boundaryKind: normalizedBoundaryKind,
          item,
          field: "details",
          label: detailsLabel(normalizedBoundaryKind),
          idBase: `travel_plan_boundary_details_${normalizedBoundaryKind}_${normalizeText(item?.id)}`,
          type: "textregion",
          rows: 3,
          disabled
        })}
      </div>
    `;
  }

  function renderTimingFieldsMarkup(boundaryKind, item, { disabled = false } = {}) {
    if (!allowTiming || typeof renderTimingFields !== "function") return "";
    return renderTimingFields(normalizeBoundaryKind(boundaryKind), item, { disabled });
  }

  function renderTiming(boundaryKind, item, { disabled = false } = {}) {
    const timingFields = renderTimingFieldsMarkup(boundaryKind, item, { disabled });
    if (!timingFields) return "";
    return `
      <div class="travel-plan-grid travel-plan-grid--item travel-plan-grid--item-timing">
        ${timingFields}
      </div>
    `;
  }

  function renderSection(boundaryKind, item = {}) {
    const normalizedBoundaryKind = normalizeBoundaryKind(boundaryKind);
    const sourceItem = item && typeof item === "object" && !Array.isArray(item) ? item : {};
    const boundaryLabel = label(normalizedBoundaryKind);
    const placementValue = selectedPlacement(sourceItem, normalizedBoundaryKind);
    const inactive = placementValue === "none";
    const visibleItem = inactive
      ? {
          ...sourceItem,
          airport_code: "",
          title: "",
          title_i18n: {},
          time: "",
          time_i18n: {}
        }
      : sourceItem;
    const airportField = renderAirportField(normalizedBoundaryKind, visibleItem, { disabled: inactive });
    const titleField = renderTitleField(normalizedBoundaryKind, visibleItem, { disabled: inactive });
    const timingFields = allowAirportSelect ? renderTimingFieldsMarkup(normalizedBoundaryKind, visibleItem, { disabled: inactive }) : "";
    const placementLabelMarkup = `<span class="travel-plan-boundary__placement-label">${escapeHtml(allowAirportSelect ? boundaryLabel : translate(t, "booking.travel_plan.boundary_mode", "Mode"))}</span>`;
    return `
      <section class="travel-plan-boundary${inactive ? " travel-plan-boundary--inactive" : ""}" data-travel-plan-boundary="${escapeHtml(normalizedBoundaryKind)}" data-travel-plan-boundary-inactive="${inactive ? "true" : "false"}">
        <div class="travel-plan-boundary__head${allowAirportSelect ? ` travel-plan-boundary__head--compact${timingFields ? " travel-plan-boundary__head--with-time" : ""}` : ""}">
          ${allowAirportSelect ? "" : `<div class="travel-plan-boundary__label">${escapeHtml(boundaryLabel)}</div>`}
          <label class="travel-plan-boundary__placement">
            ${placementLabelMarkup}
            <select data-travel-plan-boundary-field="placement" ${canEdit ? "" : "disabled"}>
              ${renderTravelPlanBoundaryPlacementOptions(normalizedBoundaryKind, placementValue, { escapeHtml, t })}
            </select>
          </label>
          ${allowAirportSelect ? timingFields : ""}
        </div>
        <div class="travel-plan-boundary__body">
          ${allowAirportSelect
            ? `<div class="travel-plan-grid travel-plan-boundary__first-row">
                ${airportField}
                ${titleField}
              </div>`
            : titleField}
          ${renderDetailsField(normalizedBoundaryKind, sourceItem, { disabled: inactive })}
          ${allowAirportSelect ? "" : renderTiming(normalizedBoundaryKind, visibleItem, { disabled: inactive })}
          ${allowAirportSelect
            ? ""
            : `<div class="travel-plan-grid travel-plan-boundary__meta">
                ${airportField}
              </div>`}
        </div>
      </section>
    `;
  }

  function renderLogistics(resolveBoundaryItem = null, { boundaryKinds = TRAVEL_PLAN_BOUNDARY_KINDS } = {}) {
    const resolveItem = typeof resolveBoundaryItem === "function"
      ? resolveBoundaryItem
      : (boundaryKind) => resolveBoundaryItem?.[boundaryKind] || {};
    const normalizedBoundaryKinds = (Array.isArray(boundaryKinds) && boundaryKinds.length
      ? boundaryKinds
      : TRAVEL_PLAN_BOUNDARY_KINDS)
      .map(normalizeBoundaryKind)
      .filter((boundaryKind, index, list) => list.indexOf(boundaryKind) === index);
    const sectionLabel = normalizedBoundaryKinds.length === 1
      ? label(normalizedBoundaryKinds[0])
      : translate(t, "booking.travel_plan.arrival_departure", "Arrival & departure");
    return `
      <section aria-label="${escapeHtml(sectionLabel)}">
        ${allowAirportSelect ? "" : `<div class="travel-plan-boundaries__title">${escapeHtml(sectionLabel)}</div>`}
        <div class="travel-plan-boundaries__grid">
          ${normalizedBoundaryKinds.map((boundaryKind) => renderSection(boundaryKind, resolveItem(boundaryKind))).join("")}
        </div>
      </section>
    `;
  }

  return {
    renderAirportOptions,
    renderAirportField,
    renderTitleField,
    renderDetailsField,
    renderSection,
    renderLogistics
  };
}

export function applyTravelPlanBoundaryAirportSelection(select) {
  if (typeof Element === "undefined" || !(select instanceof Element)) return false;
  const selectedOption = select.selectedOptions?.[0] || null;
  const code = normalizeText(selectedOption?.dataset?.airportCode || select.value).toUpperCase();
  const name = normalizeText(selectedOption?.dataset?.airportName);
  const boundaryNode = select.closest("[data-travel-plan-boundary]");
  const sourceTitleInput = boundaryNode?.querySelector?.('[data-travel-plan-boundary-field="title"][data-localized-role="source"]')
    || boundaryNode?.querySelector?.('[data-travel-plan-boundary-field="title"]');
  if (!sourceTitleInput || typeof sourceTitleInput.value !== "string") return false;
  if (!code) {
    sourceTitleInput.value = "";
    return true;
  }
  if (!name) return false;
  sourceTitleInput.value = `${name} (${code})`;
  return true;
}

export function applyTravelPlanBoundaryPlacementSelection(select) {
  if (typeof Element === "undefined" || !(select instanceof Element)) return false;
  if (normalizeText(select.value).toLowerCase() !== "none") return false;
  const boundaryNode = select.closest("[data-travel-plan-boundary]");
  if (!boundaryNode) return false;
  const editableFields = boundaryNode.querySelectorAll?.(
    '[data-travel-plan-boundary-field="airport_code"], [data-travel-plan-boundary-field="title"], [data-travel-plan-boundary-field="time"]'
  );
  let changed = false;
  for (const field of Array.from(editableFields || [])) {
    if (typeof field.value !== "string" || field.value === "") continue;
    field.value = "";
    changed = true;
  }
  return changed;
}
