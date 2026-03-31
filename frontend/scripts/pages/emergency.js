import {
  createApiFetcher,
  escapeHtml,
  formatDateTime,
  normalizeText
} from "../shared/api.js";
import { DESTINATION_COUNTRY_CODE_SET } from "../../../shared/js/destination_country_codes.js";
import { GENERATED_APP_ROLES } from "../../Generated/Models/generated_Roles.js";
import { COUNTRY_CODE_OPTIONS } from "../shared/generated_catalogs.js";
import {
  backendT,
  getBackendApiBase,
  getBackendApiOrigin,
  initializeBackendPageChrome,
  loadBackendPageAuthState,
  withBackendApiLang
} from "../shared/backend_page.js";

const apiBase = getBackendApiBase();
const apiOrigin = getBackendApiOrigin();
const COUNTRY_REFERENCE_INFO_API_PATH = "/api/v1/country-reference-info";

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  logoutLink: document.getElementById("backendLogoutLink"),
  userLabel: document.getElementById("backendUserLabel"),
  error: document.getElementById("backendError"),
  status: document.getElementById("emergencyStatus"),
  list: document.getElementById("emergencyList"),
  addCountrySelect: document.getElementById("emergencyAddCountry"),
  addCountryBtn: document.getElementById("emergencyAddCountryBtn"),
  saveBtn: document.getElementById("emergencySaveBtn")
};

const GENERATED_ROLE_LOOKUP = Object.freeze(
  Object.fromEntries(
    GENERATED_APP_ROLES.map((role) => [String(role).replace(/^atp_/, "").toUpperCase(), role])
  )
);

const ROLES = Object.freeze({
  ADMIN: GENERATED_ROLE_LOOKUP.ADMIN,
  TOUR_EDITOR: GENERATED_ROLE_LOOKUP.TOUR_EDITOR
});

const COUNTRY_OPTIONS = Object.freeze(
  COUNTRY_CODE_OPTIONS
    .map((option) => ({
      value: normalizeText(option?.value).toUpperCase(),
      label: normalizeText(option?.label) || normalizeText(option?.value).toUpperCase()
    }))
    .filter((option) => DESTINATION_COUNTRY_CODE_SET.has(option.value))
    .filter((option) => option.value)
    .sort((left, right) => left.label.localeCompare(right.label, "en", { sensitivity: "base" }))
);

const COUNTRY_LABEL_BY_CODE = new Map(COUNTRY_OPTIONS.map((option) => [option.value, option.label]));

const state = {
  authUser: null,
  roles: [],
  permissions: {
    canReadEmergency: false,
    canEditEmergency: false
  },
  items: [],
  loaded: false,
  isDirty: false,
  saving: false
};

const fetchApi = createApiFetcher({
  apiBase,
  onError: (message) => showError(message),
  suppressNotFound: false,
  includeDetailInError: false,
  connectionErrorMessage: backendT("booking.error.connect", "Could not connect to backend API.")
});

function refreshBackendNavElements() {
  els.logoutLink = document.getElementById("backendLogoutLink");
  els.userLabel = document.getElementById("backendUserLabel");
}

function hasAnyRoleInList(roleList, ...roles) {
  return roles.some((role) => roleList.includes(role));
}

function countryLabel(countryCode) {
  const normalizedCountry = normalizeText(countryCode).toUpperCase();
  return normalizeText(COUNTRY_LABEL_BY_CODE.get(normalizedCountry)) || normalizedCountry;
}

function applyBackendI18n(root) {
  if (root && typeof window.backendI18n?.applyDataI18nAttributes === "function") {
    window.backendI18n.applyDataI18nAttributes(root);
  }
}

function sortCountryItems(items) {
  return [...(Array.isArray(items) ? items : [])].sort((left, right) => {
    const leftLabel = countryLabel(left?.country);
    const rightLabel = countryLabel(right?.country);
    return leftLabel.localeCompare(rightLabel, "en", { sensitivity: "base" })
      || normalizeText(left?.country).localeCompare(normalizeText(right?.country), "en");
  });
}

function showError(message) {
  if (!els.error) return;
  els.error.textContent = message;
  els.error.classList.add("show");
}

function clearError() {
  if (!els.error) return;
  els.error.textContent = "";
  els.error.classList.remove("show");
}

function setStatus(message = "", isError = false) {
  if (!els.status) return;
  els.status.textContent = normalizeText(message);
  els.status.classList.toggle("is-error", Boolean(isError));
}

function updateControls() {
  const missingCountries = getMissingCountryOptions();
  if (els.addCountryBtn) {
    els.addCountryBtn.disabled = !state.permissions.canEditEmergency || !missingCountries.length;
  }
  if (els.addCountrySelect) {
    els.addCountrySelect.disabled = !state.permissions.canEditEmergency || !missingCountries.length;
  }
  if (els.saveBtn) {
    els.saveBtn.disabled = !state.permissions.canEditEmergency || !state.loaded || state.saving || !state.isDirty;
  }
}

