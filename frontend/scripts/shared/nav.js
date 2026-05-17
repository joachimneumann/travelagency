import { readCachedAuthMe, wireAuthLogoutLink } from "./auth.js";

const TRANSLATIONS_ICON_READY = "assets/img/translation.png";
const NAV_STATUS_REFRESH_DELAY_MS = 400;
const NAV_DEPLOYMENT_STATUS_STAGGER_MS = 650;
const NAV_STATUS_READY_FALLBACK_MS = 12_000;

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

function runWhenIdle(callback) {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(callback, { timeout: 2000 });
    return;
  }
  window.setTimeout(callback, 0);
}

function clearBackendStatusReadyWait(mount) {
  if (!mount) return;
  if (typeof mount.__backendStatusReadyHandler === "function") {
    window.removeEventListener("backend-page-ready", mount.__backendStatusReadyHandler);
    mount.__backendStatusReadyHandler = null;
  }
  if (mount.__backendStatusReadyFallbackTimer) {
    window.clearTimeout(mount.__backendStatusReadyFallbackTimer);
    mount.__backendStatusReadyFallbackTimer = null;
  }
}

function scheduleBackendStatusRefresh(mount, apiBase, options = {}) {
  if (!mount) return;
  if (mount.__backendStatusRefreshTimer) {
    window.clearTimeout(mount.__backendStatusRefreshTimer);
  }
  const force = options.force === true;
  const delayMs = Number.isFinite(Number(options.delayMs)) ? Number(options.delayMs) : NAV_STATUS_REFRESH_DELAY_MS;
  mount.__backendStatusRefreshTimer = window.setTimeout(() => {
    mount.__backendStatusRefreshTimer = null;
    if (!document.body?.contains(mount)) return;
    runWhenIdle(() => {
      void refreshTranslationsIconState(mount, apiBase, { force });
      window.setTimeout(() => {
        void refreshPublicSiteDeploymentState(mount, apiBase);
      }, NAV_DEPLOYMENT_STATUS_STAGGER_MS);
    });
  }, Math.max(0, delayMs));
}

function scheduleBackendStatusRefreshWhenReady(mount, apiBase, options = {}) {
  if (!mount) return;
  clearBackendStatusReadyWait(mount);
  const run = () => {
    clearBackendStatusReadyWait(mount);
    scheduleBackendStatusRefresh(mount, apiBase, options);
  };
  if (document.body?.classList.contains("backend-page-loading--busy")) {
    mount.__backendStatusReadyHandler = run;
    window.addEventListener("backend-page-ready", run, { once: true });
    mount.__backendStatusReadyFallbackTimer = window.setTimeout(run, NAV_STATUS_READY_FALLBACK_MS);
    return;
  }
  scheduleBackendStatusRefresh(mount, apiBase, options);
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
      : normalizedSection === "tour_variants"
        ? "tour_variants.html"
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
  const canReadTourVariants = hasAnyRole(resolvedRoles, "atp_tour_editor");
  const canReadSettings = hasAnyRole(resolvedRoles, "atp_admin");
  const canReadTranslations = hasAnyRole(resolvedRoles, "atp_admin");
  const canViewPublicSiteDeployment = hasAnyRole(resolvedRoles, "atp_admin", "atp_tour_editor");
  mount
    .querySelectorAll(".backend-section-nav__item[data-backend-section]")
    .forEach((button) => {
      const section = button.getAttribute("data-backend-section");
      const visible =
        (section === "bookings" && canReadBookings) ||
        (section === "tours" && canReadTours) ||
        (section === "tour_variants" && canReadTourVariants) ||
        (section === "translations" && canReadTranslations) ||
        (section === "settings" && canReadSettings);
      button.hidden = !visible;
      button.classList.toggle("is-hidden", !visible);
    });
  const deploymentLight = publicSiteDeploymentLight(mount);
  if (deploymentLight instanceof HTMLElement) {
    deploymentLight.hidden = !canViewPublicSiteDeployment;
    deploymentLight.classList.toggle("is-hidden", !canViewPublicSiteDeployment);
  }
}

function applyBackendAuthPayloadToNav(mount, apiBase, payload) {
  const roles = Array.isArray(payload?.user?.roles) ? payload.user.roles : [];
  applyNavPermissions(mount, roles);
  scheduleBackendStatusRefreshWhenReady(mount, apiBase);
  const liveUserLabel = resolveUserLabel(payload?.user);
  const labelElement = mount?.querySelector?.("#backendUserLabel");
  if (labelElement) {
    labelElement.textContent = liveUserLabel;
  }
}

function translationsButton(mount) {
  return mount?.querySelector?.('.backend-section-nav__item[data-backend-section="translations"]') || null;
}

