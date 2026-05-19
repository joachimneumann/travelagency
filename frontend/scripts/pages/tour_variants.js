import {
  createApiFetcher,
  escapeHtml,
  formatDateTime,
  normalizeText,
  resolveApiUrl
} from "../shared/api.js";
import { GENERATED_APP_ROLES } from "../../Generated/Models/generated_Roles.js";
import {
  backendT,
  getBackendApiBase,
  getBackendApiOrigin,
  initializeBackendPageChrome,
  loadBackendPageAuthState,
  setBackendPageLoadingOverlay,
  waitForBackendI18n,
  withBackendApiLang
} from "../shared/backend_page.js";
import { buildTourVariantEditHref } from "../shared/links.js";
import { renderPagination } from "../shared/pagination.js";

const apiBase = getBackendApiBase();
const apiOrigin = getBackendApiOrigin();

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  logoutLink: document.getElementById("backendLogoutLink"),
  userLabel: document.getElementById("backendUserLabel"),
  error: document.getElementById("backendError"),
  baseTour: document.getElementById("tourVariantsBaseTour"),
  createBtn: document.getElementById("tourVariantsCreateBtn"),
  search: document.getElementById("tourVariantsSearch"),
  published: document.getElementById("tourVariantsPublished"),
  searchBtn: document.getElementById("tourVariantsSearchBtn"),
  clearBtn: document.getElementById("tourVariantsClearBtn"),
  status: document.getElementById("tourVariantsStatus"),
  table: document.getElementById("tourVariantsTable"),
  pagination: document.getElementById("tourVariantsPagination")
};

const GENERATED_ROLE_LOOKUP = Object.freeze(
  Object.fromEntries(
    GENERATED_APP_ROLES.map((role) => [String(role).replace(/^atp_/, "").toUpperCase(), role])
  )
);

const ROLES = Object.freeze({
  TOUR_EDITOR: GENERATED_ROLE_LOOKUP.TOUR_EDITOR
});

const state = {
  permissions: {
    canReadTourVariants: false,
    canEditTourVariants: false
  },
  page: 1,
  pageSize: 100,
  totalPages: 1,
  totalItems: 0,
  hasLoaded: false,
  search: "",
  published: "",
  options: {
    base_tours: []
  },
  items: [],
  loadToken: 0
};

const fetchApi = createApiFetcher({
  apiBase,
  onError: (message) => showError(message),
  suppressNotFound: false,
  includeDetailInError: true,
  connectionErrorMessage: backendT("booking.error.connect", "Could not connect to backend API.")
});

function refreshBackendNavElements() {
  els.logoutLink = document.getElementById("backendLogoutLink");
  els.userLabel = document.getElementById("backendUserLabel");
}

function hasAnyRoleInList(roleList, ...roles) {
  return roles.some((role) => roleList.includes(role));
}

function showError(message) {
  if (!els.error) return;
  els.error.textContent = String(message || "").trim();
  els.error.classList.toggle("show", Boolean(els.error.textContent));
}

function clearError() {
  showError("");
}

function setStatus(message = "") {
  if (els.status) els.status.textContent = String(message || "").trim();
}

function tourVariantsT(key, fallback, vars) {
  return backendT(`backend.tour_variants.${key}`, fallback, vars);
}

function optionHtml(value, label, selectedValue = "") {
  const normalizedValue = normalizeText(value);
  return `<option value="${escapeHtml(normalizedValue)}"${normalizedValue === selectedValue ? " selected" : ""}>${escapeHtml(label || normalizedValue)}</option>`;
}

function selectedBaseTourId() {
  return els.baseTour instanceof HTMLSelectElement ? normalizeText(els.baseTour.value) : "";
}

function updateCreateButtonState() {
  if (!(els.createBtn instanceof HTMLButtonElement)) return;
  els.createBtn.disabled = !state.permissions.canEditTourVariants || !selectedBaseTourId();
}

