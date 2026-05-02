import { fetchAuthMe, readCachedAuthMe, wireAuthLogoutLink } from "./auth.js";

const TRANSLATIONS_ICON_READY = "assets/img/translation.png";
const TRANSLATIONS_ICON_MISSING = "assets/img/translation.missing.png";

function buildIconMarkup(icon) {
  if (icon?.type === "image") {
    const sizeClass = icon.size === "large" ? " backend-section-nav__icon-image--large" : "";
    return `<img class="backend-section-nav__icon-image${sizeClass}" src="${icon.src}" alt="" />`;
  }
  return String(icon || "");
}

function buildSectionButton(section, title, icon) {
  return `
    <button type="button" class="backend-section-nav__item" data-backend-section="${section}" title="${title}" aria-label="${title}">
      <span class="backend-section-nav__icon" aria-hidden="true">${buildIconMarkup(icon)}</span>
    </button>
  `;
}

function backendT(id, fallback, vars) {
  if (typeof window.backendT === "function") {
    return window.backendT(id, fallback, vars);
  }
  if (!vars || typeof vars !== "object") return String(fallback ?? id);
  return String(fallback ?? id).replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

function currentLang() {
  return typeof window.backendI18n?.getLang === "function" ? window.backendI18n.getLang() : "";
}

function withLang(urlValue) {
  const lang = currentLang();
  if (!lang) return urlValue;
  const url = new URL(urlValue, window.location.origin);
  url.searchParams.set("lang", lang);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function resolveBackendSectionHref(section) {
  const normalizedSection = String(section || "bookings").trim() || "bookings";
  const pathname =
    normalizedSection === "tours"
      ? "marketing_tours.html"
      : normalizedSection === "settings"
        ? "settings.html"
      : normalizedSection === "translations"
        ? "translations.html"
      : normalizedSection === "emergency"
        ? "settings.html"
        : "bookings.html";
  const url = new URL(pathname, window.location.origin);
  const lang = currentLang();
  if (lang) url.searchParams.set("lang", lang);
  return `${url.pathname}${url.search}`;
}

function hasAnyRole(roles, ...expected) {
  return expected.some((role) => roles.includes(role));
}

function resolveUserLabel(authUser = null) {
  return String(authUser?.preferred_username || authUser?.email || authUser?.sub || "").trim();
}

function applyNavPermissions(mount, roles) {
  const resolvedRoles = Array.isArray(roles) ? roles : [];
  const canReadBookings = hasAnyRole(resolvedRoles, "atp_admin", "atp_manager", "atp_accountant", "atp_staff");
  const canReadTours = hasAnyRole(resolvedRoles, "atp_admin", "atp_accountant", "atp_tour_editor");
  const canReadSettings = hasAnyRole(resolvedRoles, "atp_admin");
  const canReadTranslations = hasAnyRole(resolvedRoles, "atp_admin");
  mount
    .querySelectorAll(".backend-section-nav__item[data-backend-section]")
    .forEach((button) => {
      const section = button.getAttribute("data-backend-section");
      const visible =
        (section === "bookings" && canReadBookings) ||
        (section === "tours" && canReadTours) ||
        (section === "translations" && canReadTranslations) ||
        (section === "settings" && canReadSettings);
      button.hidden = !visible;
      button.classList.toggle("is-hidden", !visible);
    });
}

function translationsButton(mount) {
  return mount?.querySelector?.('.backend-section-nav__item[data-backend-section="translations"]') || null;
}

function setTranslationsIconState(mount, isDirty) {
  const button = translationsButton(mount);
  const image = button?.querySelector?.(".backend-section-nav__icon-image");
  if (!(button instanceof HTMLElement) || !(image instanceof HTMLImageElement)) return;
  const dirty = Boolean(isDirty);
  image.src = dirty ? TRANSLATIONS_ICON_MISSING : TRANSLATIONS_ICON_READY;
  button.classList.toggle("has-translation-issues", dirty);
  const label = dirty
    ? backendT("nav.translations_dirty", "Translations need attention")
    : backendT("nav.translations", "Translations");
  button.title = label;
  button.setAttribute("aria-label", label);
}

async function refreshTranslationsIconState(mount, apiBase) {
  const button = translationsButton(mount);
  if (!(button instanceof HTMLElement) || button.hidden) return;
  const requestId = (mount.__backendTranslationStatusRequestId || 0) + 1;
  mount.__backendTranslationStatusRequestId = requestId;
  try {
    const base = String(apiBase || "").replace(/\/$/, "");
    const response = await fetch(`${base}/api/v1/static-translations/status`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok || mount.__backendTranslationStatusRequestId !== requestId) return;
    const payload = await response.json().catch(() => null);
    setTranslationsIconState(mount, Boolean(payload?.dirty || Number(payload?.dirty_count || 0) > 0));
  } catch {
    // Keep the default icon if the optional status probe is unavailable.
  }
}

function bindTranslationsStatusRefresh(mount, apiBase) {
  if (typeof mount.__backendTranslationStatusHandler === "function") {
    window.removeEventListener("backend-translations-status-refresh", mount.__backendTranslationStatusHandler);
  }
  mount.__backendTranslationStatusHandler = (event) => {
    const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
    if (Object.prototype.hasOwnProperty.call(detail, "dirty")) {
      setTranslationsIconState(mount, Boolean(detail.dirty));
    }
    if (detail.refresh === false) return;
    void refreshTranslationsIconState(mount, apiBase);
  };
  window.addEventListener("backend-translations-status-refresh", mount.__backendTranslationStatusHandler);
}

export function mountBackendNav(mount, options = {}) {
  if (!mount) return;
  const currentSection = options.currentSection || "";
  const apiBase = String(window.ASIATRAVELPLAN_API_BASE || "").replace(/\/$/, "");
  const websiteHref = withLang("index.html");
  const logoutHref = withLang("index.html");

  mount.innerHTML = `
    <nav class="nav backend-main-nav" aria-label="Backend navigation">
      <div class="backend-nav__logout">
        <a class="backend-nav__logout-link" id="backendLogoutLink" href="#">
          <span class="backend-nav__logout-title">${backendT("nav.logout", "Logout")}</span>
          <span class="backend-nav__user" id="backendUserLabel"></span>
        </a>
      </div>

      <div class="backend-section-nav-wrap">
        <div class="backend-section-nav" role="tablist" aria-label="${backendT("a11y.backend_sections", "Backend sections")}">
          ${buildSectionButton("bookings", backendT("nav.bookings", "Bookings"), { type: "image", src: "assets/img/profile_booking.png", size: "large" })}
          ${buildSectionButton("settings", backendT("nav.settings", "Reports and Settings"), { type: "image", src: "assets/img/profile_person.png", size: "large" })}
          ${buildSectionButton("translations", backendT("nav.translations", "Translations"), { type: "image", src: TRANSLATIONS_ICON_READY, size: "large" })}
          ${buildSectionButton("tours", "Marketing Tour", { type: "image", src: "assets/img/marketing_tours.png", size: "large" })}
        </div>
      </div>

      <div class="backend-nav__meta">
        <ul class="nav-list">
          <li class="backend-nav__website"><a href="${websiteHref}">${backendT("nav.website", "Website")}</a></li>
          <li id="backendLangMenuMount"></li>
        </ul>
      </div>
    </nav>
  `;

  window.dispatchEvent(new CustomEvent("backend-nav-mounted"));

  wireAuthLogoutLink(mount.querySelector("#backendLogoutLink"), {
    apiBase,
    returnTo: `${window.location.origin}${logoutHref}`
  });

  const cachedAuth = readCachedAuthMe();
  const cachedRoles = Array.isArray(cachedAuth?.user?.roles) ? cachedAuth.user.roles : [];
  applyNavPermissions(mount, cachedRoles);
  bindTranslationsStatusRefresh(mount, apiBase);
  void refreshTranslationsIconState(mount, apiBase);
  const cachedUserLabel = resolveUserLabel(cachedAuth?.user);
  const userLabelEl = mount.querySelector("#backendUserLabel");
  if (userLabelEl) {
    userLabelEl.textContent = cachedUserLabel;
  }

  if (currentSection) {
    const activeButton = mount.querySelector(`.backend-section-nav__item[data-backend-section="${currentSection}"]`);
    if (activeButton) {
      activeButton.classList.add("is-active");
      activeButton.setAttribute("aria-current", "page");
    }
  }

  mount.querySelectorAll(".backend-section-nav__item[data-backend-section]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.hidden) return;
      const section = button.getAttribute("data-backend-section");
      if (!section) return;
      window.location.href = resolveBackendSectionHref(section);
    });
  });

  fetchAuthMe(apiBase)
    .then(({ payload }) => {
      const roles = Array.isArray(payload?.user?.roles) ? payload.user.roles : [];
      applyNavPermissions(mount, roles);
      void refreshTranslationsIconState(mount, apiBase);
      const liveUserLabel = resolveUserLabel(payload?.user);
      const labelElement = mount.querySelector("#backendUserLabel");
      if (labelElement) {
        labelElement.textContent = liveUserLabel;
      }
    })
    .catch(() => {
      applyNavPermissions(mount, cachedRoles);
    });

  if (typeof mount.__backendNavLanguageHandler === "function") {
    window.removeEventListener("backend-i18n-changed", mount.__backendNavLanguageHandler);
  }
  mount.__backendNavLanguageHandler = () => {
    mountBackendNav(mount, options);
  };
  window.addEventListener("backend-i18n-changed", mount.__backendNavLanguageHandler);
}