function buildEmptyCountryItem(country) {
  return {
    country: normalizeText(country).toUpperCase(),
    practical_tips: [],
    emergency_contacts: [],
    updated_at: null
  };
}

function getMissingCountryOptions() {
  const used = new Set((Array.isArray(state.items) ? state.items : []).map((item) => normalizeText(item?.country).toUpperCase()).filter(Boolean));
  return COUNTRY_OPTIONS.filter((option) => !used.has(option.value));
}

function renderAddCountryOptions() {
  if (!els.addCountrySelect) return;
  const options = getMissingCountryOptions();
  if (!options.length) {
    els.addCountrySelect.innerHTML = `<option value="">${escapeHtml(backendT("backend.emergency.all_countries_added", "All countries already added"))}</option>`;
    return;
  }
  els.addCountrySelect.innerHTML = options.map((option) => (
    `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)} (${escapeHtml(option.value)})</option>`
  )).join("");
}

function renderEmergencyContactRows(country, contacts) {
  const normalizedContacts = Array.isArray(contacts) ? contacts : [];
  if (!normalizedContacts.length) {
    return `<p class="micro emergency-country-card__empty" data-i18n-id="backend.emergency.no_contacts">No emergency contacts yet.</p>`;
  }
  return normalizedContacts.map((contact, index) => `
    <div class="emergency-contact-row" data-emergency-contact-row data-contact-index="${index}">
      <input
        type="text"
        value="${escapeHtml(contact?.label || "")}"
        placeholder="${escapeHtml(backendT("backend.emergency.contact_label_placeholder", "Police"))}"
        data-emergency-contact-label
      />
      <input
        type="text"
        value="${escapeHtml(contact?.phone || "")}"
        placeholder="${escapeHtml(backendT("backend.emergency.contact_phone_placeholder", "113"))}"
        data-emergency-contact-phone
      />
      <input
        type="text"
        value="${escapeHtml(contact?.note || "")}"
        placeholder="${escapeHtml(backendT("backend.emergency.contact_note_placeholder", "Optional note"))}"
        data-emergency-contact-note
      />
      <button
        class="btn btn-ghost emergency-contact-row__remove"
        type="button"
        aria-label="${escapeHtml(backendT("common.remove", "Remove"))}"
        data-emergency-remove-contact="${escapeHtml(country)}"
        data-contact-index="${index}"
      >&times;</button>
    </div>
  `).join("");
}

function renderItems() {
  if (!els.list) return;
  const items = sortCountryItems(state.items);
  if (!items.length) {
    els.list.innerHTML = `<p class="micro emergency-editor__empty" data-i18n-id="backend.emergency.no_countries">No countries yet.</p>`;
    applyBackendI18n(els.list);
    return;
  }

  els.list.innerHTML = items.map((item) => {
    const country = normalizeText(item?.country).toUpperCase();
    const tips = Array.isArray(item?.practical_tips) ? item.practical_tips.map((entry) => normalizeText(entry)).filter(Boolean).join("\n") : "";
    const updatedAt = normalizeText(item?.updated_at);
    const updatedCopy = updatedAt
      ? backendT("backend.emergency.updated_at", "Updated {value}", { value: formatDateTime(updatedAt) })
      : backendT("backend.emergency.not_saved_yet", "Not saved yet");

    return `
      <article class="emergency-country-card" data-emergency-country-card data-country="${escapeHtml(country)}">
        <div class="emergency-country-card__head">
          <div>
            <h2 class="u-title-small emergency-country-card__title">${escapeHtml(countryLabel(country))} <span class="micro">(${escapeHtml(country)})</span></h2>
            <p class="micro emergency-country-card__updated">${escapeHtml(updatedCopy)}</p>
          </div>
          <button
            class="btn btn-ghost emergency-country-card__remove"
            type="button"
            aria-label="${escapeHtml(backendT("backend.emergency.remove_country", "Remove country"))}"
            data-emergency-remove-country="${escapeHtml(country)}"
          >&times;</button>
        </div>

        <div class="field full">
          <label class="field-label" data-i18n-id="backend.emergency.practical_tips">Practical tips</label>
          <textarea
            rows="5"
            placeholder="${escapeHtml(backendT("backend.emergency.practical_tips_placeholder", "One tip per line"))}"
            data-emergency-practical-tips
          >${escapeHtml(tips)}</textarea>
          <p class="micro" data-i18n-id="backend.emergency.practical_tips_hint">Write one practical tip per line.</p>
        </div>

        <div class="field full">
          <div class="emergency-country-card__contacts-head">
            <label class="field-label" data-i18n-id="backend.emergency.emergency_contacts">Emergency contacts</label>
            <button
              class="btn btn-ghost"
              type="button"
              data-emergency-add-contact="${escapeHtml(country)}"
              data-i18n-id="backend.emergency.add_contact"
            >Add contact</button>
          </div>
          <div class="emergency-country-card__contacts">
            ${renderEmergencyContactRows(country, item?.emergency_contacts)}
          </div>
        </div>
      </article>
    `;
  }).join("");
  applyBackendI18n(els.list);
}