function renderBaseTourOptions() {
  if (!(els.baseTour instanceof HTMLSelectElement)) return;
  const options = Array.isArray(state.options.base_tours) ? state.options.base_tours : [];
  const optionIds = new Set(options.map((tour) => normalizeText(tour?.id)).filter(Boolean));
  const selectedValue = optionIds.has(selectedBaseTourId()) ? selectedBaseTourId() : "";
  els.baseTour.innerHTML = [
    optionHtml("", options.length
      ? tourVariantsT("choose_base_marketing_tour", "Choose a base marketing tour")
      : tourVariantsT("no_published_marketing_tours", "No published marketing tours"), selectedValue),
    ...options.map((tour) => optionHtml(tour.id, `${tour.title || tour.id} (${tour.day_count || 0})`, selectedValue))
  ].join("");
  els.baseTour.disabled = !options.length;
  updateCreateButtonState();
}

function publicationLabel(variant) {
  return variant?.published_on_webpage === true
    ? tourVariantsT("published", "Published")
    : tourVariantsT("draft", "Draft");
}

function publicationClass(variant) {
  return variant?.published_on_webpage === true ? "tour-variant-status--published" : "tour-variant-status--draft";
}

function formatIntegerWithGrouping(value) {
  if (!Number.isFinite(Number(value))) return "-";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    useGrouping: true
  }).format(Number(value));
}

function formatWebPagePriority(value) {
  const numberValue = Number(value);
  const normalized = Number.isFinite(numberValue) ? Math.round(numberValue) : 50;
  return String(Math.min(100, Math.max(0, normalized)));
}

function variantInitials(title) {
  const words = normalizeText(title).split(/\s+/).filter(Boolean);
  if (!words.length) return "TV";
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase() || "").join("") || "TV";
}

function renderVariantThumbnail(variant) {
  const title = normalizeText(variant?.title || variant?.id);
  const thumbnailUrl = normalizeText(variant?.thumbnail_url);
  if (thumbnailUrl) {
    return `<img class="booking-list__booking-thumb-image" src="${escapeHtml(resolveApiUrl(apiBase, thumbnailUrl))}" alt="${escapeHtml(title || backendT("tour.picture_label", "Tour picture"))}" loading="lazy" />`;
  }
  return `<span class="booking-list__booking-thumb-initials">${escapeHtml(variantInitials(title))}</span>`;
}

function dayCountLabel(count) {
  const normalizedCount = Number.isFinite(Number(count)) ? Number(count) : 0;
  return normalizedCount === 1
    ? tourVariantsT("day_count_one", "1 day")
    : tourVariantsT("day_count_other", "{count} days", { count: String(normalizedCount) });
}

function fallbackDayLabel(dayIndex) {
  return tourVariantsT("day_label", "Day {day}", { day: String(dayIndex + 1) });
}

function resolvedVariantDayRows(variant) {
  const resolvedDays = Array.isArray(variant?.travel_plan?.days) ? variant.travel_plan.days : [];
  const referencedDays = Array.isArray(variant?.days) ? variant.days : [];
  const rowCount = Math.max(resolvedDays.length, referencedDays.length);
  return Array.from({ length: rowCount }, (_unused, index) => {
    const resolvedDay = resolvedDays[index] && typeof resolvedDays[index] === "object" && !Array.isArray(resolvedDays[index])
      ? resolvedDays[index]
      : {};
    const referencedDay = referencedDays[index] && typeof referencedDays[index] === "object" && !Array.isArray(referencedDays[index])
      ? referencedDays[index]
      : {};
    return {
      label: fallbackDayLabel(index),
      title: normalizeText(resolvedDay.title || referencedDay.source_day_title),
      sourceTourTitle: normalizeText(referencedDay.source_tour_title || resolvedDay.source_tour_title || referencedDay.source_tour_id)
    };
  });
}

function renderVariantDaysCell(variant) {
  const rows = resolvedVariantDayRows(variant);
  const travelPlanDays = Array.isArray(variant?.travel_plan?.days) ? variant.travel_plan.days : [];
  const serviceCount = travelPlanDays.reduce((total, day) => total + (Array.isArray(day?.services) ? day.services.length : 0), 0);
  const dayTitles = rows
    .map((day) => normalizeText(day.title) || normalizeText(day.label))
    .filter(Boolean)
    .join(" | ");
  const servicesLabel = backendT(
    serviceCount === 1 ? "booking.travel_plan.summary.item" : "booking.travel_plan.summary.items",
    serviceCount === 1 ? "{count} service" : "{count} services",
    { count: formatIntegerWithGrouping(serviceCount) }
  );
  return `
    <div class="booking-list__plan-summary tour-variant-days"${dayTitles ? ` title="${escapeHtml(dayTitles)}"` : ""}>
      <div class="booking-list__plan-primary">${escapeHtml(dayCountLabel(rows.length))}</div>
      <div class="booking-list__plan-secondary">${escapeHtml(servicesLabel)}</div>
    </div>
  `;
}

