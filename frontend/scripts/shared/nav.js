import { readCachedAuthMe, wireAuthLogoutLink } from "./auth.js";

const TRANSLATIONS_ICON_READY = "assets/img/translation.png";
const PUBLIC_SITE_PUBLISH_POLL_MS = 1800;
const NAV_STATUS_CACHE_TTL_MS = 60_000;
const NAV_STATUS_REFRESH_DELAY_MS = 400;
const NAV_PUBLIC_STATUS_STAGGER_MS = 650;
const NAV_STATUS_READY_FALLBACK_MS = 12_000;
const navStatusCache = new Map();

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

function navStatusCacheKey(kind, url) {
  return `${String(kind || "status")}:${String(url || "")}`;
}

async function fetchNavStatusJson(kind, url, { force = false } = {}) {
  const key = navStatusCacheKey(kind, url);
  const existing = navStatusCache.get(key);
  const now = Date.now();
  if (!force && existing?.payload && now - Number(existing.cachedAt || 0) <= NAV_STATUS_CACHE_TTL_MS) {
    return existing.payload;
  }
  if (!force && existing?.promise) {
    return existing.promise;
  }

  const promise = fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store"
  })
    .then(async (response) => {
      if (!response.ok) return null;
      const payload = await readJsonResponse(response);
      navStatusCache.set(key, {
        payload,
        cachedAt: Date.now()
      });
      return payload;
    })
    .catch(() => null)
    .finally(() => {
      const latest = navStatusCache.get(key);
      if (latest?.promise === promise) {
        if (latest.payload) {
          delete latest.promise;
        } else {
          navStatusCache.delete(key);
        }
      }
    });

  navStatusCache.set(key, {
    ...(existing || {}),
    promise
  });
  return promise;
}

