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
    title: "1. Backend terms for staff",
    description: "All backend UI terms across staff pages, including bookings.html.",
    fixedTargetLang: "vi",
    languageLabel: "EN -> VI"
  },
  {
    key: "index-content",
    domainId: "index-content-memory",
    title: "2. index.html texts",
    description: "Customer-facing index.html text, excluding marketing tours."
  },
  {
    key: "marketing-tours",
    domainId: "marketing-tour-memory",
    title: "3. Marketing Tours",
    description: "Exact-source cache and manual overrides used when staff translate marketing-tour content."
  },
  {
    key: "booking-content",
    domainId: "booking-content-memory",
    title: "4. Texts in bookings.html",
    description: "Customer-facing booking text, including booking travel-plan translation fields."
  }
];

const STATUS_OPTIONS = [
  ["", "All"],
  ["manual_override", "Manual overrides"],
  ["content_translation", "Content translations"],
  ["stale", "Stale"],
  ["missing", "Missing"],
  ["machine", "Machine"],
  ["legacy", "Legacy"],
  ["extra", "Extra"]
];

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  error: document.getElementById("backendError"),
  panel: document.getElementById("translationsPanel"),
  intro: document.getElementById("translationsIntro"),
  status: document.getElementById("translationsStatus"),
  sections: document.getElementById("translationsSections"),
  refreshBtn: document.getElementById("translationsRefreshBtn"),
  applyBtn: document.getElementById("translationsApplyBtn"),
  retranslateFrontendAllBtn: document.getElementById("translationsRetranslateFrontendAllBtn"),
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
  if (section?.els?.status) section.els.status.textContent = normalizeText(message);
}

function translationsApplyingOverlayText() {
  return backendT("backend.translations.applying_overlay", "Applying translations. Please wait.");
}