function issuesText(variant) {
  const issues = Array.isArray(variant?.publication?.issues) ? variant.publication.issues : [];
  if (variant?.published_on_webpage !== true || !issues.length) return "";
  return issues.map(localizePublicationIssue).join(" ");
}

function localizePublicationIssue(issue) {
  const text = normalizeText(issue);
  if (!text) return "";
  const referencedDaysMatch = text.match(/^Referenced days are missing: (.+)\.$/);
  if (referencedDaysMatch) {
    return tourVariantsT("issue_referenced_days_missing", "Referenced days are missing: {refs}.", {
      refs: referencedDaysMatch[1]
    });
  }
  const referencedToursMatch = text.match(/^Referenced tours are not published: (.+)\.$/);
  if (referencedToursMatch) {
    return tourVariantsT("issue_referenced_tours_unpublished", "Referenced tours are not published: {refs}.", {
      refs: referencedToursMatch[1]
    });
  }
  const knownIssues = new Map([
    ["Tour Variant id is required.", ["issue_id_required", "Tour Variant id is required."]],
    ["Title is required.", ["issue_title_required", "Title is required."]],
    ["At least one style is required.", ["issue_style_required", "At least one style is required."]],
    ["At least one day is required.", ["issue_day_required", "At least one day is required."]],
    ["Base marketing tour is required.", ["issue_base_required", "Base marketing tour is required."]],
    ["Base marketing tour was not found.", ["issue_base_not_found", "Base marketing tour was not found."]],
    ["Base marketing tour must be published.", ["issue_base_must_be_published", "Base marketing tour must be published."]],
    ["The selected days do not have enough public tour-card content.", ["issue_tour_card_content_required", "The selected days do not have enough public tour-card content."]]
  ]);
  const entry = knownIssues.get(text);
  return entry ? tourVariantsT(entry[0], entry[1]) : text;
}

function variantBaseTourLabel(variant) {
  const baseTourId = normalizeText(variant?.base_marketing_tour_id);
  if (!baseTourId) return "";
  const baseTour = (Array.isArray(state.options.base_tours) ? state.options.base_tours : [])
    .find((tour) => normalizeText(tour?.id) === baseTourId);
  return normalizeText(baseTour?.title) || baseTourId;
}

function renderVariantPublicationMeta(variant) {
  if (variant?.published_on_webpage === true) {
    return `
      <span class="tour-list__published-meta">
        <span class="tour-list__published-pill">${escapeHtml(backendT("backend.tours.published_pill", "web page"))}</span>
        <span class="tour-list__published-priority" aria-label="${escapeHtml(backendT("backend.tours.web_page_priority", "Web page ranking priority"))}">${escapeHtml(formatWebPagePriority(variant?.priority))}</span>
      </span>
    `;
  }
  return `<span class="tour-variant-status ${publicationClass(variant)}">${escapeHtml(publicationLabel(variant))}</span>`;
}

