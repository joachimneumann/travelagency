import { fetchAuthMe } from "./auth.js";

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
  const url = new URL("backend.html", window.location.origin);
  url.searchParams.set("section", section || "bookings");
  const lang = currentLang();
  if (lang) url.searchParams.set("lang", lang);
  return `${url.pathname}${url.search}`;
}

function hasAnyRole(roles, ...expected) {
  return expected.some((role) => roles.includes(role));
}

function applyNavPermissions(mount, roles) {
  const resolvedRoles = Array.isArray(roles) ? roles : [];
  const canReadTours = hasAnyRole(resolvedRoles, "atp_admin", "atp_accountant");
  const canReadSettings = hasAnyRole(resolvedRoles, "atp_admin", "atp_manager");
  mount
    .querySelectorAll(".backend-section-nav__item[data-backend-section]")
    .forEach((button) => {
      const section = button.getAttribute("data-backend-section");
      const visible =
        section === "bookings" ||
        (section === "tours" && canReadTours) ||
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

  mount.innerHTML = `
    <nav class="nav backend-main-nav" aria-label="Backend navigation">
      <div class="backend-section-nav-wrap">
        <div class="backend-section-nav" role="tablist" aria-label="${backendT("a11y.backend_sections", "Backend sections")}">
          ${buildSectionButton("bookings", backendT("nav.bookings", "Bookings"), { type: "image", src: "assets/img/profile_booking.png", size: "large" })}
          ${buildSectionButton("settings", backendT("nav.settings", "Reports and Settings"), "📊")}
          ${buildSectionButton("tours", backendT("nav.tours", "Tours"), "🗺️")}
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

  applyNavPermissions(mount, []);

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
    })
    .catch(() => {
      applyNavPermissions(mount, []);
    });
}
