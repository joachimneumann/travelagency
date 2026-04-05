import { fetchAuthMe, readCachedAuthMe, wireAuthLogoutLink } from "./auth.js";

function buildIconMarkup(icon) {
  if (icon?.type === "image") {
    const sizeClass = icon.size === "large" ? " backend-section-nav__icon-image--large" : "";
    return `<img class="backend-section-nav__icon-image${sizeClass}" src="${icon.src}" alt="" />`;
  }
  return String(icon || "");
}

const EMERGENCY_NAV_ICON = `
  <svg class="backend-section-nav__icon-svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <rect x="24" y="10" width="16" height="44" rx="4" fill="#d92d20"></rect>
    <rect x="10" y="24" width="44" height="16" rx="4" fill="#d92d20"></rect>
  </svg>
`;

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
      ? "tours.html"
      : normalizedSection === "standard-travel-plans"
        ? "standard-travel-plans.html"
      : normalizedSection === "emergency"
        ? "emergency.html"
      : normalizedSection === "settings"
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
  const canReadStandardTravelPlans = hasAnyRole(resolvedRoles, "atp_admin", "atp_manager", "atp_staff");
  const canReadTours = hasAnyRole(resolvedRoles, "atp_admin", "atp_accountant", "atp_tour_editor");
  const canReadEmergency = hasAnyRole(resolvedRoles, "atp_admin", "atp_tour_editor");
  const canReadSettings = hasAnyRole(resolvedRoles, "atp_admin", "atp_manager", "atp_accountant");
  mount
    .querySelectorAll(".backend-section-nav__item[data-backend-section]")
    .forEach((button) => {
      const section = button.getAttribute("data-backend-section");
      const visible =
        (section === "bookings" && canReadBookings) ||
        (section === "standard-travel-plans" && canReadStandardTravelPlans) ||
        (section === "tours" && canReadTours) ||
        (section === "emergency" && canReadEmergency) ||
        (section === "settings" && canReadSettings);
      button.hidden = !visible;
      button.classList.toggle("is-hidden", !visible);
    });
}

export function mountBackendNav(mount, options = {}) {
  if (!mount) return;
  const currentSection = options.currentSection || "";
  const apiBase = String(window.ASIATRAVELPLAN_API_BASE || "").replace(/\/$/, "");
  const websiteHref = withLang("index.html");
  const logoutHref = withLang("index.html");

  mount.innerHTML = `
    <nav class="nav backend-main-nav" aria-label="Backend navigation">
      <div class="backend-section-nav-wrap">
        <div class="backend-section-nav" role="tablist" aria-label="${backendT("a11y.backend_sections", "Backend sections")}">
          ${buildSectionButton("bookings", backendT("nav.bookings", "Bookings"), { type: "image", src: "assets/img/profile_booking.png", size: "large" })}
          ${buildSectionButton("standard-travel-plans", backendT("nav.standard_travel_plans", "Standard travel plans"), { type: "image", src: "assets/img/standardTravelPlan.png", size: "large" })}
          ${buildSectionButton("settings", backendT("nav.settings", "Reports and Settings"), { type: "image", src: "assets/img/profile_person.png", size: "large" })}
          ${buildSectionButton("tours", backendT("nav.tours", "Tours"), { type: "image", src: "assets/img/hat.png", size: "large" })}
          ${buildSectionButton("emergency", backendT("nav.emergency", "Emergency"), EMERGENCY_NAV_ICON)}
        </div>
      </div>

      <div class="backend-nav__meta">
        <ul class="nav-list">
          <li class="backend-nav__website"><a href="${websiteHref}">${backendT("nav.website", "Website")}</a></li>
          <li class="backend-nav__logout">
            <a class="backend-nav__logout-link" id="backendLogoutLink" href="#">
              <span class="backend-nav__logout-title">${backendT("nav.logout", "Logout")}</span>
              <span class="backend-nav__user" id="backendUserLabel"></span>
            </a>
          </li>
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
      const liveUserLabel = resolveUserLabel(payload?.user);
      const labelElement = mount.querySelector("#backendUserLabel");
      if (labelElement) {
        labelElement.textContent = liveUserLabel;
      }
    })
    .catch(() => {
      applyNavPermissions(mount, cachedRoles);
    });
}