function renderTable() {
  if (!els.table) return;
  if (!state.items.length) {
    els.table.innerHTML = `
      <tbody>
        <tr><td colspan="3">${escapeHtml(backendT("backend.tour_variants.empty", "No Tour Variants found."))}</td></tr>
      </tbody>
    `;
    return;
  }
  els.table.innerHTML = `
    <tbody>
      ${state.items.map((variant) => {
        const href = buildTourVariantEditHref(variant.id);
        const issues = issuesText(variant);
        const title = variant.title || variant.id;
        const baseTourLabel = variantBaseTourLabel(variant);
        const updatedAt = formatDateTime(variant.updated_at || variant.created_at);
        const rowAriaLabel = tourVariantsT("open_tour_variant", "Open Tour Variant {name}", {
          name: title
        });
        const actionButton = state.permissions.canEditTourVariants
          ? `<button class="btn btn-ghost offer-remove-btn" type="button" data-delete-id="${escapeHtml(variant.id)}" title="${escapeHtml(backendT("common.delete", "Delete"))}" aria-label="${escapeHtml(backendT("common.delete", "Delete"))}">&times;</button>`
          : "";
        return `
          <tr class="tour-list__row tour-list__row--clickable tour-variant-row" tabindex="0" role="link" aria-label="${escapeHtml(rowAriaLabel)}" data-href="${escapeHtml(href)}">
            <td>
              <div class="booking-list__name-cell">
                <span class="booking-list__booking-thumb">${renderVariantThumbnail(variant)}</span>
                <div class="booking-list__name-copy">
                  <div class="booking-list__booking-name">
                    <span>${escapeHtml(title)}</span>
                  </div>
                  <div class="booking-list__representative">
                    <span class="booking-list__representative-name">${escapeHtml(baseTourLabel || variant.base_marketing_tour_id || "-")}</span>
                  </div>
                  ${issues ? `<span class="micro tour-variant-issues">${escapeHtml(issues)}</span>` : ""}
                </div>
              </div>
            </td>
            <td class="booking-list__meta-cell">${renderVariantDaysCell(variant)}</td>
            <td class="tour-list__updated-cell" aria-label="${escapeHtml(backendT("backend.table.updated", "Updated"))}: ${escapeHtml(updatedAt)}">
              <div class="tour-list__updated-cell-content">
                <div class="tour-list__updated-summary">
                  ${renderVariantPublicationMeta(variant)}
                  <div class="tour-list__updated-primary">${escapeHtml(updatedAt)}</div>
                </div>
                ${actionButton}
              </div>
            </td>
          </tr>
        `;
      }).join("")}
    </tbody>
  `;
  els.table.querySelectorAll(".tour-variant-row[data-href]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target instanceof HTMLElement && event.target.closest("button")) return;
      window.location.href = row.getAttribute("data-href") || "tour_variants.html";
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      window.location.href = row.getAttribute("data-href") || "tour_variants.html";
    });
  });
  els.table.querySelectorAll("button[data-delete-id]").forEach((button) => {
    button.addEventListener("click", () => {
      void deleteTourVariant(button.getAttribute("data-delete-id"));
    });
  });
}

function renderPager(pagination) {
  const page = Number(pagination?.page || state.page);
  const totalPages = Number(pagination?.total_pages || 1);
  state.page = page;
  state.totalPages = totalPages;
  renderPagination(els.pagination, {
    page,
    totalPages
  }, (nextPage) => {
    state.page = nextPage;
    void loadTourVariants();
  });
}

function currentQuery() {
  return {
    page: state.page,
    page_size: state.pageSize,
    ...(state.search ? { search: state.search } : {}),
    ...(state.published ? { published: state.published } : {})
  };
}

async function loadTourVariants() {
  const token = state.loadToken + 1;
  state.loadToken = token;
  setStatus(tourVariantsT("loading", "Loading..."));
  const payload = await fetchApi(withBackendApiLang("/api/v1/tour-variants", currentQuery()), {
    cache: "no-store"
  });
  if (!payload || token !== state.loadToken) return;
  state.items = Array.isArray(payload.items) ? payload.items : [];
  state.options = payload.options && typeof payload.options === "object" ? payload.options : state.options;
  state.totalItems = Number(payload.pagination?.total_items || state.items.length);
  state.hasLoaded = true;
  renderBaseTourOptions();
  renderTable();
  renderPager(payload.pagination || {});
  setStatus(tourVariantsT("count_status", "{count} of {total}", {
    count: String(state.items.length),
    total: String(state.totalItems)
  }));
}

