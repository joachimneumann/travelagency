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

export function resolveBackendSectionHref(section) {
  if (section === "persons") return "persons.html";
  return `backend.html?section=${encodeURIComponent(section || "bookings")}`;
}

function hasAnyRole(roles, ...expected) {
  return expected.some((role) => roles.includes(role));
}

function applyNavPermissions(mount, roles) {
  const resolvedRoles = Array.isArray(roles) ? roles : [];
  const canReadTours = hasAnyRole(resolvedRoles, "atp_admin", "atp_manager", "atp_accountant");
  const canReadSettings = hasAnyRole(resolvedRoles, "atp_admin", "atp_manager");
  mount
    .querySelectorAll(".backend-section-nav__item[data-backend-section]")
    .forEach((button) => {
      const section = button.getAttribute("data-backend-section");
      const visible =
        section === "bookings" ||
        section === "persons" ||
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

  mount.innerHTML = `
    <nav class="nav backend-main-nav" aria-label="Backend navigation">
      <div class="backend-section-nav-wrap">
        <div class="backend-section-nav" role="tablist" aria-label="Backend sections">
          ${buildSectionButton("bookings", "Bookings", { type: "image", src: "assets/img/profile_booking.png", size: "large" })}
          ${buildSectionButton("persons", "Persons", { type: "image", src: "assets/img/profile_person.png" })}
          ${buildSectionButton("settings", "Reports and Settings", "📊")}
          ${buildSectionButton("tours", "Tours", "🗺️")}
        </div>
      </div>

      <div class="backend-nav__meta">
        <ul class="nav-list">
          <li class="backend-nav__website"><a href="index.html">Website</a></li>
          <li class="backend-nav__logout">
            <a class="backend-nav__logout-link" id="backendLogoutLink" href="#">
              <span class="backend-nav__logout-title">Logout</span>
              <span class="backend-nav__user" id="backendUserLabel"></span>
            </a>
          </li>
        </ul>
      </div>
    </nav>
  `;

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

  fetch(`${apiBase}/auth/me`, { credentials: "include" })
    .then((response) => response.json().catch(() => null))
    .then((payload) => {
      const roles = Array.isArray(payload?.user?.roles) ? payload.user.roles : [];
      applyNavPermissions(mount, roles);
    })
    .catch(() => {
      applyNavPermissions(mount, []);
    });
}
