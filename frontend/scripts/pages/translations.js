import { createApiFetcher, escapeHtml, formatDateTime, normalizeText } from "../shared/api.js";
import {
  getBackendApiOrigin,
  initializeBackendPageChrome,
  loadBackendPageAuthState,
  refreshBackendNavElements
} from "../shared/backend_page.js";

const ROLES = { ADMIN: "atp_admin" };

const SECTION_CONFIGS = [
  {
    key: "backend-staff",
    domainId: "backend",
    title: "1. Staff backend terms",
    description: "Staff-facing backend UI strings.",
    fixedTargetLang: "vi",
    languageLabel: "EN -> VI"
  },
  {
    key: "customer-ui",
    domainId: "frontend",
    title: "2. Customer UI",
    description: "Public website UI strings shared by customer pages."
  },
  {
    key: "index-content",
    domainId: "index-content-memory",
    title: "3. index.html texts",
    description: "Customer-facing index.html text, excluding marketing tours."
  },
  {
    key: "marketing-tours",
    domainId: "marketing-tour-memory",
    title: "5. Marketing tours",
    description: "Exact-source cache and manual overrides used when staff translate marketing-tour content."
  }
];

const STATUS_OPTIONS = [
  ["", "All"],
  ["origin:manual", "Manual"],
  ["origin:machine", "Machine"],
  ["freshness_state:stale", "Stale"],
  ["freshness_state:missing", "Missing"],
  ["freshness_state:legacy", "Legacy"],
  ["publish_state:published", "Published"],
  ["publish_state:unpublished", "Unpublished"],
  ["review_state:protected", "Protected"],
  ["extra", "Extra"]
];

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  error: document.getElementById("backendError"),
  panel: document.getElementById("translationsPanel"),
  status: document.getElementById("translationsStatus"),
  sections: document.getElementById("translationsSections"),
  customerLanguageSelect: null,
  translateBtn: document.getElementById("translationsTranslateBtn"),
  retranslateFrontendAllBtn: document.getElementById("translationsRetranslateFrontendAllBtn"),
  clearMarketingTourCacheBtn: document.getElementById("translationsClearMarketingTourCacheBtn"),
  retranslateBackendViBtn: document.getElementById("translationsRetranslateBackendViBtn"),
  overlay: document.getElementById("translationsApplyOverlay"),
  overlayText: document.getElementById("translationsApplyOverlayText"),
  applyLog: document.getElementById("translationsApplyLog")
};

const state = {
  domains: [],
  sections: new Map(),
  permissions: {
    canReadTranslations: false,
    canEditTranslations: false
  },
  translationWritesEnabled: true,
  translationStatus: null,
  customerTargetLang: "",
  isStatusRefreshing: false,
  isLoadingSections: false,
  isSaving: false,
  isJobRunning: false
};

const MIN_TRANSLATIONS_OVERLAY_MS = 500;

const apiOrigin = getBackendApiOrigin();
const fetchApi = createApiFetcher({
  apiBase: apiOrigin,
  onError: (message) => showError(message),
  includeDetailInError: true,
  connectionErrorMessage: "Could not connect to backend API."
});

function showError(message) {
  if (!els.error) return;
  els.error.textContent = normalizeText(message);
  els.error.hidden = !normalizeText(message);
}

function setStatus(message) {
  if (els.status) els.status.textContent = normalizeText(message);
}

function setSectionStatus(section, message) {
  if (section?.els?.localStatus) section.els.localStatus.textContent = normalizeText(message);
}

function translationsApplyingOverlayText() {
  return backendT("backend.translations.applying_overlay", "Publishing translations. Please wait.");
}

function translationsTranslateOverlayText() {
  return backendT("backend.translations.translating_overlay", "Translating and publishing content. Please wait.");
}

function translationsRefreshingOverlayText() {
  return backendT("backend.translations.refreshing_overlay", "Refreshing translation state. Please wait.");
}

function retranslateFrontendAllOverlayText() {
  return backendT(
    "backend.translations.retranslate_frontend_all_overlay",
    "Retranslating customer UI strings. Please wait."
  );
}

function clearMarketingTourCacheOverlayText() {
  return backendT(
    "backend.translations.clear_marketing_tour_cache_overlay",
    "Clearing marketing tour translation cache. Please wait."
  );
}

function retranslateBackendViOverlayText() {
  return backendT(
    "backend.translations.retranslate_backend_vi_overlay",
    "Retranslating backend Vietnamese. Please wait."
  );
}

function languageLabel(language) {
  return normalizeText(language?.nativeLabel || language?.native_label || language?.code).toUpperCase();
}

function safeDomId(value) {
  return normalizeText(value).replace(/[^a-z0-9_-]+/gi, "_");
}

function getDomain(domainId) {
  return state.domains.find((entry) => entry.id === domainId) || null;
}

function isCustomerSectionConfig(config) {
  return !config?.fixedTargetLang;
}

function customerSectionConfigs() {
  return SECTION_CONFIGS.filter(isCustomerSectionConfig);
}

function sharedCustomerLanguages() {
  const domains = customerSectionConfigs()
    .map((config) => getDomain(config.domainId))
    .filter(Boolean);
  if (!domains.length) return [];

  const commonCodes = new Set((domains[0].target_languages || []).map((language) => language.code));
  for (const domain of domains.slice(1)) {
    const domainCodes = new Set((domain.target_languages || []).map((language) => language.code));
    for (const code of Array.from(commonCodes)) {
      if (!domainCodes.has(code)) commonCodes.delete(code);
    }
  }
  return (domains[0].target_languages || []).filter((language) => commonCodes.has(language.code));
}

function dirtySections() {
  return Array.from(state.sections.values()).filter((section) => section.dirty.size > 0);
}

function dirtyCustomerSections() {
  return dirtySections().filter((section) => isCustomerSectionConfig(section.config));
}