function readItemsFromDom() {
  if (!els.list) return sortCountryItems(state.items);
  const cards = Array.from(els.list.querySelectorAll("[data-emergency-country-card]"));
  if (!cards.length) return sortCountryItems(state.items);
  return sortCountryItems(cards.map((card) => {
    const country = normalizeText(card.getAttribute("data-country")).toUpperCase();
    const previousItem = (Array.isArray(state.items) ? state.items : []).find((item) => normalizeText(item?.country).toUpperCase() === country);
    const practicalTips = (card.querySelector("[data-emergency-practical-tips]")?.value || "")
      .split(/\r?\n/)
      .map((entry) => normalizeText(entry))
      .filter(Boolean);
    const emergencyContacts = Array.from(card.querySelectorAll("[data-emergency-contact-row]"))
      .map((row) => ({
        label: normalizeText(row.querySelector("[data-emergency-contact-label]")?.value),
        phone: normalizeText(row.querySelector("[data-emergency-contact-phone]")?.value),
        note: normalizeText(row.querySelector("[data-emergency-contact-note]")?.value)
      }))
      .filter((contact) => contact.label || contact.phone || contact.note)
      .map((contact) => ({
        label: contact.label,
        phone: contact.phone,
        ...(contact.note ? { note: contact.note } : {})
      }));
    return {
      country,
      practical_tips: practicalTips,
      emergency_contacts: emergencyContacts,
      updated_at: normalizeText(previousItem?.updated_at) || null
    };
  }));
}

function validateItems(items) {
  const seen = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    const country = normalizeText(item?.country).toUpperCase();
    if (!country) {
      return backendT("backend.emergency.validation.country_required", "Each entry needs a country.");
    }
    if (seen.has(country)) {
      return backendT("backend.emergency.validation.duplicate_country", "Each country can appear only once.");
    }
    seen.add(country);
    const contacts = Array.isArray(item?.emergency_contacts) ? item.emergency_contacts : [];
    for (const contact of contacts) {
      const label = normalizeText(contact?.label);
      const phone = normalizeText(contact?.phone);
      const note = normalizeText(contact?.note);
      if (!label && !phone && !note) continue;
      if (!label || !phone) {
        return backendT("backend.emergency.validation.contact_label_phone", "Each emergency contact needs both a label and a phone number.");
      }
    }
  }
  return "";
}

function syncStateFromDom() {
  state.items = readItemsFromDom();
}

function markDirty() {
  if (!state.loaded) return;
  state.isDirty = true;
  setStatus(backendT("backend.emergency.unsaved", "Unsaved changes."));
  updateControls();
}

async function loadCountryReferenceInfo() {
  clearError();
  setStatus(backendT("backend.emergency.loading", "Loading emergency information..."));
  const payload = await fetchApi(withBackendApiLang(COUNTRY_REFERENCE_INFO_API_PATH));
  if (!payload) {
    setStatus("", true);
    return;
  }
  state.items = sortCountryItems(Array.isArray(payload.items) ? payload.items : []);
  state.loaded = true;
  state.isDirty = false;
  renderItems();
  renderAddCountryOptions();
  setStatus(backendT("backend.emergency.ready", "Emergency information loaded."));
  updateControls();
}

async function saveCountryReferenceInfo() {
  if (!state.permissions.canEditEmergency || state.saving) return;
  clearError();
  syncStateFromDom();
  const validationError = validateItems(state.items);
  if (validationError) {
    showError(validationError);
    setStatus(validationError, true);
    return;
  }
  state.saving = true;
  updateControls();
  setStatus(backendT("backend.emergency.saving", "Saving emergency information..."));
  const payload = await fetchApi(withBackendApiLang(COUNTRY_REFERENCE_INFO_API_PATH), {
    method: "PATCH",
    body: {
      items: state.items
    }
  });
  state.saving = false;
  if (!payload) {
    updateControls();
    return;
  }
  state.items = sortCountryItems(Array.isArray(payload.items) ? payload.items : []);
  state.isDirty = false;
  renderItems();
  renderAddCountryOptions();
  setStatus(backendT("backend.emergency.saved", "Emergency information saved."));
  updateControls();
}

