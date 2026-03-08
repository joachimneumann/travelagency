function buildSectionButton(section, title, icon) {
  return `
    <button type="button" class="backend-section-nav__item" data-backend-section="${section}" title="${title}" aria-label="${title}">
      <span class="backend-section-nav__icon" aria-hidden="true">${icon}</span>
    </button>
  `;
}

export function mountBackendNav(mount, options = {}) {
  if (!mount) return;
  const currentSection = options.currentSection || "";
  const showBackLink = Boolean(options.showBackLink);

  mount.innerHTML = `
    <nav class="nav backend-main-nav" aria-label="Backend navigation">
      <div class="backend-section-nav-wrap">
        <div class="backend-section-nav" role="tablist" aria-label="Backend sections">
          ${buildSectionButton("dashboard", "Dashboard", "🏠")}
          ${buildSectionButton("bookings", "Bookings", "📋")}
          ${buildSectionButton("customers", "Customers", "👤")}
          ${buildSectionButton("travelGroups", "Travel Groups", "👤👤👤")}
          ${buildSectionButton("settings", "Reports and Settings", "📊")}
          ${buildSectionButton("tours", "Tours", "🗺️")}
        </div>
      </div>

      <div class="backend-nav__meta">
        <ul class="nav-list">
          ${showBackLink ? '<li><a id="backToBackend" href="backend.html">Backend</a></li>' : ""}
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

  if (currentSection) {
    const activeButton = mount.querySelector(`.backend-section-nav__item[data-backend-section="${currentSection}"]`);
    if (activeButton) activeButton.classList.add("is-active");
  }
}