function numberCount(value) {
  return Math.max(0, Number(value) || 0);
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function translationIssueCountFromCounts(counts = {}) {
  return numberCount(counts["freshness_state.missing"])
    + numberCount(counts["freshness_state.stale"])
    + numberCount(counts["freshness_state.legacy"]);
}

function loadedSectionMessage(section) {
  return `Loaded ${section?.current?.total || 0} strings.`;
}

function updateSectionEditStatus(section) {
  if (!section?.current) return;
  if (section.dirty.size) {
    setSectionStatus(section, `${pluralize(section.dirty.size, "unsaved manual override edit")} staged.`);
    return;
  }
  setSectionStatus(section, loadedSectionMessage(section));
}

function isCentralContentSection(section) {
  const kind = normalizeText(section?.current?.domain?.kind || section?.domain?.kind);
  return kind === "translation_memory";
}

function relatedCleanSectionsForMutation(changedSection) {
  if (!isCentralContentSection(changedSection)) return [];
  const targetLang = normalizeText(changedSection?.current?.target_lang);
  return Array.from(state.sections.values()).filter((section) => (
    section !== changedSection
    && section.current
    && !section.dirty.size
    && isCentralContentSection(section)
    && normalizeText(section.current.target_lang) === targetLang
  ));
}

function summarizeTranslationStatus(payload) {
  const missingCount = numberCount(payload?.missing_count);
  const staleCount = numberCount(payload?.stale_count);
  const legacyCount = numberCount(payload?.legacy_count);
  const untranslatedCount = numberCount(payload?.untranslated_count);
  const unpublishedCount = numberCount(payload?.unpublished_count);
  const dirtyCount = numberCount(payload?.dirty_count);
  const unavailableCount = Array.isArray(payload?.unavailable) ? payload.unavailable.length : 0;
  const translationIssueCount = missingCount + staleCount + legacyCount;
  return {
    loaded: true,
    dirty: Boolean(payload?.dirty || dirtyCount > 0),
    total: numberCount(payload?.total),
    dirtyCount,
    missingCount,
    staleCount,
    legacyCount,
    untranslatedCount,
    unpublishedCount,
    unavailableCount,
    translationIssueCount,
    publishReadyCount: translationIssueCount > 0 ? 0 : unpublishedCount
  };
}

function currentTranslationActionState() {
  const status = state.translationStatus;
  const loaded = Boolean(status?.loaded);
  const translateNeeded = loaded && status.translationIssueCount > 0;
  const publishReady = loaded && !translateNeeded && status.publishReadyCount > 0;
  const translateActionReady = translateNeeded || publishReady;
  return {
    loaded,
    translateNeeded,
    publishReady,
    translateActionReady,
    status
  };
}

function translationActionTitle(action, translationState, actionsBusy) {
  if (actionsBusy) return "Updating translation state.";
  if (!state.permissions.canEditTranslations) {
    return "Translation editing is disabled for your account or this environment.";
  }
  if (action === "translate") {
    if (translationState.translateNeeded) return "Translate all missing or stale strings, then publish automatically if clean.";
    if (translationState.publishReady) return "Publish the translated snapshot.";
    return translationState.loaded ? "No strings need translation or publishing." : "Loading translation status.";
  }
  if (translationState.translateNeeded) return "Translate missing or stale strings before publishing.";
  return translationState.publishReady ? "Publish the translated snapshot." : "No translated strings are ready to publish.";
}

function configureTranslationActionButton(button, action, translationState, canRunTranslationAction, actionsBusy) {
  if (!button) return;
  button.classList.toggle("is-waiting", Boolean(actionsBusy));
  if (actionsBusy) {
    button.setAttribute("aria-busy", "true");
  } else {
    button.removeAttribute("aria-busy");
  }
  if (action === "translate") {
    button.disabled = !canRunTranslationAction || !translationState.translateActionReady;
    button.title = translationActionTitle(action, translationState, actionsBusy);
    return;
  }
  button.disabled = !canRunTranslationAction || translationState.translateNeeded || !translationState.publishReady;
  button.title = translationActionTitle(action, translationState, actionsBusy);
}

function translationStatusMessage(status) {
  if (!status?.loaded) return "Loading translation status.";
  const count = numberCount(status.translationIssueCount);
  const subject = count === 1 ? "string" : "strings";
  const verb = count === 1 ? "needs" : "need";
  const base = `${count} ${subject} ${verb} translation before publishing.`;
  if (count > 0) return base;
  if (status.publishReadyCount > 0) {
    return `${base} ${pluralize(status.publishReadyCount, "translated string")} ready to publish with Translate.`;
  }
  if (status.dirty) {
    return `${base} ${pluralize(status.dirtyCount, "translation item")} still need attention.`;
  }
  if (status.unavailableCount > 0) {
    return `${base} ${pluralize(status.unavailableCount, "section")} could not be checked.`;
  }
  return `${base} Translations are clean and published.`;
}

function syncTranslationStatusText(status = state.translationStatus) {
  const message = translationStatusMessage(status);
  setStatus(message);
}

function refreshTranslationStatusText() {
  syncTranslationStatusText(state.translationStatus);
}

function notifyBackendTranslationsStatus(status = state.translationStatus) {
  const detail = status?.loaded
    ? { dirty: Boolean(status.dirty), refresh: false }
    : {};
  window.dispatchEvent(new CustomEvent("backend-translations-status-refresh", { detail }));
}

async function loadTranslationStatus({ updateMessage = false } = {}) {
  state.isStatusRefreshing = true;
  updateActions();
  try {
    const payload = await fetchApi("/api/v1/static-translations/status", { cache: "no-store" });
    if (!payload) {
      state.translationStatus = null;
      setStatus("Could not load translation status.");
      notifyBackendTranslationsStatus(null);
      return null;
    }
    const nextStatus = summarizeTranslationStatus(payload);
    state.translationStatus = nextStatus;
    notifyBackendTranslationsStatus(nextStatus);
    if (updateMessage || nextStatus.loaded) syncTranslationStatusText(nextStatus);
    return nextStatus;
  } finally {
    state.isStatusRefreshing = false;
    updateActions();
  }
}

function updateActions() {
  const translationState = currentTranslationActionState();
  const actionsBusy = state.isSaving || state.isJobRunning || state.isStatusRefreshing;
  const sectionControlsBusy = state.isSaving || state.isJobRunning || state.isLoadingSections;
  const canRunTranslationAction = state.permissions.canEditTranslations && !actionsBusy;
  configureTranslationActionButton(els.translateBtn, "translate", translationState, canRunTranslationAction, actionsBusy);
  if (els.retranslateFrontendAllBtn) {
    els.retranslateFrontendAllBtn.disabled = !state.permissions.canEditTranslations || actionsBusy;
  }
  if (els.clearMarketingTourCacheBtn) {
    els.clearMarketingTourCacheBtn.disabled = !state.permissions.canEditTranslations || actionsBusy;
  }
  if (els.retranslateBackendViBtn) {
    els.retranslateBackendViBtn.disabled = !state.permissions.canEditTranslations || actionsBusy;
  }
  if (translationState.loaded) syncTranslationStatusText(translationState.status);

  for (const section of state.sections.values()) {
    const sectionDirty = section.dirty.size;
    if (section.els.saveBtn) {
      section.els.saveBtn.disabled = !state.permissions.canEditTranslations || !sectionDirty || sectionControlsBusy;
      section.els.saveBtn.textContent = sectionDirty ? `Save manual overrides (${sectionDirty})` : "Save manual overrides";
    }
    if (section.els.exportBtn) {
      section.els.exportBtn.disabled = !state.permissions.canReadTranslations || !section.current || sectionControlsBusy;
    }
    if (section.els.importBtn) {
      section.els.importBtn.disabled = !state.permissions.canEditTranslations || !section.current || sectionControlsBusy;
    }
    section.els.table?.querySelectorAll("[data-override-key]").forEach((textarea) => {
      textarea.disabled = !state.permissions.canEditTranslations || sectionControlsBusy;
    });
    section.els.table?.querySelectorAll("[data-cache-delete-key]").forEach((button) => {
      button.disabled = !state.permissions.canEditTranslations || sectionControlsBusy;
    });
  }
  if (els.customerLanguageSelect) {
    els.customerLanguageSelect.disabled = !sharedCustomerLanguages().length || sectionControlsBusy;
  }
}

function customerLanguageTemplate() {
  return `
    <div class="translations-customer-language">
      <div class="field">
        <label for="translations_customer_language">Customer language</label>
        <select id="translations_customer_language" data-customer-language></select>
      </div>
    </div>
  `;
}

function sectionTemplate(config) {
  const id = safeDomId(config.key);
  const statusOptions = STATUS_OPTIONS
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
    .join("");
  const languageControl = config.fixedTargetLang
    ? `
      <div class="field">
        <label>Language</label>
        <p class="translations-fixed-language">${escapeHtml(config.languageLabel || "EN -> VI")}</p>
      </div>
    `
    : "";
  const controlsClass = config.fixedTargetLang
    ? "translations-controls"
    : "translations-controls translations-controls--customer";

  return `
    <details class="translations-section" data-translation-section="${escapeHtml(config.key)}">
      <summary class="translations-section__summary">
        <span class="translations-section__summary-title">
          <span class="translations-section__title" role="heading" aria-level="2">${escapeHtml(config.title)}</span>
          <span class="translations-section__health translations-section__health--loading" data-section-health aria-label="Translation state is loading." title="Translation state is loading.">...</span>
        </span>
      </summary>

      <div class="translations-section__body">
        <div class="translations-section__head">
          <div>
            <p class="micro">${escapeHtml(config.description)}</p>
            <p class="micro translations-section__local-status" data-section-local-status></p>
          </div>
          <div class="translations-section__actions">
            <button class="btn btn-ghost" type="button" data-section-export>Export manual overrides</button>
            <button class="btn btn-ghost" type="button" data-section-import>Import manual overrides</button>
            <input type="file" accept="application/json,.json" hidden data-section-import-input />
            <button class="btn btn-primary" type="button" disabled data-section-save>Save manual overrides</button>
          </div>
        </div>

        <div class="${controlsClass}">
          ${languageControl}
          <div class="field">
            <label for="translations_${id}_search">Search</label>
            <input id="translations_${id}_search" type="search" autocomplete="off" placeholder="English term, cache, manual override" data-section-search />
          </div>
          <div class="field">
            <label for="translations_${id}_status">Status</label>
            <select id="translations_${id}_status" data-section-filter>${statusOptions}</select>
          </div>
        </div>

        <div class="translations-summary" data-section-summary></div>

        <div class="backend-table-wrap translations-table-wrap">
          <table class="backend-table translations-table" data-section-table></table>
        </div>
      </div>
    </details>
  `;
}

function renderSectionCards() {
  if (!els.sections) return;
  const firstCustomerSectionIndex = SECTION_CONFIGS.findIndex(isCustomerSectionConfig);
  els.sections.innerHTML = SECTION_CONFIGS
    .map((config, index) => `${index === firstCustomerSectionIndex ? customerLanguageTemplate() : ""}${sectionTemplate(config)}`)
    .join("");
  els.customerLanguageSelect = els.sections.querySelector("[data-customer-language]");
  renderCustomerLanguageOptions();
  bindCustomerLanguageEvents();
  state.sections.clear();

  for (const config of SECTION_CONFIGS) {
    const root = Array.from(els.sections.querySelectorAll("[data-translation-section]"))
      .find((candidate) => candidate.getAttribute("data-translation-section") === config.key);
    const section = {
      config,
      domain: getDomain(config.domainId),
      current: null,
      dirty: new Map(),
      els: {
        root,
        health: root?.querySelector("[data-section-health]") || null,
        localStatus: root?.querySelector("[data-section-local-status]") || null,
        searchInput: root?.querySelector("[data-section-search]") || null,
        statusFilter: root?.querySelector("[data-section-filter]") || null,
        summary: root?.querySelector("[data-section-summary]") || null,
        table: root?.querySelector("[data-section-table]") || null,
        exportBtn: root?.querySelector("[data-section-export]") || null,
        importBtn: root?.querySelector("[data-section-import]") || null,
        importInput: root?.querySelector("[data-section-import-input]") || null,
        saveBtn: root?.querySelector("[data-section-save]") || null
      }
    };
    state.sections.set(config.key, section);
    bindSectionEvents(section);
    updateSectionHealth(section);
  }
  updateActions();
}

function renderCustomerLanguageOptions() {
  const select = els.customerLanguageSelect;
  if (!select) return;
  const languages = sharedCustomerLanguages();
  const previous = normalizeText(select.value || state.customerTargetLang);
  select.innerHTML = languages
    .map((language) => `<option value="${escapeHtml(language.code)}">${escapeHtml(languageLabel(language))}</option>`)
    .join("");
  const nextValue = languages.some((language) => language.code === previous)
    ? previous
    : (languages[0]?.code || "");
  select.value = nextValue;
  state.customerTargetLang = nextValue;
  select.disabled = !languages.length || state.isSaving || state.isJobRunning || state.isLoadingSections;
}

function selectedCustomerTargetLang() {
  return normalizeText(els.customerLanguageSelect?.value || state.customerTargetLang || sharedCustomerLanguages()[0]?.code || "");
}

function selectedTargetLang(section) {
  if (section?.config?.fixedTargetLang) return section.config.fixedTargetLang;
  return selectedCustomerTargetLang();
}

function sectionTranslationIssueCount(section) {
  return translationIssueCountFromCounts(section?.current?.counts || {});
}

function updateSectionHealth(section) {
  const marker = section?.els?.health;
  if (!marker) return;
  const loaded = Boolean(section?.current);
  const issueCount = loaded ? sectionTranslationIssueCount(section) : 0;
  const stateName = loaded ? (issueCount > 0 ? "not-ok" : "ok") : "loading";
  const label = stateName === "ok" ? "OK" : (stateName === "not-ok" ? "X" : "...");
  const title = stateName === "ok"
    ? "No strings need translation."
    : (stateName === "not-ok"
      ? `${pluralize(issueCount, "string")} ${issueCount === 1 ? "needs" : "need"} translation.`
      : "Translation state is loading.");

  marker.textContent = label;
  marker.classList.toggle("translations-section__health--ok", stateName === "ok");
  marker.classList.toggle("translations-section__health--not-ok", stateName === "not-ok");
  marker.classList.toggle("translations-section__health--loading", stateName === "loading");
  marker.setAttribute("aria-label", title);
  marker.title = title;
  section.els.root?.classList.toggle("translations-section--needs-translation", stateName === "not-ok");
}

function renderSummary(section) {
  if (!section.current) {
    if (section.els.summary) section.els.summary.innerHTML = "";
    updateSectionHealth(section);
    return;
  }
  const counts = section.current?.counts || {};
  const issueCount = sectionTranslationIssueCount(section);
  const staleCount = numberCount(counts["freshness_state.stale"]) + numberCount(counts["freshness_state.legacy"]);
  const summaryParts = [
    { label: "Total", count: section.current?.total || 0, always: true },
    { label: "Needs translation", count: issueCount, always: true, tone: issueCount > 0 ? "attention" : "ok" },
    { label: "Manual", count: counts["origin.manual"] || 0 },
    { label: "Machine", count: counts["origin.machine"] || 0 },
    { label: "Content", count: counts["origin.content"] || 0 },
    { label: "Stale", count: staleCount },
    { label: "Unpublished", count: counts["publish_state.unpublished"] || 0 },
    { label: "Published", count: counts["publish_state.published"] || 0 }
  ].filter((part) => part.always || numberCount(part.count) > 0);
  if (section.els.summary) {
    section.els.summary.innerHTML = summaryParts
      .map((part) => {
        const toneClass = part.tone ? ` translations-summary__pill--${part.tone}` : "";
        return `<span class="translations-summary__pill${toneClass}"><strong>${escapeHtml(part.label)}</strong> ${escapeHtml(part.count)}</span>`;
      })
      .join("");
  }
  updateSectionHealth(section);
}

function filteredRows(section) {
  const rows = Array.isArray(section.current?.rows) ? section.current.rows : [];
  const query = normalizeText(section.els.searchInput?.value).toLowerCase();
  const status = normalizeText(section.els.statusFilter?.value);
  return rows.filter((row) => {
    if (status) {
      const [field, value] = status.includes(":") ? status.split(":") : ["status", status];
      if (normalizeText(row[field]) !== value) return false;
    }
    if (!query) return true;
    return [
      row.key,
      row.source,
      row.cached,
      row.override,
      row.status,
      row.source_ref,
      row.origin,
      row.freshness_state,
      row.publish_state,
      normalizeText(row.review_state) === "reviewed" ? "" : row.review_state
    ]
      .some((value) => normalizeText(value).toLowerCase().includes(query));
  });
}

function rowOverrideValue(section, row) {
  return section.dirty.has(row.key) ? section.dirty.get(row.key) : normalizeText(row.override);
}

function sourceRows(section) {
  return (Array.isArray(section.current?.rows) ? section.current.rows : [])
    .filter((row) => normalizeText(row.key) && normalizeText(row.source));
}

function currentOverrideObject(section) {
  const overrides = {};
  for (const row of sourceRows(section)) {
    const value = rowOverrideValue(section, row);
    if (value) overrides[row.key] = value;
  }
  return overrides;
}

function timestampForFilename() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join("");
}