function handleAddCountry() {
  if (!state.permissions.canEditEmergency) return;
  syncStateFromDom();
  const country = normalizeText(els.addCountrySelect?.value).toUpperCase();
  if (!country) return;
  if (state.items.some((item) => normalizeText(item?.country).toUpperCase() === country)) return;
  state.items = sortCountryItems([...state.items, buildEmptyCountryItem(country)]);
  state.isDirty = true;
  renderItems();
  renderAddCountryOptions();
  setStatus(backendT("backend.emergency.unsaved", "Unsaved changes."));
  updateControls();
}

function bindEvents() {
  els.addCountryBtn?.addEventListener("click", handleAddCountry);
  els.saveBtn?.addEventListener("click", () => saveCountryReferenceInfo());

  els.list?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !state.permissions.canEditEmergency) return;

    const removeCountryButton = target.closest("[data-emergency-remove-country]");
    if (removeCountryButton) {
      syncStateFromDom();
      const country = normalizeText(removeCountryButton.getAttribute("data-emergency-remove-country")).toUpperCase();
      state.items = state.items.filter((item) => normalizeText(item?.country).toUpperCase() !== country);
      state.isDirty = true;
      renderItems();
      renderAddCountryOptions();
      setStatus(backendT("backend.emergency.unsaved", "Unsaved changes."));
      updateControls();
      return;
    }

    const addContactButton = target.closest("[data-emergency-add-contact]");
    if (addContactButton) {
      syncStateFromDom();
      const country = normalizeText(addContactButton.getAttribute("data-emergency-add-contact")).toUpperCase();
      state.items = state.items.map((item) => (
        normalizeText(item?.country).toUpperCase() === country
          ? {
            ...item,
            emergency_contacts: [
              ...(Array.isArray(item?.emergency_contacts) ? item.emergency_contacts : []),
              { label: "", phone: "", note: "" }
            ]
          }
          : item
      ));
      state.isDirty = true;
      renderItems();
      renderAddCountryOptions();
      setStatus(backendT("backend.emergency.unsaved", "Unsaved changes."));
      updateControls();
      return;
    }

    const removeContactButton = target.closest("[data-emergency-remove-contact]");
    if (removeContactButton) {
      syncStateFromDom();
      const country = normalizeText(removeContactButton.getAttribute("data-emergency-remove-contact")).toUpperCase();
      const contactIndex = Number(removeContactButton.getAttribute("data-contact-index"));
      state.items = state.items.map((item) => {
        if (normalizeText(item?.country).toUpperCase() !== country) return item;
        const contacts = Array.isArray(item?.emergency_contacts) ? [...item.emergency_contacts] : [];
        if (Number.isInteger(contactIndex) && contactIndex >= 0 && contactIndex < contacts.length) {
          contacts.splice(contactIndex, 1);
        }
        return {
          ...item,
          emergency_contacts: contacts
        };
      });
      state.isDirty = true;
      renderItems();
      renderAddCountryOptions();
      setStatus(backendT("backend.emergency.unsaved", "Unsaved changes."));
      updateControls();
    }
  });

  els.list?.addEventListener("input", () => {
    if (!state.permissions.canEditEmergency) return;
    markDirty();
  });
}

async function init() {
  bindEvents();

  const chrome = await initializeBackendPageChrome({
    currentSection: "emergency",
    homeLink: els.homeLink,
    refreshNav: refreshBackendNavElements
  });
  els.logoutLink = chrome.logoutLink;
  els.userLabel = chrome.userLabel;

  const authState = await loadBackendPageAuthState({
    apiOrigin,
    refreshNav: refreshBackendNavElements,
    computePermissions: (roles) => ({
      canReadEmergency: hasAnyRoleInList(roles, ROLES.ADMIN, ROLES.TOUR_EDITOR),
      canEditEmergency: hasAnyRoleInList(roles, ROLES.ADMIN, ROLES.TOUR_EDITOR)
    }),
    hasPageAccess: (permissions) => permissions.canReadEmergency,
    logKey: "backend-emergency",
    pageName: "emergency.html",
    expectedRolesAnyOf: [ROLES.ADMIN, ROLES.TOUR_EDITOR],
    likelyCause: "The user is authenticated in Keycloak but does not have the ATP roles required to access emergency references."
  });

  state.authUser = authState.authUser;
  state.roles = authState.roles;
  state.permissions = {
    canReadEmergency: Boolean(authState.permissions?.canReadEmergency),
    canEditEmergency: Boolean(authState.permissions?.canEditEmergency)
  };

  renderAddCountryOptions();
  updateControls();

  if (!state.permissions.canReadEmergency) {
    showError(backendT("backend.emergency.forbidden", "You do not have access to emergency references."));
    return;
  }

  await loadCountryReferenceInfo();
}

init();
