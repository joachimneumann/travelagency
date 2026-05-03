import { createApiFetcher, escapeHtml, formatDateTime, normalizeText } from "../shared/api.js";
import {
  getBackendApiOrigin,
  initializeBackendPageChrome,
  loadBackendPageAuthState,
  refreshBackendNavElements
} from "../shared/backend_page.js";

const ROLES = { ADMIN: "atp_admin" };

const CUSTOMER_DOMAIN_CONFIGS = [
  { domainId: "frontend", label: "Customer UI" },
  { domainId: "index-content-memory", label: "index.html texts" },
  { domainId: "marketing-tour-memory", label: "Marketing tours" }
];

const SECTION_CONFIGS = [
  {
    key: "staff",
    title: "For staff (NE/VI)",
    description: "Manual overrides for staff-facing backend Vietnamese.",
    fixedTargetLang: "vi",
    domains: [
      { domainId: "backend", label: "Staff backend terms" }
    ]
  },
  {
    key: "customers",
    title: "For customers",
    description: "Manual overrides for Customer UI, index.html texts, and Marketing tours.",
    customer: true,
    domains: CUSTOMER_DOMAIN_CONFIGS
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
  return Boolean(config?.customer);
}

function sectionDomainEntries(config) {
  return Array.isArray(config?.domains) ? config.domains : [];
}

function customerDomainEntries() {
  return sectionDomainEntries(SECTION_CONFIGS.find(isCustomerSectionConfig));
}

function customerLanguages() {
  const languagesByCode = new Map();
  for (const entry of customerDomainEntries()) {
    const domain = getDomain(entry.domainId);
    for (const language of domain?.target_languages || []) {
      if (!languagesByCode.has(language.code)) languagesByCode.set(language.code, language);
    }
  }
  return Array.from(languagesByCode.values());
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
    if (translationState.translateNeeded) return "Translate all missing or stale strings across staff and customer content, then publish automatically if clean.";
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
    return `${base} ${pluralize(status.publishReadyCount, "translated string")} ready to publish with Translate everything.`;
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
  for (const section of state.sections.values()) {
    if (section.els.languageSelect) {
      section.els.languageSelect.disabled = !customerLanguages().length || sectionControlsBusy;
    }
  }
}

function sectionTemplate(config) {
  const id = safeDomId(config.key);
  const statusOptions = STATUS_OPTIONS
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
    .join("");
  const languageControl = isCustomerSectionConfig(config)
    ? `
      <div class="field">
        <label for="translations_${id}_language">Language</label>
        <select id="translations_${id}_language" data-section-language></select>
      </div>
    `
    : "";
  const controlsClass = isCustomerSectionConfig(config)
    ? "translations-controls translations-controls--customer"
    : "translations-controls translations-controls--staff";
  const searchPlaceholder = isCustomerSectionConfig(config)
    ? "English source, area, language, cache, manual override"
    : "English source, cache, manual override";

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
            <input id="translations_${id}_search" type="search" autocomplete="off" placeholder="${escapeHtml(searchPlaceholder)}" data-section-search />
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
  els.sections.innerHTML = SECTION_CONFIGS
    .map((config) => sectionTemplate(config))
    .join("");
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
        languageSelect: root?.querySelector("[data-section-language]") || null,
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
  renderCustomerLanguageOptions();
  updateActions();
}

function renderCustomerLanguageOptions() {
  const languages = customerLanguages();
  for (const section of state.sections.values()) {
    const select = section.els.languageSelect;
    if (!select) continue;
    const previous = normalizeText(select.value || state.customerTargetLang);
    select.innerHTML = [
      `<option value="">All languages</option>`,
      ...languages.map((language) => `<option value="${escapeHtml(language.code)}">${escapeHtml(languageLabel(language))}</option>`)
    ].join("");
    const nextValue = previous && languages.some((language) => language.code === previous) ? previous : "";
    select.value = nextValue;
    state.customerTargetLang = nextValue;
    select.disabled = !languages.length || state.isSaving || state.isJobRunning || state.isLoadingSections;
  }
}

function selectedCustomerTargetLang(section = null) {
  return normalizeText(section?.els?.languageSelect?.value ?? state.customerTargetLang);
}

function selectedCustomerLanguages(section) {
  const selected = selectedCustomerTargetLang(section);
  const languages = customerLanguages();
  return selected
    ? languages.filter((language) => language.code === selected)
    : languages;
}

function selectedTargetLang(section) {
  if (section?.config?.fixedTargetLang) return section.config.fixedTargetLang;
  return selectedCustomerTargetLang(section);
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

function rowIdentity(row) {
  const explicitId = normalizeText(row?.row_id);
  if (explicitId) return explicitId;
  return [
    normalizeText(row?.domain_id || row?.domain?.id),
    normalizeText(row?.target_lang),
    normalizeText(row?.key)
  ].join("|");
}

function stateIdentity(domainId, targetLang) {
  return `${normalizeText(domainId)}|${normalizeText(targetLang)}`;
}

function sectionStateForRow(section, row) {
  const id = stateIdentity(row?.domain_id, row?.target_lang);
  return (section?.current?.states || []).find((entry) => stateIdentity(entry.domain.id, entry.target_lang) === id) || null;
}

function combineCounts(states) {
  return states.reduce((counts, stateEntry) => {
    for (const [key, value] of Object.entries(stateEntry.payload?.counts || {})) {
      counts[key] = numberCount(counts[key]) + numberCount(value);
    }
    return counts;
  }, {});
}

function enrichRowsForSectionState(sectionConfig, stateEntry) {
  const payload = stateEntry.payload;
  return (Array.isArray(payload?.rows) ? payload.rows : []).map((row) => ({
    ...row,
    row_id: rowIdentity({
      domain_id: payload.domain.id,
      target_lang: payload.target_lang,
      key: row.key
    }),
    domain_id: payload.domain.id,
    domain_label: stateEntry.entry.label || payload.domain.label || payload.domain.id,
    target_lang: payload.target_lang,
    target_language_label: languageLabel(payload.language),
    section_key: sectionConfig.key
  }));
}

function combineSectionState(sectionConfig, stateEntries) {
  const rows = stateEntries.flatMap((entry) => enrichRowsForSectionState(sectionConfig, entry));
  return {
    domain: stateEntries[0]?.payload?.domain || null,
    language: stateEntries[0]?.payload?.language || null,
    source_lang: "en",
    target_lang: stateEntries.length === 1 ? stateEntries[0].payload.target_lang : selectedCustomerTargetLang(),
    revision: stateEntries.length === 1 ? stateEntries[0].payload.revision : "",
    states: stateEntries.map((entry) => ({
      entry: entry.entry,
      domain: entry.payload.domain,
      language: entry.payload.language,
      target_lang: entry.payload.target_lang,
      revision: entry.payload.revision,
      total: entry.payload.total,
      counts: entry.payload.counts || {}
    })),
    total: rows.length,
    counts: combineCounts(stateEntries),
    rows
  };
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
      row.domain_label,
      row.target_lang,
      row.target_language_label,
      row.origin,
      row.freshness_state,
      row.publish_state,
      normalizeText(row.review_state) === "reviewed" ? "" : row.review_state
    ]
      .some((value) => normalizeText(value).toLowerCase().includes(query));
  });
}

