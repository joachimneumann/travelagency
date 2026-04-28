import { createApiFetcher, escapeHtml, formatDateTime, normalizeText } from "../shared/api.js";
import {
  getBackendApiOrigin,
  initializeBackendPageChrome,
  loadBackendPageAuthState,
  refreshBackendNavElements
} from "../shared/backend_page.js";

const ROLES = { ADMIN: "atp_admin" };

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  error: document.getElementById("backendError"),
  panel: document.getElementById("translationsPanel"),
  intro: document.getElementById("translationsIntro"),
  status: document.getElementById("translationsStatus"),
  domainSelect: document.getElementById("translationsDomainSelect"),
  languageSelect: document.getElementById("translationsLanguageSelect"),
  searchInput: document.getElementById("translationsSearchInput"),
  statusFilter: document.getElementById("translationsStatusFilter"),
  summary: document.getElementById("translationsSummary"),
  table: document.getElementById("translationsTable"),
  refreshBtn: document.getElementById("translationsRefreshBtn"),
  exportBtn: document.getElementById("translationsExportBtn"),
  importBtn: document.getElementById("translationsImportBtn"),
  importInput: document.getElementById("translationsImportInput"),
  saveBtn: document.getElementById("translationsSaveBtn"),
  applyBtn: document.getElementById("translationsApplyBtn"),
  retranslateCurrentBtn: document.getElementById("translationsRetranslateCurrentBtn"),
  retranslateFrontendAllBtn: document.getElementById("translationsRetranslateFrontendAllBtn"),
  retranslateBackendViBtn: document.getElementById("translationsRetranslateBackendViBtn"),
  overlay: document.getElementById("translationsApplyOverlay"),
  overlayText: document.getElementById("translationsApplyOverlayText"),
  applyLog: document.getElementById("translationsApplyLog")
};