function humanState(value) {
  return normalizeText(value).replace(/_/g, " ") || "unknown";
}

function statePill(kind, value) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  return `<span class="translations-status translations-status--${escapeHtml(kind)}-${escapeHtml(normalized)}">${escapeHtml(humanState(normalized))}</span>`;
}

function hasMissingDisplayState(row) {
  return normalizeText(row?.freshness_state) === "missing"
    || normalizeText(row?.publish_state) === "untranslated"
    || normalizeText(row?.review_state) === "needs_translation";
}

function renderStatePills(row) {
  const pills = [];
  const origin = normalizeText(row.origin);
  const freshnessState = normalizeText(row.freshness_state);
  const publishState = normalizeText(row.publish_state);
  const reviewState = normalizeText(row.review_state);
  const missing = hasMissingDisplayState(row);

  if (origin) pills.push(statePill("origin", origin));
  if (missing) {
    pills.push(statePill("freshness", "missing"));
  } else if (freshnessState && freshnessState !== "current") {
    pills.push(statePill("freshness", freshnessState));
  }
  if (publishState && publishState !== "untranslated" && publishState !== "not_publishable") {
    pills.push(statePill("publish", publishState));
  }
  if (reviewState && reviewState !== "reviewed" && reviewState !== "needs_translation") {
    pills.push(statePill("review", reviewState));
  }
  return pills.join(" ");
}