function retranslateFrontendAllOverlayText() {
  return backendT(
    "backend.translations.retranslate_frontend_all_overlay",
    "Retranslating all customer-facing languages. Please wait."
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

function dirtySections() {
  return Array.from(state.sections.values()).filter((section) => section.dirty.size > 0);
}

function updateActions() {
  const hasDirty = dirtySections().length > 0;
  if (els.applyBtn) {
    els.applyBtn.disabled = !state.permissions.canEditTranslations || state.isSaving || state.isJobRunning;
  }
  if (els.refreshBtn) {
    els.refreshBtn.disabled = state.isSaving || state.isJobRunning;
  }
  if (els.retranslateFrontendAllBtn) {
    els.retranslateFrontendAllBtn.disabled = !state.permissions.canEditTranslations || state.isSaving || state.isJobRunning;
  }
  if (els.retranslateBackendViBtn) {
    els.retranslateBackendViBtn.disabled = !state.permissions.canEditTranslations || state.isSaving || state.isJobRunning;
  }

  for (const section of state.sections.values()) {
    const sectionDirty = section.dirty.size;
    if (section.els.saveBtn) {
      section.els.saveBtn.disabled = !state.permissions.canEditTranslations || !sectionDirty || state.isSaving || state.isJobRunning;
      section.els.saveBtn.textContent = sectionDirty ? `Save manual overrides (${sectionDirty})` : "Save manual overrides";
    }
    if (section.els.exportBtn) {
      section.els.exportBtn.disabled = !state.permissions.canReadTranslations || !section.current || state.isSaving || state.isJobRunning;
    }
    if (section.els.importBtn) {
      section.els.importBtn.disabled = !state.permissions.canEditTranslations || !section.current || state.isSaving || state.isJobRunning;
    }
    if (section.els.languageSelect) {
      section.els.languageSelect.disabled = state.isSaving || state.isJobRunning;
    }
  }

  if (hasDirty) {
    setStatus(`${dirtySections().length} section${dirtySections().length === 1 ? "" : "s"} with unsaved manual overrides.`);
  } else if (normalizeText(els.status?.textContent).includes("unsaved manual overrides")) {
    setStatus("No unsaved manual overrides.");
  }
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
    : `
      <div class="field">
        <label for="translations_${id}_language">Customer language</label>
        <select id="translations_${id}_language" data-section-language="${escapeHtml(config.key)}"></select>
      </div>
    `;

  return `
    <section class="translations-section" data-translation-section="${escapeHtml(config.key)}">
      <div class="translations-section__head">
        <div>
          <h2 class="translations-section__title">${escapeHtml(config.title)}</h2>
          <p class="micro">${escapeHtml(config.description)}</p>
        </div>
        <div class="translations-section__actions">
          <p class="micro translations-section__status" data-section-status role="status" aria-live="polite"></p>
          <button class="btn btn-ghost" type="button" data-section-export>Export manual overrides</button>
          <button class="btn btn-ghost" type="button" data-section-import>Import manual overrides</button>
          <input type="file" accept="application/json,.json" hidden data-section-import-input />
          <button class="btn btn-primary" type="button" disabled data-section-save>Save manual overrides</button>
        </div>
      </div>

      <div class="translations-controls">
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
    </section>
  `;
}

function renderSectionCards() {
  if (!els.sections) return;
  els.sections.innerHTML = SECTION_CONFIGS.map(sectionTemplate).join("");
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
        status: root?.querySelector("[data-section-status]") || null,
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
    renderLanguageOptions(section);
    bindSectionEvents(section);
  }
  updateActions();
}

function renderLanguageOptions(section) {
  const select = section?.els?.languageSelect;
  if (!select) return;
  const languages = Array.isArray(section.domain?.target_languages) ? section.domain.target_languages : [];
  const previous = normalizeText(select.value);
  select.innerHTML = languages
    .map((language) => `<option value="${escapeHtml(language.code)}">${escapeHtml(languageLabel(language))}</option>`)
    .join("");
  const nextValue = languages.some((language) => language.code === previous)
    ? previous
    : (languages[0]?.code || "");
  select.value = nextValue;
}

function selectedTargetLang(section) {
  if (section?.config?.fixedTargetLang) return section.config.fixedTargetLang;
  return normalizeText(section?.els?.languageSelect?.value || section?.current?.target_lang || section?.domain?.target_languages?.[0]?.code || "");
}

function renderSummary(section) {
  const counts = section.current?.counts || {};
  const parts = [
    ["Total", section.current?.total || 0],
    ["Manual overrides", counts.manual_override || 0],
    ["Machine", counts.machine || 0],
    ["Content translations", counts.content_translation || 0],
    ["Stale", counts.stale || 0],
    ["Missing", counts.missing || 0],
    ["Extra", counts.extra || 0]
  ];
  if (section.els.summary) {
    section.els.summary.innerHTML = parts
      .map(([label, count]) => `<span class="translations-summary__pill"><strong>${escapeHtml(label)}</strong> ${escapeHtml(count)}</span>`)
      .join("");
  }
}

function filteredRows(section) {
  const rows = Array.isArray(section.current?.rows) ? section.current.rows : [];
  const query = normalizeText(section.els.searchInput?.value).toLowerCase();
  const status = normalizeText(section.els.statusFilter?.value);
  return rows.filter((row) => {
    if (status && row.status !== status) return false;
    if (!query) return true;
    return [row.key, row.source, row.cached, row.override, row.status]
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

function renderTable(section) {
  const table = section.els.table;
  if (!table) return;
  const rows = filteredRows(section);
  if (!section.current) {
    table.innerHTML = `
      <thead><tr><th>English term</th><th>Cache</th><th>Manual override</th><th>Status</th></tr></thead>
      <tbody><tr><td colspan="4">Loading translation strings...</td></tr></tbody>
    `;
    updateActions();
    return;
  }
  if (!rows.length) {
    table.innerHTML = `
      <thead><tr><th>English term</th><th>Cache</th><th>Manual override</th><th>Status</th></tr></thead>
      <tbody><tr><td colspan="4">No translation strings match the current filter.</td></tr></tbody>
    `;
    updateActions();
    return;
  }

  table.innerHTML = `
    <thead>
      <tr>
        <th>English term</th>
        <th>Cache (read only)</th>
        <th>Manual override</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((row) => {
        const overrideValue = rowOverrideValue(section, row);
        const isDirty = section.dirty.has(row.key);
        const metadata = JSON.stringify(row.cache_meta || {}, null, 2);
        return `
          <tr class="${isDirty ? "is-dirty" : ""}" data-key="${escapeHtml(row.key)}">
            <td class="translations-table__text">
              ${escapeHtml(row.source || "-")}
              <details class="translations-table__meta">
                <summary>key and metadata</summary>
                <code>${escapeHtml(row.key)}</code>
                <pre>${escapeHtml(metadata)}</pre>
              </details>
            </td>
            <td class="translations-table__text">${escapeHtml(row.cached || "-")}</td>
            <td>
              <textarea class="translations-table__override" data-override-key="${escapeHtml(row.key)}" rows="3" ${state.permissions.canEditTranslations ? "" : "disabled"}>${escapeHtml(overrideValue)}</textarea>
            </td>
            <td>
              <span class="translations-status translations-status--${escapeHtml(row.status || "unknown")}">${escapeHtml(row.status || "unknown")}</span>
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
      if (tr) tr.classList.toggle("is-dirty", section.dirty.has(key));
      updateActions();
    });
  });
  updateActions();
}

async function loadDomains() {
  const payload = await fetchApi("/api/v1/static-translations/domains", { cache: "no-store" });
  state.domains = Array.isArray(payload?.domains) ? payload.domains : [];
  state.translationWritesEnabled = payload?.permissions?.can_write !== false;
  if (!state.translationWritesEnabled) {
    state.permissions.canEditTranslations = false;
    if (els.intro) {
      els.intro.textContent = "Manual translation overrides are read-only in this environment. Edit them in the source-of-truth development checkout and redeploy.";
    }
    setStatus("Translation override editing is disabled in this environment.");
  }
}