function setTranslationsIconState(mount) {
  const button = translationsButton(mount);
  const image = button?.querySelector?.(".backend-section-nav__icon-image");
  if (!(button instanceof HTMLElement) || !(image instanceof HTMLImageElement)) return;
  image.src = TRANSLATIONS_ICON_READY;
  button.classList.remove("has-translation-issues");
  const label = backendT("nav.translations", "Translations");
  button.title = label;
  button.setAttribute("aria-label", label);
}

function refreshTranslationsIconState(mount) {
  const button = translationsButton(mount);
  if (!(button instanceof HTMLElement) || button.hidden) return;
  setTranslationsIconState(mount);
}

function bindTranslationsStatusRefresh(mount) {
  if (typeof mount.__backendTranslationStatusHandler === "function") {
    window.removeEventListener("backend-translations-status-refresh", mount.__backendTranslationStatusHandler);
  }
  mount.__backendTranslationStatusHandler = (event) => {
    const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
    setTranslationsIconState(mount);
    if (detail.refresh === false) return;
    void refreshTranslationsIconState(mount);
  };
  window.addEventListener("backend-translations-status-refresh", mount.__backendTranslationStatusHandler);
}

function publicSiteDeploymentLight(mount) {
  return mount?.querySelector?.("#backendPublicSiteDeploymentLight") || null;
}

function publicSiteDeploymentTitle(status = null, error = "") {
  const message = String(error || status?.error || "").trim();
  if (message) return message;
  if (status?.clean === true) return backendT("nav.public_site_deployment_clean", "Website content matches the latest deployment.");
  if (status?.status === "missing_manifest") {
    return backendT("nav.public_site_deployment_missing", "Website content has not been deployed yet.");
  }
  if (status?.dirty === true) {
    return backendT("nav.public_site_deployment_dirty", "Website content changed since the latest deployment.");
  }
  return backendT("nav.public_site_deployment_unknown", "Website deployment status is unknown.");
}

function setPublicSiteDeploymentState(mount, status = null, options = {}) {
  const light = publicSiteDeploymentLight(mount);
  if (!(light instanceof HTMLElement) || light.hidden) return;
  const errorMessage = String(options.error || "").trim();
  const clean = status?.clean === true && !errorMessage;
  const dirty = !clean && (status?.dirty === true || status?.loaded === true);
  const checking = options.checking === true;
  const error = Boolean(errorMessage || status?.status === "error");
  light.classList.toggle("is-clean", clean);
  light.classList.toggle("is-dirty", dirty);
  light.classList.toggle("is-checking", checking);
  light.classList.toggle("is-error", error);
  light.title = publicSiteDeploymentTitle(status, errorMessage);
  light.setAttribute("aria-label", light.title);
}

async function refreshPublicSiteDeploymentState(mount, apiBase) {
  const light = publicSiteDeploymentLight(mount);
  if (!(light instanceof HTMLElement) || light.hidden) return null;
  setPublicSiteDeploymentState(mount, null, { checking: true });
  try {
    const base = String(apiBase || "").replace(/\/$/, "");
    const response = await fetch(`${base}/api/v1/public-site/deployment-status`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) {
      setPublicSiteDeploymentState(mount, null, {
        error: backendT("nav.public_site_deployment_unknown", "Website deployment status is unknown.")
      });
      return null;
    }
    const payload = await response.json().catch(() => null);
    setPublicSiteDeploymentState(mount, payload || null);
    return payload;
  } catch {
    setPublicSiteDeploymentState(mount, null, {
      error: backendT("nav.public_site_deployment_unknown", "Website deployment status is unknown.")
    });
    return null;
  }
}

function bindPublicSiteDeploymentRefresh(mount, apiBase) {
  if (typeof mount.__backendPublicSiteDeploymentRefreshHandler === "function") {
    window.removeEventListener("backend-public-site-deployment-refresh", mount.__backendPublicSiteDeploymentRefreshHandler);
  }
  mount.__backendPublicSiteDeploymentRefreshHandler = () => {
    void refreshPublicSiteDeploymentState(mount, apiBase);
  };
  window.addEventListener("backend-public-site-deployment-refresh", mount.__backendPublicSiteDeploymentRefreshHandler);
}

function resolveBackendViewportHeight() {
  return Number(window.visualViewport?.height || window.innerHeight || document.documentElement?.clientHeight || 0);
}

function syncBackendViewportMetrics(mount) {
  const header = mount?.closest?.(".header") || document.querySelector(".header");
  const headerHeight = Math.max(0, Math.ceil(Number(header?.getBoundingClientRect?.().height || 74)));
  const availableHeight = Math.max(0, resolveBackendViewportHeight() - headerHeight);
  const rootStyle = document.documentElement?.style;
  if (!rootStyle) return;
  rootStyle.setProperty("--backend-menu-height", `${headerHeight}px`);
  rootStyle.setProperty("--backend-available-height", `${availableHeight}px`);
  rootStyle.setProperty("--tour-customize-modal-top", `${headerHeight}px`);
}