async function createTourVariant() {
  if (!(els.baseTour instanceof HTMLSelectElement)) return;
  const baseMarketingTourId = normalizeText(els.baseTour.value);
  if (!baseMarketingTourId) {
    showError(tourVariantsT("choose_base_marketing_tour", "Choose a base marketing tour."));
    return;
  }
  setStatus(tourVariantsT("creating", "Creating..."));
  const payload = await fetchApi(withBackendApiLang("/api/v1/tour-variants"), {
    method: "POST",
    body: {
      base_marketing_tour_id: baseMarketingTourId
    }
  });
  if (!payload?.tour_variant?.id) return;
  window.location.href = buildTourVariantEditHref(payload.tour_variant.id);
}

async function deleteTourVariant(id) {
  const tourVariantId = normalizeText(id);
  if (!tourVariantId) return;
  const item = state.items.find((variant) => variant.id === tourVariantId);
  const label = item?.title || tourVariantId;
  if (!window.confirm(tourVariantsT("delete_confirm", "Delete {name}?", { name: label }))) return;
  setStatus(tourVariantsT("deleting", "Deleting..."));
  const payload = await fetchApi(withBackendApiLang(`/api/v1/tour-variants/${encodeURIComponent(tourVariantId)}`), {
    method: "DELETE"
  });
  if (!payload?.ok) return;
  await loadTourVariants();
}

function bindControls() {
  els.baseTour?.addEventListener("change", updateCreateButtonState);
  els.createBtn?.addEventListener("click", () => {
    void createTourVariant();
  });
  els.searchBtn?.addEventListener("click", () => {
    state.page = 1;
    state.search = normalizeText(els.search?.value);
    state.published = normalizeText(els.published?.value);
    void loadTourVariants();
  });
  els.clearBtn?.addEventListener("click", () => {
    if (els.search instanceof HTMLInputElement) els.search.value = "";
    if (els.published instanceof HTMLSelectElement) els.published.value = "";
    state.page = 1;
    state.search = "";
    state.published = "";
    void loadTourVariants();
  });
  els.search?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    state.page = 1;
    state.search = normalizeText(els.search.value);
    state.published = normalizeText(els.published?.value);
    void loadTourVariants();
  });
}

function handleBackendLanguageChanged() {
  renderBaseTourOptions();
  renderTable();
  renderPager({ page: state.page, total_pages: state.totalPages });
  if (state.hasLoaded) {
    setStatus(tourVariantsT("count_status", "{count} of {total}", {
      count: String(state.items.length),
      total: String(state.totalItems)
    }));
  }
  if (!state.permissions.canReadTourVariants) {
    showError(tourVariantsT("forbidden", "You do not have access to Tour Variants."));
  }
}

async function init() {
  setBackendPageLoadingOverlay(true);
  try {
    await waitForBackendI18n();
    window.addEventListener("backend-i18n-changed", handleBackendLanguageChanged);

    const chrome = await initializeBackendPageChrome({
      currentSection: "tour_variants",
      homeLink: els.homeLink,
      refreshNav: refreshBackendNavElements
    });
    els.logoutLink = chrome.logoutLink;
    els.userLabel = chrome.userLabel;

    const authState = await loadBackendPageAuthState({
      apiOrigin,
      refreshNav: refreshBackendNavElements,
      computePermissions: (roles) => ({
        canReadTourVariants: hasAnyRoleInList(roles, ROLES.TOUR_EDITOR),
        canEditTourVariants: hasAnyRoleInList(roles, ROLES.TOUR_EDITOR)
      }),
      hasPageAccess: (permissions) => permissions.canReadTourVariants,
      logKey: "backend-tour-variants",
      pageName: "tour_variants.html",
      expectedRolesAnyOf: [ROLES.TOUR_EDITOR],
      likelyCause: "The user is authenticated in Keycloak but does not have atp_tour_editor."
    });
    state.permissions = {
      canReadTourVariants: Boolean(authState.permissions?.canReadTourVariants),
      canEditTourVariants: Boolean(authState.permissions?.canEditTourVariants)
    };
    bindControls();
    if (!state.permissions.canReadTourVariants) {
      showError(tourVariantsT("forbidden", "You do not have access to Tour Variants."));
      return;
    }
    await loadTourVariants();
  } catch (error) {
    console.error("[backend-tour-variants] initialization failed", error);
    showError(error?.message || tourVariantsT("load_failed", "Could not load Tour Variants."));
  } finally {
    setBackendPageLoadingOverlay(false);
  }
}

void init();