function isUntranslatedRow(row, overrideValue = "") {
  return !normalizeText(row?.cached)
    && !normalizeText(overrideValue)
    && (
      normalizeText(row?.freshness_state) === "missing"
      || normalizeText(row?.publish_state) === "untranslated"
      || normalizeText(row?.review_state) === "needs_translation"
    );
}

function renderCachedTranslationCell(row) {
  const cached = normalizeText(row?.cached);
  const deleteButton = cached
    ? `<button class="translations-cache-delete-btn" type="button" data-cache-delete-key="${escapeHtml(row.key)}" aria-label="Delete cached translation" title="Delete cached translation"><span aria-hidden="true">X</span></button>`
    : "";
  return `
    <div class="translations-cache-cell">
      ${deleteButton}
      <div class="translations-cache-cell__text">${escapeHtml(cached || "-")}</div>
    </div>
  `;
}

function exportOverrides(section) {
  if (!section.current) return;
  const overrides = currentOverrideObject(section);
  const blob = new Blob([`${JSON.stringify(overrides, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${section.current.domain.id}-${section.current.target_lang}-manual-overrides-${timestampForFilename()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setSectionStatus(section, `Exported ${Object.keys(overrides).length} manual overrides.`);
}

function normalizeImportedOverrides(parsed) {
  const rawOverrides = parsed?.overrides && typeof parsed.overrides === "object" && !Array.isArray(parsed.overrides)
    ? parsed.overrides
    : parsed;
  if (!rawOverrides || typeof rawOverrides !== "object" || Array.isArray(rawOverrides)) {
    throw new Error("Import file must contain a JSON object of manual translation overrides.");
  }
  for (const [key, value] of Object.entries(rawOverrides)) {
    if (value !== null && typeof value === "object") {
      throw new Error(`Manual override value for ${key} must be text.`);
    }
  }
  return Object.fromEntries(
    Object.entries(rawOverrides)
      .map(([key, value]) => [normalizeText(key), normalizeText(value)])
      .filter(([key, value]) => key && value)
  );
}

function stageImportedOverrides(section, importedOverrides) {
  const rows = sourceRows(section);
  const sourceKeySet = new Set(rows.map((row) => row.key));
  const unknownKeys = Object.keys(importedOverrides).filter((key) => !sourceKeySet.has(key));
  if (unknownKeys.length) {
    const preview = unknownKeys.slice(0, 8).join(", ");
    throw new Error(`Import contains unknown translation keys: ${preview}${unknownKeys.length > 8 ? ", ..." : ""}`);
  }

  section.dirty.clear();
  for (const row of rows) {
    const importedValue = normalizeText(importedOverrides[row.key]);
    const currentValue = normalizeText(row.override);
    if (importedValue !== currentValue) {
      section.dirty.set(row.key, importedValue);
    }
  }
  renderSummary(section);
  renderTable(section);
  updateActions();
  setSectionStatus(section, `Imported ${Object.keys(importedOverrides).length} manual overrides. Save to persist this replacement set.`);
}

async function importOverridesFile(section, file) {
  if (!file) return;
  try {
    if (!section.current) throw new Error("Load a translation language before importing manual overrides.");
    if (section.dirty.size && !window.confirm("Import will replace the currently staged manual override edits in this section. Continue?")) return;
    const parsed = JSON.parse(await file.text());
    stageImportedOverrides(section, normalizeImportedOverrides(parsed));
    showError("");
  } catch (error) {
    showError(error?.message || "Could not import manual translation overrides.");
  } finally {
    if (section.els.importInput) section.els.importInput.value = "";
  }
}

async function deleteCachedTranslation(section, key) {
  if (!section?.current) return;
  if (!state.permissions.canEditTranslations) {
    showError("Translation editing is disabled in this environment.");
    return;
  }
  if (section.dirty.size) {
    showError("Save manual override edits before deleting cached translations.");
    return;
  }
  const row = (section.current.rows || []).find((entry) => entry.key === key);
  if (!row || !normalizeText(row.cached)) return;
  if (!window.confirm("Delete the cached translation for this string? Manual overrides will stay unchanged.")) return;

  state.isSaving = true;
  updateActions();
  setSectionStatus(section, "Deleting cached translation...");
  try {
    const payload = await fetchApi(
      `/api/v1/static-translations/${encodeURIComponent(section.current.domain.id)}/${encodeURIComponent(section.current.target_lang)}/cache/${encodeURIComponent(key)}`,
      {
        method: "DELETE",
        body: {
          expected_revision: section.current.revision
        }
      }
    );
    if (payload) {
      section.current = payload;
      section.dirty.clear();
      renderSummary(section);
      renderTable(section);
      setSectionStatus(section, "Cached translation deleted. Refreshing related sections...");
      const failed = await refreshRelatedCleanSections(section);
      setSectionStatus(section, "Cached translation deleted. Updating translation state...");
      if (failed.length) {
        showError(failed[0].reason?.message || "Cached translation deleted, but one or more related sections could not be refreshed.");
      } else {
        showError("");
      }
      await loadTranslationStatus({ updateMessage: true });
      setSectionStatus(section, "Cached translation deleted.");
    }
  } finally {
    state.isSaving = false;
    updateActions();
  }
}

function translationsTableHeadHtml() {
  return `
    <colgroup>
      <col class="translations-table__col-source" />
      <col class="translations-table__col-cache" />
      <col class="translations-table__col-override" />
      <col class="translations-table__col-state" />
    </colgroup>
    <thead>
      <tr>
        <th>English source</th>
        <th>Cache (read only)</th>
        <th>Manual override</th>
        <th>State</th>
      </tr>
    </thead>
  `;
}

function renderTableMessage(table, message) {
  table.innerHTML = `
    ${translationsTableHeadHtml()}
    <tbody><tr><td colspan="4">${escapeHtml(message)}</td></tr></tbody>
  `;
  updateActions();
}

function renderTable(section) {
  const table = section.els.table;
  if (!table) return;
  const rows = filteredRows(section);
  if (!section.current) {
    renderTableMessage(table, "Loading translation strings...");
    return;
  }
  if (!rows.length) {
    renderTableMessage(table, "No translation strings match the current filter.");
    return;
  }

  table.innerHTML = `
    ${translationsTableHeadHtml()}
    <tbody>
      ${rows.map((row) => {
        const overrideValue = rowOverrideValue(section, row);
        const isDirty = section.dirty.has(row.key);
        const isUntranslated = isUntranslatedRow(row, overrideValue);
        const metadata = JSON.stringify({
          source_ref: row.source_ref,
          key: row.key,
          source_hash: row.source_hash,
          cached_source_hash: row.cached_source_hash,
          legacy_status: row.status,
          cache_meta: row.cache_meta || {}
        }, null, 2);
        const rowClasses = [
          isDirty ? "is-dirty" : "",
          isUntranslated ? "is-untranslated" : ""
        ].filter(Boolean).join(" ");
        return `
          <tr class="${escapeHtml(rowClasses)}" data-key="${escapeHtml(row.key)}">
            <td class="translations-table__text translations-table__source-cell">
              ${escapeHtml(row.source || "-")}
              <details class="translations-table__meta">
                <summary>key and metadata</summary>
                <code>${escapeHtml(row.key)}</code>
                <pre>${escapeHtml(metadata)}</pre>
              </details>
            </td>
            <td class="translations-table__text translations-table__translation-cell">${renderCachedTranslationCell(row)}</td>
            <td class="translations-table__translation-cell">
              <textarea class="translations-table__override" data-override-key="${escapeHtml(row.key)}" rows="2" ${state.permissions.canEditTranslations && !state.isSaving && !state.isJobRunning && !state.isLoadingSections ? "" : "disabled"}>${escapeHtml(overrideValue)}</textarea>
            </td>
            <td class="translations-table__state-cell">
              ${renderStatePills(row)}
              <span class="translations-table__updated">${escapeHtml(formatDateTime(row.updated_at))}</span>
            </td>
          </tr>
        `;
      }).join("")}
    </tbody>
  `;

  table.querySelectorAll("[data-override-key]").forEach((textarea) => {
    textarea.addEventListener("input", () => {
      const key = textarea.getAttribute("data-override-key");
      const original = normalizeText((section.current?.rows || []).find((row) => row.key === key)?.override);
      const next = normalizeText(textarea.value);
      if (next === original) {
        section.dirty.delete(key);
      } else {
        section.dirty.set(key, next);
      }
      const tr = textarea.closest("tr");
      if (tr) {
        const row = (section.current?.rows || []).find((entry) => entry.key === key);
        tr.classList.toggle("is-dirty", section.dirty.has(key));
        tr.classList.toggle("is-untranslated", isUntranslatedRow(row, next));
      }
      updateSectionEditStatus(section);
      updateActions();
    });
  });
  table.querySelectorAll("[data-cache-delete-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.getAttribute("data-cache-delete-key");
      void deleteCachedTranslation(section, key);
    });
  });
  updateActions();
}

async function loadDomains() {
  const payload = await fetchApi("/api/v1/static-translations/domains", { cache: "no-store" });
  state.domains = Array.isArray(payload?.domains) ? payload.domains : [];
  renderCustomerLanguageOptions();
  state.translationWritesEnabled = payload?.permissions?.can_write !== false;
  if (!state.translationWritesEnabled) {
    state.permissions.canEditTranslations = false;
  }
}

async function loadSectionState(section, { preserveLanguage = true } = {}) {
  section.domain = getDomain(section.config.domainId);
  if (!section.domain) {
    section.current = null;
    renderSummary(section);
    setSectionStatus(section, "Translation area is not configured.");
    renderTable(section);
    return;
  }
  const targetLang = section.config.fixedTargetLang
    ? (preserveLanguage ? selectedTargetLang(section) : (section.config.fixedTargetLang || section.domain.target_languages?.[0]?.code || ""))
    : selectedCustomerTargetLang();
  if (!targetLang) {
    section.current = null;
    renderSummary(section);
    setSectionStatus(section, "No target language configured.");
    renderTable(section);
    return;
  }

  section.dirty.clear();
  section.current = null;
  renderSummary(section);
  setSectionStatus(section, "Loading translations...");
  renderTable(section);
  const payload = await fetchApi(`/api/v1/static-translations/${encodeURIComponent(section.domain.id)}/${encodeURIComponent(targetLang)}`, { cache: "no-store" });
  if (!payload) return;
  section.current = payload;
  renderSummary(section);
  renderTable(section);
  setSectionStatus(section, loadedSectionMessage(section));
}

async function loadAllSections({ preserveLanguage = true } = {}) {
  if (!state.domains.length) await loadDomains();
  if (!state.sections.size) renderSectionCards();
  state.isLoadingSections = true;
  updateActions();
  try {
    const results = await Promise.allSettled(
      Array.from(state.sections.values()).map((section) => loadSectionState(section, { preserveLanguage }))
    );
    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length) {
      showError(failed[0].reason?.message || "Could not load one or more translation sections.");
    } else {
      showError("");
    }
    const translationStatus = await loadTranslationStatus({ updateMessage: !failed.length });
    if (!translationStatus && !failed.length) {
      showError("Could not load the central translation status.");
    }
  } finally {
    state.isLoadingSections = false;
    updateActions();
  }
}

async function refreshRelatedCleanSections(changedSection) {
  const relatedSections = relatedCleanSectionsForMutation(changedSection);
  if (!relatedSections.length) return [];
  const results = await Promise.allSettled(
    relatedSections.map((section) => loadSectionState(section, { preserveLanguage: true }))
  );
  return results.filter((result) => result.status === "rejected");
}

async function saveOverrides(section) {
  if (!state.permissions.canEditTranslations || !section.current || !section.dirty.size || state.isSaving) return;
  state.isSaving = true;
  updateActions();
  setSectionStatus(section, "Saving manual overrides...");
  const overrides = Object.fromEntries(section.dirty.entries());
  try {
    const payload = await fetchApi(
      `/api/v1/static-translations/${encodeURIComponent(section.current.domain.id)}/${encodeURIComponent(section.current.target_lang)}/overrides`,
      {
        method: "PATCH",
        body: {
          expected_revision: section.current.revision,
          overrides
        }
      }
    );
    if (payload) {
      section.current = payload;
      section.dirty.clear();
      renderSummary(section);
      renderTable(section);
      setSectionStatus(section, "Manual overrides saved. Refreshing related sections...");
      const failed = await refreshRelatedCleanSections(section);
      setSectionStatus(section, "Manual overrides saved. Updating translation state...");
      if (failed.length) {
        showError(failed[0].reason?.message || "Manual overrides saved, but one or more related sections could not be refreshed.");
      } else {
        showError("");
      }
      await loadTranslationStatus({ updateMessage: true });
      setSectionStatus(section, "Manual overrides saved.");
    }
  } finally {
    state.isSaving = false;
    updateActions();
  }
}

function setOverlayVisible(visible, text = "") {
  if (!els.overlay) return;
  els.overlay.hidden = !visible;
  els.overlay.setAttribute("aria-hidden", visible ? "false" : "true");
  if (els.overlayText && text) els.overlayText.textContent = text;
}

function waitForMs(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function waitForNextPaint() {
  return new Promise((resolve) => {
    if (typeof window.requestAnimationFrame !== "function") {
      window.setTimeout(resolve, 0);
      return;
    }
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
  });
}

async function waitForMinimumElapsed(startedAt, minimumMs) {
  const remainingMs = Math.max(0, (Number(minimumMs) || 0) - (Date.now() - Number(startedAt || 0)));
  if (remainingMs > 0) await waitForMs(remainingMs);
}

async function hideOverlayAfterMinimum(startedAt) {
  await waitForMinimumElapsed(startedAt, MIN_TRANSLATIONS_OVERLAY_MS);
  setOverlayVisible(false);
}

function renderJob(job) {
  if (!job) return;
  const phase = job.phases?.find((entry) => entry.status === "running");
  const label = phase?.label || (job.status === "succeeded" ? "Finished." : translationsApplyingOverlayText());
  if (els.overlayText) els.overlayText.textContent = label;
  if (els.applyLog) els.applyLog.textContent = Array.isArray(job.log) ? job.log.slice(-80).join("\n") : "";
}

async function pollJob(jobId, overlayStartedAt) {
  let latest = null;
  while (state.isJobRunning) {
    const payload = await fetchApi(`/api/v1/static-translations/apply/${encodeURIComponent(jobId)}`, { cache: "no-store" });
    if (!payload?.job) {
      latest = latest || {
        status: "failed",
        error: "Translation job status could not be read."
      };
      break;
    }
    latest = payload.job;
    renderJob(latest);
    if (latest?.status === "succeeded" || latest?.status === "failed") break;
    await waitForMs(1500);
  }
  if (latest?.status === "succeeded") {
    let translationStatus = null;
    try {
      setOverlayVisible(true, translationsRefreshingOverlayText());
      await loadAllSections({ preserveLanguage: true });
      translationStatus = state.translationStatus;
    } finally {
      state.isJobRunning = false;
      updateActions();
    }
    await hideOverlayAfterMinimum(overlayStartedAt);
    if (!translationStatus?.loaded) {
      showError("Translation job finished, but the translation status could not be refreshed.");
      refreshTranslationStatusText();
      return;
    }
    if (latest.type === "publish") {
      if (translationStatus.dirty) {
        showError(`${translationStatusMessage(translationStatus)} The translation warning icon could not be cleared.`);
        refreshTranslationStatusText();
        return;
      }
      showError("");
      refreshTranslationStatusText();
      return;
    }
    if (latest.type === "apply" && translationStatus.translationIssueCount > 0) {
      showError(`${translationStatusMessage(translationStatus)} Publishing was skipped.`);
      refreshTranslationStatusText();
      return;
    }
    if (latest.type === "apply" && translationStatus.unavailableCount > 0) {
      showError(`${translationStatusMessage(translationStatus)} Publishing was skipped.`);
      refreshTranslationStatusText();
      return;
    }
    if (latest.type === "apply" && translationStatus.dirty) {
      showError(`${translationStatusMessage(translationStatus)} The translation warning icon could not be cleared.`);
      refreshTranslationStatusText();
      return;
    }
    showError("");
    refreshTranslationStatusText();
    return;
  }
  state.isJobRunning = false;
  updateActions();
  await hideOverlayAfterMinimum(overlayStartedAt);
  await loadTranslationStatus({ updateMessage: false });
  refreshTranslationStatusText();
  showError(latest?.error || "Translation job failed.");
}

async function startJob(path, body = null, overlayText = translationsApplyingOverlayText()) {
  if (!state.permissions.canEditTranslations) {
    refreshTranslationStatusText();
    showError("Translation override editing is disabled in this environment.");
    return;
  }
  const translationState = currentTranslationActionState();
  const isTranslateJob = path.endsWith("/apply");
  const isPublishJob = path.endsWith("/publish");
  if (isTranslateJob && !translationState.translateActionReady) {
    refreshTranslationStatusText();
    showError("");
    return;
  }
  if (isPublishJob && translationState.translateNeeded) {
    refreshTranslationStatusText();
    showError("Translate missing or stale strings before publishing.");
    return;
  }
  if (isPublishJob && !translationState.publishReady) {
    refreshTranslationStatusText();
    showError("");
    return;
  }
  if (state.isJobRunning) return;
  if (dirtySections().length && !window.confirm("You have unsaved manual overrides. Continue without saving them?")) return;
  showError("");
  state.isJobRunning = true;
  updateActions();
  const overlayStartedAt = Date.now();
  setOverlayVisible(true, overlayText);
  if (els.applyLog) els.applyLog.textContent = "";
  await waitForNextPaint();
  const payload = await fetchApi(path, {
    method: "POST",
    ...(body ? { body } : {})
  });
  const job = payload?.job;
  if (!job?.id) {
    state.isJobRunning = false;
    await hideOverlayAfterMinimum(overlayStartedAt);
    showError("Translation job could not be started.");
    await loadTranslationStatus({ updateMessage: false });
    updateActions();
    return;
  }
  renderJob(job);
  await pollJob(job.id, overlayStartedAt);
}

function bindSectionEvents(section) {
  section.els.searchInput?.addEventListener("input", () => renderTable(section));
  section.els.statusFilter?.addEventListener("change", () => renderTable(section));
  section.els.exportBtn?.addEventListener("click", () => exportOverrides(section));
  section.els.importBtn?.addEventListener("click", () => section.els.importInput?.click());
  section.els.importInput?.addEventListener("change", () => importOverridesFile(section, section.els.importInput.files?.[0] || null));
  section.els.saveBtn?.addEventListener("click", () => saveOverrides(section));
}

async function loadCustomerSectionsForSelectedLanguage() {
  const previousLang = normalizeText(state.customerTargetLang);
  const nextLang = selectedCustomerTargetLang();
  if (nextLang !== previousLang && dirtyCustomerSections().length) {
    if (!window.confirm("Changing customer language will discard unsaved manual override edits in customer sections. Continue?")) {
      if (els.customerLanguageSelect) els.customerLanguageSelect.value = previousLang;
      return;
    }
  }

  state.customerTargetLang = nextLang;
  state.isLoadingSections = true;
  updateActions();
  try {
    const customerSections = Array.from(state.sections.values())
      .filter((section) => isCustomerSectionConfig(section.config));
    const results = await Promise.allSettled(
      customerSections.map((section) => loadSectionState(section, { preserveLanguage: true }))
    );
    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length) {
      showError(failed[0].reason?.message || "Could not load one or more customer translation sections.");
    } else {
      showError("");
    }
  } finally {
    state.isLoadingSections = false;
    updateActions();
  }
}

function bindCustomerLanguageEvents() {
  els.customerLanguageSelect?.addEventListener("change", () => {
    void loadCustomerSectionsForSelectedLanguage();
  });
}

function bindEvents() {
  els.translateBtn?.addEventListener("click", () => startJob("/api/v1/static-translations/apply", null, translationsTranslateOverlayText()));
  els.retranslateFrontendAllBtn?.addEventListener("click", () => {
    if (!window.confirm("Retranslate customer UI strings? This can take several minutes. Manual overrides are preserved.")) return;
    startJob("/api/v1/static-translations/retranslate", { mode: "frontend_all_languages" }, retranslateFrontendAllOverlayText());
  });
  els.clearMarketingTourCacheBtn?.addEventListener("click", () => {
    if (!window.confirm("Clear cached marketing tour translations? Manual overrides are preserved. Use Translate afterward to rebuild missing machine translations and publish clean snapshots.")) return;
    startJob("/api/v1/static-translations/retranslate", { mode: "marketing_tour_cache" }, clearMarketingTourCacheOverlayText());
  });
  els.retranslateBackendViBtn?.addEventListener("click", () => {
    if (!window.confirm("Retranslate backend Vietnamese? Manual overrides are preserved.")) return;
    startJob("/api/v1/static-translations/retranslate", { mode: "backend_vi" }, retranslateBackendViOverlayText());
  });
}

async function init() {
  bindEvents();
  await initializeBackendPageChrome({
    currentSection: "translations",
    homeLink: els.homeLink,
    refreshNav: refreshBackendNavElements
  });

  const authState = await loadBackendPageAuthState({
    apiOrigin,
    refreshNav: refreshBackendNavElements,
    computePermissions: (roles) => ({
      canReadTranslations: roles.includes(ROLES.ADMIN),
      canEditTranslations: roles.includes(ROLES.ADMIN)
    }),
    hasPageAccess: (permissions) => permissions.canReadTranslations,
    logKey: "backend-translations",
    pageName: "translations.html",
    expectedRolesAnyOf: [ROLES.ADMIN],
    likelyCause: "The user is authenticated in Keycloak but does not have the ATP admin role required to manage translations."
  });

  state.permissions = {
    canReadTranslations: Boolean(authState.permissions?.canReadTranslations),
    canEditTranslations: Boolean(authState.permissions?.canEditTranslations)
  };

  window.addEventListener("backend-i18n-changed", handleBackendLanguageChanged);
  if (!state.permissions.canReadTranslations) {
    showError(backendT("backend.translations.forbidden", "You do not have access to translations."));
    return;
  }

  if (els.panel) els.panel.hidden = false;
  await loadDomains();
  state.permissions.canEditTranslations = state.permissions.canEditTranslations && state.translationWritesEnabled;
  renderSectionCards();
  await loadAllSections({ preserveLanguage: false });
}

function handleBackendLanguageChanged() {
  if (!state.permissions.canReadTranslations) {
    showError(backendT("backend.translations.forbidden", "You do not have access to translations."));
    return;
  }
  for (const section of state.sections.values()) {
    renderSummary(section);
    renderTable(section);
  }
  updateActions();
}

init().catch((error) => {
  console.error("[translations] Initialization failed.", error);
  showError(error?.message || "Could not initialize translations page.");
});