function bindBackendViewportMetrics(mount) {
  if (typeof mount.__backendViewportMetricsCleanup === "function") {
    mount.__backendViewportMetricsCleanup();
    mount.__backendViewportMetricsCleanup = null;
  }
  let frameId = 0;
  const requestFrame =
    typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame.bind(window)
      : (callback) => window.setTimeout(callback, 0);
  const cancelFrame =
    typeof window.cancelAnimationFrame === "function"
      ? window.cancelAnimationFrame.bind(window)
      : (id) => window.clearTimeout(id);
  const sync = () => {
    if (frameId) return;
    frameId = requestFrame(() => {
      frameId = 0;
      syncBackendViewportMetrics(mount);
    });
  };
  const header = mount.closest?.(".header") || document.querySelector(".header");
  const observer =
    typeof window.ResizeObserver === "function" && header
      ? new window.ResizeObserver(sync)
      : null;
  if (observer && header) observer.observe(header);
  window.addEventListener("resize", sync);
  window.visualViewport?.addEventListener?.("resize", sync);
  mount.__backendViewportMetricsCleanup = () => {
    if (frameId) {
      cancelFrame(frameId);
      frameId = 0;
    }
    observer?.disconnect?.();
    window.removeEventListener("resize", sync);
    window.visualViewport?.removeEventListener?.("resize", sync);
  };
  sync();
}

export function mountBackendNav(mount, options = {}) {
  if (!mount) return;
  if (mount.__backendStatusRefreshTimer) {
    window.clearTimeout(mount.__backendStatusRefreshTimer);
    mount.__backendStatusRefreshTimer = null;
  }
  clearBackendStatusReadyWait(mount);
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
          ${buildSectionButton("tours", backendT("nav.tours", "Tours"), { type: "image", src: "assets/img/marketing_tours.png", size: "large" })}
          ${buildSectionButton("tour_variants", backendT("nav.tour_variants", "Tour Variants"), { type: "image", src: "assets/img/marketing_tour_variants.png", size: "large" })}
        </div>
      </div>

      <div class="backend-nav__meta">
        <span class="backend-nav__deployment-light is-checking" id="backendPublicSiteDeploymentLight" role="status" hidden title="${backendT("nav.public_site_deployment_unknown", "Website deployment status is unknown.")}" aria-label="${backendT("nav.public_site_deployment_unknown", "Website deployment status is unknown.")}"></span>
        <ul class="nav-list">
          <li class="backend-nav__website"><a href="${websiteHref}">${backendT("nav.website", "Website")}</a></li>
          <li id="backendLangMenuMount"></li>
        </ul>
      </div>
    </nav>
  `;

  bindBackendViewportMetrics(mount);
  window.dispatchEvent(new CustomEvent("backend-nav-mounted"));

  wireAuthLogoutLink(mount.querySelector("#backendLogoutLink"), {
    apiBase,
    returnTo: `${window.location.origin}${logoutHref}`
  });

  const cachedAuth = readCachedAuthMe();
  const cachedRoles = Array.isArray(cachedAuth?.user?.roles) ? cachedAuth.user.roles : [];
  applyNavPermissions(mount, cachedRoles);
  bindTranslationsStatusRefresh(mount);
  bindPublicSiteDeploymentRefresh(mount, apiBase);
  scheduleBackendStatusRefreshWhenReady(mount, apiBase);
  const cachedUserLabel = resolveUserLabel(cachedAuth?.user);
  const userLabelEl = mount.querySelector("#backendUserLabel");
  if (userLabelEl) {
    userLabelEl.textContent = cachedUserLabel;
  }

  if (typeof mount.__backendAuthReadyHandler === "function") {
    window.removeEventListener("backend-auth-ready", mount.__backendAuthReadyHandler);
  }
  mount.__backendAuthReadyHandler = (event) => {
    const payload = event?.detail?.payload || null;
    applyBackendAuthPayloadToNav(mount, apiBase, payload);
  };
  window.addEventListener("backend-auth-ready", mount.__backendAuthReadyHandler);

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

  if (typeof mount.__backendNavLanguageHandler === "function") {
    window.removeEventListener("backend-i18n-changed", mount.__backendNavLanguageHandler);
  }
  mount.__backendNavLanguageHandler = () => {
    mountBackendNav(mount, options);
  };
  window.addEventListener("backend-i18n-changed", mount.__backendNavLanguageHandler);
}