async function loadSectionState(section, { preserveLanguage = true } = {}) {
  section.domain = getDomain(section.config.domainId);
  if (!section.domain) {
    setSectionStatus(section, "Translation area is not configured.");
    renderTable(section);
    return;
  }
  renderLanguageOptions(section);
  const targetLang = preserveLanguage ? selectedTargetLang(section) : (section.config.fixedTargetLang || section.domain.target_languages?.[0]?.code || "");
  if (section.els.languageSelect && targetLang) section.els.languageSelect.value = targetLang;
  if (!targetLang) {
    setSectionStatus(section, "No target language configured.");
    renderTable(section);
    return;
  }

  section.dirty.clear();
  setSectionStatus(section, "Loading translations...");
  const payload = await fetchApi(`/api/v1/static-translations/${encodeURIComponent(section.domain.id)}/${encodeURIComponent(targetLang)}`, { cache: "no-store" });
  if (!payload) return;
  section.current = payload;
  renderSummary(section);
  renderTable(section);
  setSectionStatus(section, `Loaded ${payload.total || 0} strings.`);
}

async function loadAllSections({ preserveLanguage = true } = {}) {
  if (!state.domains.length) await loadDomains();
  if (!state.sections.size) renderSectionCards();
  const results = await Promise.allSettled(
    Array.from(state.sections.values()).map((section) => loadSectionState(section, { preserveLanguage }))
  );
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length) {
    showError(failed[0].reason?.message || "Could not load one or more translation sections.");
  } else {
    showError("");
    setStatus("All translation sections loaded.");
  }
  updateActions();
}

async function saveOverrides(section) {
  if (!state.permissions.canEditTranslations || !section.current || !section.dirty.size || state.isSaving) return;
  state.isSaving = true;
  updateActions();
  setSectionStatus(section, "Saving manual overrides...");
  const overrides = Object.fromEntries(section.dirty.entries());
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
  state.isSaving = false;
  if (payload) {
    section.current = payload;
    section.dirty.clear();
    renderSummary(section);
    renderTable(section);
    setSectionStatus(section, "Manual overrides saved.");
    showError("");
  }
  updateActions();
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
    latest = payload?.job || latest;
    renderJob(latest);
    if (latest?.status === "succeeded" || latest?.status === "failed") break;
    await waitForMs(1500);
  }
  state.isJobRunning = false;
  updateActions();
  if (latest?.status === "succeeded") {
    await hideOverlayAfterMinimum(overlayStartedAt);
    setStatus("Translations applied.");
    await loadAllSections({ preserveLanguage: true });
    return;
  }
  await hideOverlayAfterMinimum(overlayStartedAt);
  setStatus("Translation job failed.");
  showError(latest?.error || "Translation job failed.");
}

async function startJob(path, body = null, overlayText = translationsApplyingOverlayText()) {
  if (!state.permissions.canEditTranslations) {
    setStatus("Translation override editing is disabled in this environment.");
    return;
  }
  if (state.isJobRunning) return;
  if (dirtySections().length && !window.confirm("You have unsaved manual overrides. Continue without saving them?")) return;
  state.isJobRunning = true;
  updateActions();
  const overlayStartedAt = Date.now();
  setOverlayVisible(true, overlayText);
  if (els.applyLog) els.applyLog.textContent = "";
  const payload = await fetchApi(path, {
    method: "POST",
    ...(body ? { body } : {})
  });
  const job = payload?.job;
  if (!job?.id) {
    state.isJobRunning = false;
    await hideOverlayAfterMinimum(overlayStartedAt);
    updateActions();
    return;
  }
  renderJob(job);
  await pollJob(job.id, overlayStartedAt);
}

function bindSectionEvents(section) {
  section.els.languageSelect?.addEventListener("change", () => loadSectionState(section, { preserveLanguage: true }));
  section.els.searchInput?.addEventListener("input", () => renderTable(section));
  section.els.statusFilter?.addEventListener("change", () => renderTable(section));
  section.els.exportBtn?.addEventListener("click", () => exportOverrides(section));
  section.els.importBtn?.addEventListener("click", () => section.els.importInput?.click());
  section.els.importInput?.addEventListener("change", () => importOverridesFile(section, section.els.importInput.files?.[0] || null));
  section.els.saveBtn?.addEventListener("click", () => saveOverrides(section));
}

function bindEvents() {
  els.refreshBtn?.addEventListener("click", () => loadAllSections({ preserveLanguage: true }));
  els.applyBtn?.addEventListener("click", () => startJob("/api/v1/static-translations/apply", null, translationsApplyingOverlayText()));
  els.retranslateFrontendAllBtn?.addEventListener("click", () => {
    if (!window.confirm("Retranslate all customer-facing languages? This can take several minutes. Manual overrides are preserved.")) return;
    startJob("/api/v1/static-translations/retranslate", { mode: "frontend_all_languages" }, retranslateFrontendAllOverlayText());
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
