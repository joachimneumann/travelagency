import { normalizeText } from "../shared/api.js";
import {
  BOOKING_EDITING_LANGUAGE_OPTIONS,
  BOOKING_CONTENT_LANGUAGE_OPTIONS,
  bookingContentLang,
  bookingContentLanguageOption,
  bookingEditingLang,
  bookingEditingLanguageOption,
  normalizeBookingEditingLang,
  normalizeBookingContentLang,
  readStoredBookingEditingLanguage,
  setBookingEditingLang,
} from "../booking/i18n.js";

export function createBookingPageLanguageController(ctx) {
  const {
    state,
    els,
    apiOrigin,
    escapeHtml,
    backendT,
    updateCoreDirtyState,
    setStatus,
    loadBookingPage
  } = ctx;

  async function waitForBackendI18n() {
    await (window.__BACKEND_I18N_PROMISE || Promise.resolve());
  }

  function currentBackendLang() {
    return typeof window.backendI18n?.getLang === "function" ? window.backendI18n.getLang() : "";
  }

  function withBackendLang(pathname, params = {}) {
    const url = new URL(pathname, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
    const lang = currentBackendLang();
    if (lang) url.searchParams.set("lang", lang);
    return `${url.pathname}${url.search}`;
  }

  function withBookingContentLang(pathname, params = {}) {
    const url = new URL(pathname, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
    const lang = state.contentLang || bookingContentLang("en");
    if (lang) url.searchParams.set("lang", lang);
    return `${url.pathname}${url.search}`;
  }

  function updateContentLangInUrl(lang) {
    const nextUrl = new URL(window.location.href);
    const normalized = normalizeBookingContentLang(lang || state.contentLang || "en");
    nextUrl.searchParams.set("content_lang", normalized);
    window.history.replaceState({}, "", nextUrl);
  }

  function resolveSubmissionCustomerLanguage(booking) {
    const submissionPreferredLanguage = normalizeText(booking?.web_form_submission?.preferred_language);
    const customerLanguage = normalizeText(booking?.customer_language);
    if (customerLanguage) {
      return normalizeBookingContentLang(customerLanguage);
    }
    return normalizeBookingContentLang(submissionPreferredLanguage || "en");
  }

  function resolveSubmissionEditingLanguage(booking) {
    const editingLanguage = normalizeText(booking?.editing_language);
    if (editingLanguage) {
      return normalizeBookingEditingLang(editingLanguage);
    }
    return readStoredBookingEditingLanguage(booking?.id || state.id, currentBackendLang() || "en");
  }

  function closeContentLanguageMenu() {
    const menu = els.contentLanguageMenuMount?.querySelector('[data-booking-content-lang-menu="true"]');
    const trigger = menu?.querySelector('[data-booking-content-lang-trigger="true"]');
    const panel = menu?.querySelector('[data-booking-content-lang-panel="true"]');
    if (!menu || !trigger || !panel) return;
    menu.classList.remove("is-open");
    panel.hidden = true;
    panel.style.position = "";
    panel.style.left = "";
    panel.style.top = "";
    panel.style.right = "";
    panel.style.width = "";
    panel.style.maxHeight = "";
    panel.style.visibility = "";
    trigger.setAttribute("aria-expanded", "false");
  }

  let dismissHandlersBound = false;

  function positionContentLanguageMenu(trigger, panel) {
    if (!trigger || !panel) return;
    const viewportPadding = 12;
    const menuGap = 8;

    panel.style.position = "fixed";
    panel.style.left = "0px";
    panel.style.top = "0px";
    panel.style.right = "auto";
    panel.style.width = "";
    panel.style.maxHeight = "";
    panel.style.visibility = "hidden";

    const triggerRect = trigger.getBoundingClientRect();
    const measuredRect = panel.getBoundingClientRect();
    const maxPanelWidth = Math.max(180, window.innerWidth - viewportPadding * 2);
    const panelWidth = Math.min(Math.max(measuredRect.width || 240, 180), maxPanelWidth);
    const preferredLeft = triggerRect.left;
    const left = Math.min(
      Math.max(preferredLeft, viewportPadding),
      Math.max(viewportPadding, window.innerWidth - panelWidth - viewportPadding)
    );

    panel.style.width = `${Math.round(panelWidth)}px`;
    panel.style.maxHeight = `${Math.max(180, Math.min(380, window.innerHeight - viewportPadding * 2))}px`;

    const panelHeight = Math.min(panel.scrollHeight || measuredRect.height || 0, parseFloat(panel.style.maxHeight) || 380);
    const belowTop = triggerRect.bottom + menuGap;
    const aboveTop = triggerRect.top - menuGap - panelHeight;
    let top = belowTop;
    if (belowTop + panelHeight > window.innerHeight - viewportPadding && aboveTop >= viewportPadding) {
      top = aboveTop;
    } else if (belowTop + panelHeight > window.innerHeight - viewportPadding) {
      top = Math.max(viewportPadding, window.innerHeight - viewportPadding - panelHeight);
    }

    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
    panel.style.visibility = "";
  }

  function ensureContentLanguageMenuDismissHandlers() {
    if (dismissHandlersBound) return;
    dismissHandlersBound = true;
    document.addEventListener("click", (event) => {
      const menu = els.contentLanguageMenuMount?.querySelector('[data-booking-content-lang-menu="true"]');
      if (!menu || menu.contains(event.target)) return;
      closeContentLanguageMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeContentLanguageMenu();
    });
    window.addEventListener("resize", () => {
      const menu = els.contentLanguageMenuMount?.querySelector('[data-booking-content-lang-menu="true"]');
      const trigger = menu?.querySelector('[data-booking-content-lang-trigger="true"]');
      const panel = menu?.querySelector('[data-booking-content-lang-panel="true"]');
      if (!menu?.classList.contains("is-open") || !trigger || !panel) return;
      positionContentLanguageMenu(trigger, panel);
    });
    window.addEventListener("scroll", () => {
      const menu = els.contentLanguageMenuMount?.querySelector('[data-booking-content-lang-menu="true"]');
      const trigger = menu?.querySelector('[data-booking-content-lang-trigger="true"]');
      const panel = menu?.querySelector('[data-booking-content-lang-panel="true"]');
      if (!menu?.classList.contains("is-open") || !trigger || !panel) return;
      positionContentLanguageMenu(trigger, panel);
    }, { passive: true });
  }

  function renderContentLanguageMenu() {
    if (!els.contentLanguageMenuMount) return;
    ensureContentLanguageMenuDismissHandlers();
    const activeCode = normalizeBookingContentLang(
      els.contentLanguageSelect?.value
      || state.coreDraft?.customer_language
      || state.booking?.customer_language
      || state.booking?.web_form_submission?.preferred_language
      || state.contentLang
      || bookingContentLang("en")
    );
    const active = bookingContentLanguageOption(activeCode);
    const otherOptions = BOOKING_CONTENT_LANGUAGE_OPTIONS
      .filter((option) => option.code !== active.code)
      .map((option) => {
        const renderedOption = bookingContentLanguageOption(option.code);
        return `
        <button
          type="button"
          class="lang-menu-item"
          data-booking-content-lang-option="${escapeHtml(renderedOption.code)}"
          role="menuitem"
        >
          <span class="lang-flag ${escapeHtml(renderedOption.flagClass)}" aria-hidden="true"></span>
          <span class="lang-menu-code">${escapeHtml(renderedOption.shortLabel)}</span>
          <span class="lang-menu-label">${escapeHtml(renderedOption.label)}</span>
        </button>
      `;
      })
      .join("");

    els.contentLanguageMenuMount.innerHTML = `
      <div class="lang-menu booking-content-language-menu" data-booking-content-lang-menu="true">
        <button
          type="button"
          class="lang-menu-trigger"
          data-booking-content-lang-trigger="true"
          aria-haspopup="menu"
          aria-expanded="false"
          aria-label="${escapeHtml(backendT("booking.content_language", "Customer language"))}"
        >
          <span class="lang-flag ${escapeHtml(active.flagClass)}" aria-hidden="true"></span>
          <span class="lang-menu-code">${escapeHtml(active.shortLabel)}</span>
          <span class="lang-menu-caret" aria-hidden="true"></span>
        </button>
        <div
          class="lang-menu-panel"
          data-booking-content-lang-panel="true"
          role="menu"
          hidden
        >${otherOptions}</div>
      </div>
    `;

    const menu = els.contentLanguageMenuMount.querySelector('[data-booking-content-lang-menu="true"]');
    const trigger = menu?.querySelector('[data-booking-content-lang-trigger="true"]');
    const panel = menu?.querySelector('[data-booking-content-lang-panel="true"]');
    if (!menu || !trigger || !panel) return;

    const openMenu = () => {
      menu.classList.add("is-open");
      panel.hidden = false;
      positionContentLanguageMenu(trigger, panel);
      trigger.setAttribute("aria-expanded", "true");
    };

    trigger.addEventListener("click", () => {
      if (menu.classList.contains("is-open")) closeContentLanguageMenu();
      else openMenu();
    });

    panel.querySelectorAll("[data-booking-content-lang-option]").forEach((item) => {
      item.addEventListener("click", () => {
        const next = normalizeBookingContentLang(item.getAttribute("data-booking-content-lang-option") || active.code);
        closeContentLanguageMenu();
        if (!els.contentLanguageSelect) return;
        els.contentLanguageSelect.value = next;
        els.contentLanguageSelect.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  }

  function syncContentLanguageSelector() {
    if (!els.contentLanguageSelect) return;
    const normalized = normalizeBookingContentLang(
      state.coreDraft?.customer_language
      || state.booking?.customer_language
      || state.booking?.web_form_submission?.preferred_language
      || state.contentLang
      || bookingContentLang("en")
    );
    if (state.coreDraft && typeof state.coreDraft === "object") {
      state.coreDraft.customer_language = normalized;
    }
    els.contentLanguageSelect.value = normalized;
    renderContentLanguageMenu();
  }

  function populateContentLanguageSelect() {
    if (!els.contentLanguageSelect) return;
    els.contentLanguageSelect.innerHTML = BOOKING_CONTENT_LANGUAGE_OPTIONS
      .map((option) => `<option value="${escapeHtml(option.code)}">${escapeHtml(option.label)}</option>`)
      .join("");
    syncContentLanguageSelector();
  }

  async function handleContentLanguageChange() {
    if (!els.contentLanguageSelect) return;
    const previousLang = normalizeBookingContentLang(
      state.coreDraft?.customer_language
      || state.booking?.customer_language
      || state.booking?.web_form_submission?.preferred_language
      || bookingContentLang("en")
    );
    const nextLang = normalizeBookingContentLang(els.contentLanguageSelect.value || previousLang);
    if (nextLang === previousLang || !state.permissions.canEditBooking) {
      syncContentLanguageSelector();
      return;
    }
    if (!state.coreDraft || typeof state.coreDraft !== "object") {
      state.coreDraft = {};
    }
    state.coreDraft.customer_language = nextLang;
    updateCoreDirtyState?.();
    syncContentLanguageSelector();
    setStatus("");
  }

  function closeEditingLanguageMenu() {
    const menu = els.editingLanguageMenuMount?.querySelector('[data-booking-editing-lang-menu="true"]');
    const trigger = menu?.querySelector('[data-booking-editing-lang-trigger="true"]');
    const panel = menu?.querySelector('[data-booking-editing-lang-panel="true"]');
    if (!menu || !trigger || !panel) return;
    menu.classList.remove("is-open");
    panel.hidden = true;
    panel.style.position = "";
    panel.style.left = "";
    panel.style.top = "";
    panel.style.right = "";
    panel.style.width = "";
    panel.style.maxHeight = "";
    panel.style.visibility = "";
    trigger.setAttribute("aria-expanded", "false");
  }

  let editingDismissHandlersBound = false;

  function positionEditingLanguageMenu(trigger, panel) {
    positionContentLanguageMenu(trigger, panel);
  }

  function ensureEditingLanguageMenuDismissHandlers() {
    if (editingDismissHandlersBound) return;
    editingDismissHandlersBound = true;
    document.addEventListener("click", (event) => {
      const menu = els.editingLanguageMenuMount?.querySelector('[data-booking-editing-lang-menu="true"]');
      if (!menu || menu.contains(event.target)) return;
      closeEditingLanguageMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeEditingLanguageMenu();
    });
    window.addEventListener("resize", () => {
      const menu = els.editingLanguageMenuMount?.querySelector('[data-booking-editing-lang-menu="true"]');
      const trigger = menu?.querySelector('[data-booking-editing-lang-trigger="true"]');
      const panel = menu?.querySelector('[data-booking-editing-lang-panel="true"]');
      if (!menu?.classList.contains("is-open") || !trigger || !panel) return;
      positionEditingLanguageMenu(trigger, panel);
    });
    window.addEventListener("scroll", () => {
      const menu = els.editingLanguageMenuMount?.querySelector('[data-booking-editing-lang-menu="true"]');
      const trigger = menu?.querySelector('[data-booking-editing-lang-trigger="true"]');
      const panel = menu?.querySelector('[data-booking-editing-lang-panel="true"]');
      if (!menu?.classList.contains("is-open") || !trigger || !panel) return;
      positionEditingLanguageMenu(trigger, panel);
    }, { passive: true });
  }

  function renderEditingLanguageMenu() {
    if (!els.editingLanguageMenuMount) return;
    ensureEditingLanguageMenuDismissHandlers();
    const activeCode = normalizeBookingEditingLang(
      els.editingLanguageSelect?.value
      || state.coreDraft?.editing_language
      || state.booking?.editing_language
      || bookingEditingLang(currentBackendLang() || "en")
    );
    const active = bookingEditingLanguageOption(activeCode);
    const otherOptions = BOOKING_EDITING_LANGUAGE_OPTIONS
      .filter((option) => option.code !== active.code)
      .map((option) => {
        const renderedOption = bookingEditingLanguageOption(option.code);
        return `
        <button
          type="button"
          class="lang-menu-item"
          data-booking-editing-lang-option="${escapeHtml(renderedOption.code)}"
          role="menuitem"
        >
          <span class="lang-flag ${escapeHtml(renderedOption.flagClass)}" aria-hidden="true"></span>
          <span class="lang-menu-code">${escapeHtml(renderedOption.shortLabel)}</span>
          <span class="lang-menu-label">${escapeHtml(renderedOption.label)}</span>
        </button>
      `;
      })
      .join("");

    els.editingLanguageMenuMount.innerHTML = `
      <div class="lang-menu booking-content-language-menu" data-booking-editing-lang-menu="true">
        <button
          type="button"
          class="lang-menu-trigger"
          data-booking-editing-lang-trigger="true"
          aria-haspopup="menu"
          aria-expanded="false"
          aria-label="${escapeHtml(backendT("booking.editing_language", "Editing language"))}"
        >
          <span class="lang-flag ${escapeHtml(active.flagClass)}" aria-hidden="true"></span>
          <span class="lang-menu-code">${escapeHtml(active.shortLabel)}</span>
          <span class="lang-menu-caret" aria-hidden="true"></span>
        </button>
        <div
          class="lang-menu-panel"
          data-booking-editing-lang-panel="true"
          role="menu"
          hidden
        >${otherOptions}</div>
      </div>
    `;

    const menu = els.editingLanguageMenuMount.querySelector('[data-booking-editing-lang-menu="true"]');
    const trigger = menu?.querySelector('[data-booking-editing-lang-trigger="true"]');
    const panel = menu?.querySelector('[data-booking-editing-lang-panel="true"]');
    if (!menu || !trigger || !panel) return;

    const openMenu = () => {
      menu.classList.add("is-open");
      panel.hidden = false;
      positionEditingLanguageMenu(trigger, panel);
      trigger.setAttribute("aria-expanded", "true");
    };

    trigger.addEventListener("click", () => {
      if (menu.classList.contains("is-open")) closeEditingLanguageMenu();
      else openMenu();
    });

    panel.querySelectorAll("[data-booking-editing-lang-option]").forEach((item) => {
      item.addEventListener("click", () => {
        const next = normalizeBookingEditingLang(item.getAttribute("data-booking-editing-lang-option") || active.code);
        closeEditingLanguageMenu();
        if (!els.editingLanguageSelect) return;
        els.editingLanguageSelect.value = next;
        els.editingLanguageSelect.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  }

  function syncEditingLanguageSelector() {
    if (!els.editingLanguageSelect) return;
    const normalized = normalizeBookingEditingLang(
      state.coreDraft?.editing_language
      || state.booking?.editing_language
      || readStoredBookingEditingLanguage(state.booking?.id || state.id, "")
      || currentBackendLang()
      || bookingEditingLang("en")
    );
    if (state.coreDraft && typeof state.coreDraft === "object") {
      state.coreDraft.editing_language = normalized;
    }
    setBookingEditingLang(normalized);
    els.editingLanguageSelect.value = normalized;
    renderEditingLanguageMenu();
  }

  function populateEditingLanguageSelect() {
    if (!els.editingLanguageSelect) return;
    els.editingLanguageSelect.innerHTML = BOOKING_EDITING_LANGUAGE_OPTIONS
      .map((option) => `<option value="${escapeHtml(option.code)}">${escapeHtml(option.label)}</option>`)
      .join("");
    syncEditingLanguageSelector();
  }

  async function handleEditingLanguageChange() {
    if (!els.editingLanguageSelect) return;
    const previousLang = normalizeBookingEditingLang(
      state.coreDraft?.editing_language
      || state.booking?.editing_language
      || readStoredBookingEditingLanguage(state.booking?.id || state.id, "")
      || currentBackendLang()
      || bookingEditingLang("en")
    );
    const nextLang = normalizeBookingEditingLang(els.editingLanguageSelect.value || previousLang);
    setBookingEditingLang(nextLang);
    if (nextLang === previousLang || !state.permissions.canEditBooking) {
      syncEditingLanguageSelector();
      return;
    }
    if (!state.coreDraft || typeof state.coreDraft !== "object") {
      state.coreDraft = {};
    }
    state.coreDraft.editing_language = nextLang;
    updateCoreDirtyState?.();
    syncEditingLanguageSelector();
    setStatus("");
  }

  return {
    handleContentLanguageChange,
    handleEditingLanguageChange,
    populateContentLanguageSelect,
    populateEditingLanguageSelect,
    resolveSubmissionCustomerLanguage,
    resolveSubmissionEditingLanguage,
    syncContentLanguageSelector,
    syncEditingLanguageSelector,
    updateContentLangInUrl,
    waitForBackendI18n,
    withBackendLang,
    withBookingContentLang
  };
}