function rowOverrideValue(section, row) {
  const id = rowIdentity(row);
  return section.dirty.has(id) ? section.dirty.get(id) : normalizeText(row.override);
}

function sourceRows(section) {
  return (Array.isArray(section.current?.rows) ? section.current.rows : [])
    .filter((row) => normalizeText(row.key) && normalizeText(row.source));
}

function currentOverrideObject(section) {
  const overrides = {};
  for (const row of sourceRows(section)) {
    const value = rowOverrideValue(section, row);
    if (!value) continue;
    if (isCustomerSectionConfig(section.config)) {
      overrides[rowIdentity(row)] = {
        domain: row.domain_id,
        target_lang: row.target_lang,
        key: row.key,
        source: row.source,
        override: value
      };
    } else {
      overrides[row.key] = value;
    }
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
  const id = rowIdentity(row);
  const deleteButton = cached
    ? `<button class="translations-cache-delete-btn" type="button" data-cache-delete-key="${escapeHtml(id)}" aria-label="Delete cached translation" title="Delete cached translation"><span aria-hidden="true">X</span></button>`
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
  const filenameScope = isCustomerSectionConfig(section.config)
    ? `${section.config.key}-${selectedCustomerTargetLang(section) || "all-languages"}`
    : `${section.current.domain.id}-${section.current.target_lang}`;
  link.download = `${filenameScope}-manual-overrides-${timestampForFilename()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setSectionStatus(section, `Exported ${Object.keys(overrides).length} manual overrides.`);
}

function normalizeImportedOverrides(parsed, section) {
  const rawOverrides = parsed?.overrides && typeof parsed.overrides === "object" && !Array.isArray(parsed.overrides)
    ? parsed.overrides
    : parsed;
  if (!rawOverrides || typeof rawOverrides !== "object" || Array.isArray(rawOverrides)) {
    throw new Error("Import file must contain a JSON object of manual translation overrides.");
  }
  for (const [key, value] of Object.entries(rawOverrides)) {
    if (!isCustomerSectionConfig(section.config) && value !== null && typeof value === "object") {
      throw new Error(`Manual override value for ${key} must be text.`);
    }
  }
  return Object.fromEntries(
    Object.entries(rawOverrides)
      .map(([key, value]) => [
        normalizeText(key),
        normalizeText(value && typeof value === "object" && !Array.isArray(value) ? value.override : value)
      ])
      .filter(([key, value]) => key && value)
  );
}

function resolveImportedOverrideKey(section, importedKey) {
  const rows = sourceRows(section);
  const directId = normalizeText(importedKey);
  if (rows.some((row) => rowIdentity(row) === directId)) return directId;
  const matchingRows = rows.filter((row) => row.key === directId);
  return matchingRows.length === 1 ? rowIdentity(matchingRows[0]) : directId;
}

function stageImportedOverrides(section, importedOverrides) {
  const rows = sourceRows(section);
  const sourceKeySet = new Set(rows.map((row) => rowIdentity(row)));
  const resolvedOverrides = Object.fromEntries(
    Object.entries(importedOverrides).map(([key, value]) => [resolveImportedOverrideKey(section, key), value])
  );
  const unknownKeys = Object.keys(resolvedOverrides).filter((key) => !sourceKeySet.has(key));
  if (unknownKeys.length) {
    const preview = unknownKeys.slice(0, 8).join(", ");
    throw new Error(`Import contains unknown translation keys: ${preview}${unknownKeys.length > 8 ? ", ..." : ""}`);
  }

  section.dirty.clear();
  for (const row of rows) {
    const importedValue = normalizeText(resolvedOverrides[rowIdentity(row)]);
    const currentValue = normalizeText(row.override);
    if (importedValue !== currentValue) {
      section.dirty.set(rowIdentity(row), importedValue);
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
    stageImportedOverrides(section, normalizeImportedOverrides(parsed, section));
    showError("");
  } catch (error) {
    showError(error?.message || "Could not import manual translation overrides.");
  } finally {
    if (section.els.importInput) section.els.importInput.value = "";
  }
}

async function deleteCachedTranslation(section, rowId) {
  if (!section?.current) return;
  if (!state.permissions.canEditTranslations) {
    showError("Translation editing is disabled in this environment.");
    return;
  }
  if (section.dirty.size) {
    showError("Save manual override edits before deleting cached translations.");
    return;
  }
  const row = (section.current.rows || []).find((entry) => rowIdentity(entry) === rowId);
  if (!row || !normalizeText(row.cached)) return;
  if (!window.confirm("Delete the cached translation for this string? Manual overrides will stay unchanged.")) return;

  state.isSaving = true;
  updateActions();
  setSectionStatus(section, "Deleting cached translation...");
  try {
    const stateEntry = sectionStateForRow(section, row);
    const payload = await fetchApi(
      `/api/v1/static-translations/${encodeURIComponent(row.domain_id)}/${encodeURIComponent(row.target_lang)}/cache/${encodeURIComponent(row.key)}`,
      {
        method: "DELETE",
        body: {
          expected_revision: stateEntry?.revision || section.current.revision
        }
      }
    );
    if (payload) {
      section.dirty.clear();
      setSectionStatus(section, "Cached translation deleted. Reloading manual override table...");
      await loadSectionState(section, { preserveLanguage: true });
      setSectionStatus(section, "Cached translation deleted. Updating translation state...");
      showError("");
      await loadTranslationStatus({ updateMessage: true });
      setSectionStatus(section, "Cached translation deleted.");
    }
  } finally {
    state.isSaving = false;
    updateActions();
  }
}

function translationsTableHeadHtml(section) {
  const isCustomer = isCustomerSectionConfig(section?.config);
  const customerCols = isCustomer
    ? `
      <col class="translations-table__col-language" />
      <col class="translations-table__col-area" />
    `
    : "";
  const customerHeaders = isCustomer
    ? `
        <th>Language</th>
        <th>Area</th>
    `
    : "";
  return `
    <colgroup>
      ${customerCols}
      <col class="translations-table__col-source" />
      <col class="translations-table__col-cache" />
      <col class="translations-table__col-override" />
      <col class="translations-table__col-state" />
    </colgroup>
    <thead>
      <tr>
        ${customerHeaders}
        <th>English source</th>
        <th>Cache (read only)</th>
        <th>Manual override</th>
        <th>State</th>
      </tr>
    </thead>
  `;
}

function renderTableMessage(table, message) {
  const section = Array.from(state.sections.values()).find((candidate) => candidate.els.table === table);
  const colspan = isCustomerSectionConfig(section?.config) ? 6 : 4;
  table.innerHTML = `
    ${translationsTableHeadHtml(section)}
    <tbody><tr><td colspan="${colspan}">${escapeHtml(message)}</td></tr></tbody>
  `;
  updateActions();
}

function renderTable(section) {
  const table = section.els.table;
  if (!table) return;
  const isCustomer = isCustomerSectionConfig(section.config);
  table.classList.toggle("translations-table--customer", isCustomer);
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
    ${translationsTableHeadHtml(section)}
    <tbody>
      ${rows.map((row) => {
        const overrideValue = rowOverrideValue(section, row);
        const id = rowIdentity(row);
        const isDirty = section.dirty.has(id);
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
        const customerCells = isCustomer
          ? `
            <td class="translations-table__scope-cell">${escapeHtml(row.target_language_label || row.target_lang || "-")}</td>
            <td class="translations-table__scope-cell">${escapeHtml(row.domain_label || row.domain_id || "-")}</td>
          `
          : "";
        return `
          <tr class="${escapeHtml(rowClasses)}" data-key="${escapeHtml(id)}">
            ${customerCells}
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
              <textarea class="translations-table__override" data-override-key="${escapeHtml(id)}" rows="2" ${state.permissions.canEditTranslations && !state.isSaving && !state.isJobRunning && !state.isLoadingSections ? "" : "disabled"}>${escapeHtml(overrideValue)}</textarea>
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
      const row = (section.current?.rows || []).find((entry) => rowIdentity(entry) === key);
      const original = normalizeText(row?.override);
      const next = normalizeText(textarea.value);
      if (next === original) {
        section.dirty.delete(key);
      } else {
        section.dirty.set(key, next);
      }
      const tr = textarea.closest("tr");
      if (tr) {
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

async function fetchLanguageState(domain, targetLang) {
  return fetchApi(`/api/v1/static-translations/${encodeURIComponent(domain.id)}/${encodeURIComponent(targetLang)}`, { cache: "no-store" });
}

function languageSupportedByDomain(domain, languageCode) {
  return (domain?.target_languages || []).some((language) => language.code === languageCode);
}

async function loadSectionState(section, { preserveLanguage = true } = {}) {
  const domainEntries = sectionDomainEntries(section.config);
  const domains = domainEntries
    .map((entry) => ({ entry, domain: getDomain(entry.domainId) }))
    .filter(({ domain }) => Boolean(domain));
  section.domain = domains[0]?.domain || null;
  if (!domains.length) {
    section.current = null;
    renderSummary(section);
    setSectionStatus(section, "Translation area is not configured.");
    renderTable(section);
    return;
  }

  const selectedLanguages = isCustomerSectionConfig(section.config)
    ? selectedCustomerLanguages(section)
    : [{
        code: preserveLanguage
          ? selectedTargetLang(section)
          : (section.config.fixedTargetLang || section.domain.target_languages?.[0]?.code || "")
      }];
  const loadTargets = domains.flatMap(({ entry, domain }) => selectedLanguages
    .filter((language) => languageSupportedByDomain(domain, language.code))
    .map((language) => ({ entry, domain, language })));

  if (!loadTargets.length) {
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
  const payloads = await Promise.all(loadTargets.map(async (target) => ({
    entry: target.entry,
    payload: await fetchLanguageState(target.domain, target.language.code)
  })));
  const loadedPayloads = payloads.filter((entry) => entry.payload);
  if (!loadedPayloads.length) return;
  section.current = combineSectionState(section.config, loadedPayloads);
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

function dirtyOverrideGroups(section) {
  const rowsById = new Map((section.current?.rows || []).map((row) => [rowIdentity(row), row]));
  const groups = new Map();
  for (const [id, value] of section.dirty.entries()) {
    const row = rowsById.get(id);
    if (!row) continue;
    const groupId = stateIdentity(row.domain_id, row.target_lang);
    if (!groups.has(groupId)) {
      const stateEntry = sectionStateForRow(section, row);
      groups.set(groupId, {
        domainId: row.domain_id,
        targetLang: row.target_lang,
        revision: stateEntry?.revision || section.current.revision,
        kind: stateEntry?.domain?.kind || row.domain?.kind || "",
        overrides: {}
      });
    }
    groups.get(groupId).overrides[row.key] = value;
  }
  return Array.from(groups.values());
}

async function saveOverrides(section) {
  if (!state.permissions.canEditTranslations || !section.current || !section.dirty.size || state.isSaving) return;
  state.isSaving = true;
  updateActions();
  setSectionStatus(section, "Saving manual overrides...");
  const groups = dirtyOverrideGroups(section);
  const savedMemoryTargets = new Set();
  try {
    for (const group of groups) {
      const memoryTarget = group.kind === "translation_memory" ? group.targetLang : "";
      const includeRevision = !memoryTarget || !savedMemoryTargets.has(memoryTarget);
      await fetchApi(
        `/api/v1/static-translations/${encodeURIComponent(group.domainId)}/${encodeURIComponent(group.targetLang)}/overrides`,
        {
          method: "PATCH",
          body: {
            ...(includeRevision && group.revision ? { expected_revision: group.revision } : {}),
            overrides: group.overrides
          }
        }
      );
      if (memoryTarget) savedMemoryTargets.add(memoryTarget);
    }
    if (groups.length) {
      section.dirty.clear();
      setSectionStatus(section, "Manual overrides saved. Reloading manual override table...");
      await loadSectionState(section, { preserveLanguage: true });
      setSectionStatus(section, "Manual overrides saved. Updating translation state...");
      showError("");
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
  section.els.languageSelect?.addEventListener("change", () => {
    void loadCustomerSectionForSelectedLanguage(section);
  });
  section.els.searchInput?.addEventListener("input", () => renderTable(section));
  section.els.statusFilter?.addEventListener("change", () => renderTable(section));
  section.els.exportBtn?.addEventListener("click", () => exportOverrides(section));
  section.els.importBtn?.addEventListener("click", () => section.els.importInput?.click());
  section.els.importInput?.addEventListener("change", () => importOverridesFile(section, section.els.importInput.files?.[0] || null));
  section.els.saveBtn?.addEventListener("click", () => saveOverrides(section));
}

async function loadCustomerSectionForSelectedLanguage(section) {
  const previousLang = normalizeText(state.customerTargetLang);
  const nextLang = selectedCustomerTargetLang(section);
  if (nextLang !== previousLang && dirtyCustomerSections().length) {
    if (!window.confirm("Changing customer language will discard unsaved manual override edits in customer sections. Continue?")) {
      if (section.els.languageSelect) section.els.languageSelect.value = previousLang;
      return;
    }
  }

  state.customerTargetLang = nextLang;
  state.isLoadingSections = true;
  updateActions();
  try {
    await loadSectionState(section, { preserveLanguage: true });
    showError("");
  } catch (error) {
    showError(error?.message || "Could not load customer translation strings.");
  } finally {
    state.isLoadingSections = false;
    updateActions();
  }
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