function clearNavStatusCache(kind = "") {
  const normalizedKind = String(kind || "").trim();
  if (!normalizedKind) {
    navStatusCache.clear();
    return;
  }
  for (const key of Array.from(navStatusCache.keys())) {
    if (key.startsWith(`${normalizedKind}:`)) navStatusCache.delete(key);
  }
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
        void refreshPublicSitePublishState(mount, apiBase, { force });
      }, NAV_PUBLIC_STATUS_STAGGER_MS);
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
  const canPublishPublicSite = hasAnyRole(resolvedRoles, "atp_admin", "atp_tour_editor");
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
  const publishButton = publicSitePublishButton(mount);
  if (publishButton instanceof HTMLButtonElement) {
    publishButton.hidden = !canPublishPublicSite;
    publishButton.classList.toggle("is-hidden", !canPublishPublicSite);
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

function bindTranslationsStatusRefresh(mount, apiBase) {
  if (typeof mount.__backendTranslationStatusHandler === "function") {
    window.removeEventListener("backend-translations-status-refresh", mount.__backendTranslationStatusHandler);
  }
  mount.__backendTranslationStatusHandler = (event) => {
    const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
    setTranslationsIconState(mount);
    if (detail.refresh === false) return;
    clearNavStatusCache("translations");
    void refreshTranslationsIconState(mount, apiBase, { force: true });
  };
  window.addEventListener("backend-translations-status-refresh", mount.__backendTranslationStatusHandler);
}

function publicSitePublishButton(mount) {
  return mount?.querySelector?.("#backendPublicSitePublishBtn") || null;
}

function ensurePublicSitePublishOverlay() {
  let overlay = document.getElementById("backendPublicSitePublishOverlay");
  if (!(overlay instanceof HTMLElement)) {
    overlay = document.createElement("div");
    overlay.className = "booking-page-overlay backend-public-site-publish-overlay";
    overlay.id = "backendPublicSitePublishOverlay";
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="booking-page-overlay__panel" role="status" aria-live="assertive">
        <span class="booking-page-overlay__spinner" aria-hidden="true"></span>
        <span class="booking-page-overlay__text" id="backendPublicSitePublishOverlayText"></span>
      </div>
    `;
    document.body?.append(overlay);
  }
  return overlay;
}

function isPublicSitePublishOverlayVisible() {
  const overlay = document.getElementById("backendPublicSitePublishOverlay");
  return overlay instanceof HTMLElement && !overlay.hidden;
}

function setPublicSitePublishOverlay(mount, visible, message = "") {
  const overlay = ensurePublicSitePublishOverlay();
  if (!(overlay instanceof HTMLElement)) return;
  const overlayText = overlay.querySelector("#backendPublicSitePublishOverlayText");
  const text = String(message || backendT("nav.public_site_publish_overlay", "Publishing website. Please wait.")).trim();
  if (overlayText instanceof HTMLElement) overlayText.textContent = text;
  document.body?.classList.toggle("backend-public-site-publish--busy", Boolean(visible));
  if (visible && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  overlay.hidden = !visible;
  overlay.setAttribute("aria-hidden", visible ? "false" : "true");
  if (mount) mount.__backendPublicSitePublishOverlayVisible = Boolean(visible);
}

function normalizePublishError(error) {
  return String(error?.message || error || "").trim();
}

function publicSitePublishStatusMessage(status) {
  const reason = Array.isArray(status?.block_reasons) ? status.block_reasons.find(Boolean) : null;
  if (reason?.message) return reason.message;
  if (status?.blocked) return backendT("nav.public_site_publish_blocked_title", "Translate missing or stale website strings before publishing.");
  if (status?.dirty) return backendT("nav.public_site_publish_dirty_title", "Publish saved website changes.");
  return backendT("nav.public_site_publish_clean_title", "Website is up to date.");
}

function setPublicSitePublishState(mount, status = {}, options = {}) {
  const button = publicSitePublishButton(mount);
  if (!(button instanceof HTMLButtonElement)) return;
  const running = Boolean(options.running || status?.running_job?.status === "running");
  const errorMessage = normalizePublishError(options.error);
  const dirty = Boolean(options.dirty || mount?.__backendPublicSitePublishLocalDirty || status?.dirty || status?.source_dirty);
  const blocked = Boolean(status?.blocked);
  const ready = dirty && !blocked && !running;
  const clean = !dirty && !blocked && !running;

  button.classList.toggle("is-dirty", ready);
  button.classList.toggle("is-blocked", blocked && !running);
  button.classList.toggle("is-clean", clean);
  button.classList.toggle("is-error", Boolean(errorMessage));
  button.disabled = !ready;

  if (running) {
    button.disabled = true;
    button.textContent = backendT("nav.public_site_publish_publishing", "Publishing...");
    button.title = backendT("nav.public_site_publish_publishing_title", "Publishing static website content.");
    button.setAttribute("aria-busy", "true");
    return;
  }

  button.removeAttribute("aria-busy");
  if (errorMessage) {
    button.textContent = backendT("nav.public_site_publish_retry", "Retry Publish");
    button.title = errorMessage;
    button.disabled = blocked;
    return;
  }
  if (blocked) {
    button.textContent = backendT("nav.public_site_publish_blocked", "Translate First");
    button.title = publicSitePublishStatusMessage(status);
    return;
  }
  if (dirty) {
    button.textContent = backendT("nav.public_site_publish", "Publish Website");
    button.title = publicSitePublishStatusMessage(status);
    return;
  }
  button.textContent = backendT("nav.public_site_publish_clean", "Published");
  button.title = publicSitePublishStatusMessage(status);
}

async function readJsonResponse(response) {
  return response.json().catch(() => null);
}

async function refreshPublicSitePublishState(mount, apiBase, options = {}) {
  const button = publicSitePublishButton(mount);
  if (!(button instanceof HTMLButtonElement) || button.hidden) return null;
  const requestId = (mount.__backendPublicSitePublishStatusRequestId || 0) + 1;
  mount.__backendPublicSitePublishStatusRequestId = requestId;
  try {
    const base = String(apiBase || "").replace(/\/$/, "");
    const payload = await fetchNavStatusJson(
      "public-site",
      `${base}/api/v1/public-site/publish-status`,
      { force: options.force === true }
    );
    if (!payload || mount.__backendPublicSitePublishStatusRequestId !== requestId) return null;
    if (mount.__backendPublicSitePublishStatusRequestId !== requestId) return null;
    setPublicSitePublishState(mount, payload || {});
    mount.__backendPublicSitePublishLastStatus = payload || null;
    const runningJobId = String(payload?.running_job?.id || "").trim();
    if (runningJobId) {
      mount.__backendPublicSitePublishLocalRunning = true;
      setPublicSitePublishOverlay(mount, true);
      schedulePublicSitePublishJobPoll(mount, apiBase, runningJobId);
    } else if (isPublicSitePublishOverlayVisible() && !mount.__backendPublicSitePublishLocalRunning) {
      setPublicSitePublishOverlay(mount, false);
    }
    return payload;
  } catch {
    return null;
  }
}

function schedulePublicSitePublishJobPoll(mount, apiBase, jobId) {
  if (mount.__backendPublicSitePublishPollTimer) {
    window.clearTimeout(mount.__backendPublicSitePublishPollTimer);
  }
  mount.__backendPublicSitePublishPollTimer = window.setTimeout(() => {
    void pollPublicSitePublishJob(mount, apiBase, jobId);
  }, PUBLIC_SITE_PUBLISH_POLL_MS);
}

async function pollPublicSitePublishJob(mount, apiBase, jobId) {
  const normalizedJobId = String(jobId || "").trim();
  if (!normalizedJobId) return;
  const pollId = (mount.__backendPublicSitePublishJobPollId || 0) + 1;
  mount.__backendPublicSitePublishJobPollId = pollId;
  const base = String(apiBase || "").replace(/\/$/, "");
  try {
    const response = await fetch(`${base}/api/v1/public-site/publish/${encodeURIComponent(normalizedJobId)}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    if (mount.__backendPublicSitePublishJobPollId !== pollId) return;
    if (!response.ok) throw new Error(backendT("nav.public_site_publish_failed", "Publish failed."));
    const payload = await readJsonResponse(response);
    const job = payload?.job;
    if (job?.status === "running") {
      mount.__backendPublicSitePublishLocalRunning = true;
      setPublicSitePublishState(mount, { dirty: true }, { running: true });
      setPublicSitePublishOverlay(mount, true);
      schedulePublicSitePublishJobPoll(mount, apiBase, normalizedJobId);
      return;
    }
    if (job?.status === "failed") {
      clearNavStatusCache("public-site");
      const status = await refreshPublicSitePublishState(mount, apiBase, { force: true });
      setPublicSitePublishState(mount, status || { dirty: true }, { error: job.error || backendT("nav.public_site_publish_failed", "Publish failed.") });
      mount.__backendPublicSitePublishLocalRunning = false;
      setPublicSitePublishOverlay(mount, false);
      return;
    }
    mount.__backendPublicSitePublishLocalDirty = false;
    clearNavStatusCache("public-site");
    await refreshPublicSitePublishState(mount, apiBase, { force: true });
    mount.__backendPublicSitePublishLocalRunning = false;
    setPublicSitePublishOverlay(mount, false);
  } catch {
    setPublicSitePublishState(mount, { dirty: true }, { error: backendT("nav.public_site_publish_failed", "Publish failed.") });
    mount.__backendPublicSitePublishLocalRunning = false;
    setPublicSitePublishOverlay(mount, false);
  }
}

async function startPublicSitePublish(mount, apiBase) {
  const button = publicSitePublishButton(mount);
  if (!(button instanceof HTMLButtonElement) || button.disabled || button.hidden) return;
  mount.__backendPublicSitePublishLocalRunning = true;
  mount.__backendPublicSitePublishStatusRequestId = (mount.__backendPublicSitePublishStatusRequestId || 0) + 1;
  setPublicSitePublishState(mount, { dirty: true }, { running: true });
  setPublicSitePublishOverlay(mount, true);
  try {
    const base = String(apiBase || "").replace(/\/$/, "");
    const response = await fetch(`${base}/api/v1/public-site/publish`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    const payload = await readJsonResponse(response);
    if (!response.ok) {
      clearNavStatusCache("public-site");
      const status = await refreshPublicSitePublishState(mount, apiBase, { force: true });
      setPublicSitePublishState(mount, status || { dirty: true }, { error: payload?.error || backendT("nav.public_site_publish_failed", "Publish failed.") });
      mount.__backendPublicSitePublishLocalRunning = false;
      setPublicSitePublishOverlay(mount, false);
      return;
    }
    const jobId = String(payload?.job?.id || "").trim();
    if (jobId) {
      await pollPublicSitePublishJob(mount, apiBase, jobId);
      return;
    }
    mount.__backendPublicSitePublishLocalDirty = false;
    clearNavStatusCache("public-site");
    await refreshPublicSitePublishState(mount, apiBase, { force: true });
    mount.__backendPublicSitePublishLocalRunning = false;
    setPublicSitePublishOverlay(mount, false);
  } catch {
    clearNavStatusCache("public-site");
    const status = await refreshPublicSitePublishState(mount, apiBase, { force: true });
    setPublicSitePublishState(mount, status || { dirty: true }, { error: backendT("nav.public_site_publish_failed", "Publish failed.") });
    mount.__backendPublicSitePublishLocalRunning = false;
    setPublicSitePublishOverlay(mount, false);
  }
}

function bindPublicSitePublishRefresh(mount, apiBase) {
  if (typeof mount.__backendPublicSitePublishRefreshHandler === "function") {
    window.removeEventListener("backend-public-site-publish-refresh", mount.__backendPublicSitePublishRefreshHandler);
  }
  mount.__backendPublicSitePublishRefreshHandler = (event) => {
    const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
    if (detail.dirty === true || detail.source_dirty === true || detail.sourceDirty === true) {
      mount.__backendPublicSitePublishLocalDirty = true;
      setPublicSitePublishState(mount, {
        ...(mount.__backendPublicSitePublishLastStatus || {}),
        dirty: true,
        source_dirty: true
      });
    }
    if (detail.refresh === false) return;
    clearNavStatusCache("public-site");
    void refreshPublicSitePublishState(mount, apiBase, { force: true });
  };
  window.addEventListener("backend-public-site-publish-refresh", mount.__backendPublicSitePublishRefreshHandler);

  if (typeof mount.__backendPublicSiteTranslationRefreshHandler === "function") {
    window.removeEventListener("backend-translations-status-refresh", mount.__backendPublicSiteTranslationRefreshHandler);
  }
  mount.__backendPublicSiteTranslationRefreshHandler = (event) => {
    const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
    if (detail.refresh === false && detail.publicSiteRefresh !== true) return;
    clearNavStatusCache("public-site");
    void refreshPublicSitePublishState(mount, apiBase, { force: true });
  };
  window.addEventListener("backend-translations-status-refresh", mount.__backendPublicSiteTranslationRefreshHandler);
}

export function mountBackendNav(mount, options = {}) {
  if (!mount) return;
  if (mount.__backendPublicSitePublishPollTimer) {
    window.clearTimeout(mount.__backendPublicSitePublishPollTimer);
    mount.__backendPublicSitePublishPollTimer = null;
  }
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
        <button class="backend-nav__publish-btn" id="backendPublicSitePublishBtn" type="button" hidden disabled>${backendT("nav.public_site_publish_clean", "Published")}</button>
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
  bindPublicSitePublishRefresh(mount, apiBase);
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

  publicSitePublishButton(mount)?.addEventListener("click", () => {
    void startPublicSitePublish(mount, apiBase);
  });

  if (typeof mount.__backendNavLanguageHandler === "function") {
    window.removeEventListener("backend-i18n-changed", mount.__backendNavLanguageHandler);
  }
  mount.__backendNavLanguageHandler = () => {
    mountBackendNav(mount, options);
  };
  window.addEventListener("backend-i18n-changed", mount.__backendNavLanguageHandler);
}
