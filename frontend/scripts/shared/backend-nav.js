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

export function mountBackendNav(mount, options = {}) {
  if (!mount) return;
  const currentSection = options.currentSection || "";

  mount.innerHTML = `
    <nav class="nav backend-main-nav" aria-label="Backend navigation">
      <div class="backend-section-nav-wrap">
        <div class="backend-section-nav" role="tablist" aria-label="Backend sections">
          ${buildSectionButton("dashboard", "Dashboard", { type: "image", src: "assets/img/profile_dashboard.png" })}
          ${buildSectionButton("bookings", "Bookings", { type: "image", src: "assets/img/profile_booking.png", size: "large" })}
          ${buildSectionButton("customers", "Customer search", { type: "image", src: "assets/img/profile_person.png" })}
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

  if (currentSection) {
    const activeButton = mount.querySelector(`.backend-section-nav__item[data-backend-section="${currentSection}"]`);
    if (activeButton) {
      activeButton.classList.add("is-active");
      activeButton.setAttribute("aria-current", "page");
    }
  }

  mount.querySelectorAll(".backend-section-nav__item[data-backend-section]").forEach((button) => {
    button.addEventListener("click", () => {
      const section = button.getAttribute("data-backend-section");
      if (!section) return;
      window.location.href = `backend.html?section=${encodeURIComponent(section)}`;
    });
  });
}