const state = {
  domains: [],
  current: null,
  dirty: new Map(),
  permissions: {
    canReadTranslations: false,
    canEditTranslations: false
  },
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

function selectedDomainId() {
  return normalizeText(els.domainSelect?.value || state.current?.domain?.id || "frontend");
}

function selectedTargetLang() {
  return normalizeText(els.languageSelect?.value || state.current?.target_lang || "");
}

function translationsApplyingOverlayText() {
  return backendT("backend.translations.applying_overlay", "Applying translations. Please wait.");
}

function retranslateCurrentOverlayText() {
  return backendT("backend.translations.retranslate_current_overlay", "Retranslating current language. Please wait.");
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

function updateActions() {
  const hasDirty = state.dirty.size > 0;
  if (els.saveBtn) {
    els.saveBtn.disabled = !state.permissions.canEditTranslations || !hasDirty || state.isSaving || state.isJobRunning;
    els.saveBtn.textContent = hasDirty ? `Save overrides (${state.dirty.size})` : "Save overrides";
  }
  if (els.applyBtn) {
    els.applyBtn.disabled = !state.permissions.canEditTranslations || state.isSaving || state.isJobRunning;
  }
  if (els.refreshBtn) {
    els.refreshBtn.disabled = state.isSaving || state.isJobRunning;
  }
  if (els.exportBtn) {
    els.exportBtn.disabled = !state.permissions.canReadTranslations || !state.current || state.isSaving || state.isJobRunning;
  }
  if (els.importBtn) {
    els.importBtn.disabled = !state.permissions.canEditTranslations || !state.current || state.isSaving || state.isJobRunning;
  }
  if (els.retranslateCurrentBtn) {
    els.retranslateCurrentBtn.disabled = !state.permissions.canEditTranslations || state.isSaving || state.isJobRunning;
  }
  if (els.retranslateFrontendAllBtn) {
    els.retranslateFrontendAllBtn.disabled = !state.permissions.canEditTranslations || state.isSaving || state.isJobRunning || selectedDomainId() !== "frontend";
  }
  if (els.retranslateBackendViBtn) {
    els.retranslateBackendViBtn.disabled = !state.permissions.canEditTranslations || state.isSaving || state.isJobRunning;
  }
}

function renderDomainOptions() {
  if (!els.domainSelect) return;
  els.domainSelect.innerHTML = state.domains
    .map((domain) => `<option value="${escapeHtml(domain.id)}">${escapeHtml(domain.label || domain.id)}</option>`)
    .join("");
}

function renderLanguageOptions(domain) {
  if (!els.languageSelect) return;
  const languages = Array.isArray(domain?.target_languages) ? domain.target_languages : [];
  els.languageSelect.innerHTML = languages
    .map((language) => `<option value="${escapeHtml(language.code)}">${escapeHtml(languageLabel(language))}</option>`)
    .join("");
}

function renderSummary() {
  const counts = state.current?.counts || {};
  const parts = [
    ["Total", state.current?.total || 0],
    ["Overrides", counts.manual_override || 0],
    ["Content translations", counts.content_translation || 0],
    ["Stale", counts.stale || 0],
    ["Missing", counts.missing || 0],
    ["Extra", counts.extra || 0]
  ];
  if (els.summary) {
    els.summary.innerHTML = parts
      .map(([label, count]) => `<span class="translations-summary__pill"><strong>${escapeHtml(label)}</strong> ${escapeHtml(count)}</span>`)
      .join("");
  }
  if (els.intro) {
    els.intro.textContent = state.current?.domain?.context || "Manage static translation overrides and inspect cached generated strings.";
  }
}

function filteredRows() {
  const rows = Array.isArray(state.current?.rows) ? state.current.rows : [];
  const query = normalizeText(els.searchInput?.value).toLowerCase();
  const status = normalizeText(els.statusFilter?.value);
  return rows.filter((row) => {
    if (status && row.status !== status) return false;
    if (!query) return true;
    return [row.key, row.source, row.cached, row.override, row.status]
      .some((value) => normalizeText(value).toLowerCase().includes(query));
  });
}

function rowOverrideValue(row) {
  return state.dirty.has(row.key) ? state.dirty.get(row.key) : normalizeText(row.override);
}

function sourceRows() {
  return (Array.isArray(state.current?.rows) ? state.current.rows : [])
    .filter((row) => normalizeText(row.key) && normalizeText(row.source));
}

function currentOverrideObject() {
  const overrides = {};
  for (const row of sourceRows()) {
    const value = rowOverrideValue(row);
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

function exportOverrides() {
  if (!state.current) return;
  const overrides = currentOverrideObject();
  const blob = new Blob([`${JSON.stringify(overrides, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.current.domain.id}-${state.current.target_lang}-translation-overrides-${timestampForFilename()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus(`Exported ${Object.keys(overrides).length} overrides.`);
}

function normalizeImportedOverrides(parsed) {
  const rawOverrides = parsed?.overrides && typeof parsed.overrides === "object" && !Array.isArray(parsed.overrides)
    ? parsed.overrides
    : parsed;
  if (!rawOverrides || typeof rawOverrides !== "object" || Array.isArray(rawOverrides)) {
    throw new Error("Import file must contain a JSON object of translation overrides.");
  }
  for (const [key, value] of Object.entries(rawOverrides)) {
    if (value !== null && typeof value === "object") {
      throw new Error(`Override value for ${key} must be text.`);
    }
  }
  return Object.fromEntries(
    Object.entries(rawOverrides)
      .map(([key, value]) => [normalizeText(key), normalizeText(value)])
      .filter(([key, value]) => key && value)
  );
}

function stageImportedOverrides(importedOverrides) {
  const rows = sourceRows();
  const sourceKeySet = new Set(rows.map((row) => row.key));
  const unknownKeys = Object.keys(importedOverrides).filter((key) => !sourceKeySet.has(key));
  if (unknownKeys.length) {
    const preview = unknownKeys.slice(0, 8).join(", ");
    throw new Error(`Import contains unknown translation keys: ${preview}${unknownKeys.length > 8 ? ", ..." : ""}`);
  }

  state.dirty.clear();
  for (const row of rows) {
    const importedValue = normalizeText(importedOverrides[row.key]);
    const currentValue = normalizeText(row.override);
    if (importedValue !== currentValue) {
      state.dirty.set(row.key, importedValue);
    }
  }
  renderSummary();
  renderTable();
  updateActions();
  setStatus(`Imported ${Object.keys(importedOverrides).length} overrides. Save to persist this replacement set.`);
}

async function importOverridesFile(file) {
  if (!file) return;
  try {
    if (!state.current) throw new Error("Select a translation language before importing overrides.");
    if (state.dirty.size && !window.confirm("Import will replace the currently staged override edits. Continue?")) return;
    const parsed = JSON.parse(await file.text());
    stageImportedOverrides(normalizeImportedOverrides(parsed));
    showError("");
  } catch (error) {
    showError(error?.message || "Could not import translation overrides.");
  } finally {
    if (els.importInput) els.importInput.value = "";
  }
}

function renderTable() {
  if (!els.table) return;
  const rows = filteredRows();
  if (!rows.length) {
    els.table.innerHTML = `
      <thead><tr><th>Key</th><th>Source</th><th>Cache</th><th>Override</th><th>Status</th></tr></thead>
      <tbody><tr><td colspan="5">No translation strings match the current filter.</td></tr></tbody>
    `;
    updateActions();
    return;
  }

  els.table.innerHTML = `
    <thead>
      <tr>
        <th>Key</th>
        <th>Source text</th>
        <th>Cache (read only)</th>
        <th>Override / translation</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((row) => {
        const overrideValue = rowOverrideValue(row);
        const isDirty = state.dirty.has(row.key);
        const metadata = JSON.stringify(row.cache_meta || {}, null, 2);
        return `
          <tr class="${isDirty ? "is-dirty" : ""}" data-key="${escapeHtml(row.key)}">
            <td class="translations-table__key">
              <code>${escapeHtml(row.key)}</code>
              <details class="translations-table__meta">
                <summary>metadata</summary>
                <pre>${escapeHtml(metadata)}</pre>
              </details>
            </td>
            <td class="translations-table__text">${escapeHtml(row.source || "-")}</td>
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

  els.table.querySelectorAll("[data-override-key]").forEach((textarea) => {
    textarea.addEventListener("input", () => {
      const key = textarea.getAttribute("data-override-key");
      const original = normalizeText((state.current?.rows || []).find((row) => row.key === key)?.override);
      const next = normalizeText(textarea.value);
      if (next === original) {
        state.dirty.delete(key);
      } else {
        state.dirty.set(key, next);
      }
      const tr = textarea.closest("tr");
      if (tr) tr.classList.toggle("is-dirty", state.dirty.has(key));
      updateActions();
    });
  });
  updateActions();
}

async function loadDomains() {
  const payload = await fetchApi("/api/v1/static-translations/domains", { cache: "no-store" });
  state.domains = Array.isArray(payload?.domains) ? payload.domains : [];
  renderDomainOptions();
}

async function loadCurrentState({ preserveSelection = false } = {}) {
  if (!state.domains.length) await loadDomains();
  const domainId = preserveSelection ? selectedDomainId() : selectedDomainId() || state.domains[0]?.id;
  const requestedTargetLang = preserveSelection ? selectedTargetLang() : selectedTargetLang();
  const domain = state.domains.find((entry) => entry.id === domainId) || state.domains[0];
  if (!domain) return;

  if (els.domainSelect) els.domainSelect.value = domain.id;
  renderLanguageOptions(domain);
  const targetLang = requestedTargetLang || domain.target_languages?.[0]?.code;
  const resolvedLang = domain.target_languages?.some((entry) => entry.code === targetLang)
    ? targetLang
    : domain.target_languages?.[0]?.code;
  if (els.languageSelect) els.languageSelect.value = resolvedLang || "";
  if (!resolvedLang) return;

  state.dirty.clear();
  setStatus("Loading translations...");
  const payload = await fetchApi(`/api/v1/static-translations/${encodeURIComponent(domain.id)}/${encodeURIComponent(resolvedLang)}`, { cache: "no-store" });
  if (!payload) return;
  state.current = payload;
  renderSummary();
  renderTable();
  setStatus(`Loaded ${payload.total || 0} strings.`);
}

async function saveOverrides() {
  if (!state.current || !state.dirty.size || state.isSaving) return;
  state.isSaving = true;
  updateActions();
  setStatus("Saving overrides...");
  const overrides = Object.fromEntries(state.dirty.entries());
  const payload = await fetchApi(
    `/api/v1/static-translations/${encodeURIComponent(state.current.domain.id)}/${encodeURIComponent(state.current.target_lang)}/overrides`,
    {
      method: "PATCH",
      body: {
        expected_revision: state.current.revision,
        overrides
      }
    }
  );
  state.isSaving = false;
  if (payload) {
    state.current = payload;
    state.dirty.clear();
    renderSummary();
    renderTable();
    const saveLabel = state.current?.domain?.id === "homepage-content" ? "Content translations" : "Overrides";
    setStatus(`${saveLabel} saved. Use Apply to update the generated dictionaries and homepage assets.`);
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
    await new Promise((resolve) => window.setTimeout(resolve, 1500));
  }
  state.isJobRunning = false;
  updateActions();
  if (latest?.status === "succeeded") {
    await hideOverlayAfterMinimum(overlayStartedAt);
    setStatus("Translations applied.");
    await loadCurrentState({ preserveSelection: true });
    return;
  }
  await hideOverlayAfterMinimum(overlayStartedAt);
  setStatus("Translation job failed.");
  showError(latest?.error || "Translation job failed.");
}

async function startJob(path, body = null, overlayText = translationsApplyingOverlayText()) {
  if (state.isJobRunning) return;
  if (state.dirty.size && !window.confirm("You have unsaved overrides. Continue without saving them?")) return;
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

function bindEvents() {
  els.domainSelect?.addEventListener("change", () => loadCurrentState({ preserveSelection: true }));
  els.languageSelect?.addEventListener("change", () => loadCurrentState({ preserveSelection: true }));
  els.searchInput?.addEventListener("input", renderTable);
  els.statusFilter?.addEventListener("change", renderTable);
  els.refreshBtn?.addEventListener("click", () => loadCurrentState({ preserveSelection: true }));
  els.exportBtn?.addEventListener("click", exportOverrides);
  els.importBtn?.addEventListener("click", () => els.importInput?.click());
  els.importInput?.addEventListener("change", () => importOverridesFile(els.importInput.files?.[0] || null));
  els.saveBtn?.addEventListener("click", saveOverrides);
  els.applyBtn?.addEventListener("click", () => startJob("/api/v1/static-translations/apply", null, translationsApplyingOverlayText()));
  els.retranslateCurrentBtn?.addEventListener("click", () => {
    if (!window.confirm("Retranslate cached machine translations for the current language? Manual overrides are preserved.")) return;
    const mode = selectedDomainId() === "backend" ? "backend_vi" : "frontend_current_language";
    startJob("/api/v1/static-translations/retranslate", {
      mode,
      target_lang: selectedTargetLang()
    }, retranslateCurrentOverlayText());
  });
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
  await loadCurrentState();
}

function handleBackendLanguageChanged() {
  if (!state.permissions.canReadTranslations) {
    showError(backendT("backend.translations.forbidden", "You do not have access to translations."));
    return;
  }
  const domainId = selectedDomainId();
  const targetLang = selectedTargetLang();
  renderDomainOptions();
  if (els.domainSelect) {
    els.domainSelect.value = domainId;
  }
  renderLanguageOptions(state.current?.domain);
  if (els.languageSelect) {
    els.languageSelect.value = targetLang;
  }
  renderSummary();
  renderTable();
  updateActions();
}

init().catch((error) => {
  console.error("[translations] Initialization failed.", error);
  showError(error?.message || "Could not initialize translations page.");
});
