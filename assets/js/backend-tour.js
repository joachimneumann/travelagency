const qs = new URLSearchParams(window.location.search);
const apiBase = (window.CHAPTER2_API_BASE || "").replace(/\/$/, "");

const state = {
  id: qs.get("id") || "",
  user: qs.get("user") || "admin",
  tour: null,
  options: {
    destinations: [],
    styles: []
  }
};

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  back: document.getElementById("backToBackend"),
  logoutLink: document.getElementById("backendLogoutLink"),
  title: document.getElementById("tourTitle"),
  subtitle: document.getElementById("tourSubtitle"),
  error: document.getElementById("tourError"),
  titleError: document.getElementById("tourTitleError"),
  form: document.getElementById("tourForm"),
  status: document.getElementById("tourFormStatus"),
  cancel: document.getElementById("tourCancelBtn"),
  destinationHidden: document.getElementById("tourDestinationCountries"),
  destinationChoices: document.getElementById("tourDestinationChoices"),
  stylesHidden: document.getElementById("tourStyles"),
  styleChoices: document.getElementById("tourStyleChoices"),
  changeImageBtn: document.getElementById("tourChangeImageBtn"),
  imageUpload: document.getElementById("tourImageUpload"),
  heroImage: document.getElementById("tourHeroImage")
};

init();

function init() {
  const backParams = new URLSearchParams({ user: state.user });
  const backHref = `backend.html?${backParams.toString()}`;

  if (els.homeLink) els.homeLink.href = backHref;
  if (els.back) els.back.href = backHref;
  if (els.cancel) els.cancel.href = backHref;
  if (els.logoutLink) {
    const returnTo = `${window.location.origin}/index.html`;
    els.logoutLink.href = `${apiBase}/auth/logout?global=true&return_to=${encodeURIComponent(returnTo)}`;
  }

  if (!state.id) {
    showError("Missing tour id.");
    return;
  }

  if (els.form) {
    els.form.addEventListener("submit", submitForm);
  }
  const titleInput = document.getElementById("tourTitleInput");
  if (titleInput) {
    titleInput.addEventListener("input", clearTitleError);
  }
  if (els.changeImageBtn && els.imageUpload) {
    els.changeImageBtn.addEventListener("click", () => {
      els.imageUpload.click();
    });
  }
  if (els.imageUpload) {
    els.imageUpload.addEventListener("change", () => {
      const file = els.imageUpload.files?.[0];
      if (file) setStatus(`Selected image: ${file.name}`);
    });
  }

  loadTour();
}

async function loadTour() {
  const payload = await fetchApi(`/api/v1/tours/${encodeURIComponent(state.id)}`);
  if (!payload?.tour) return;

  state.tour = payload.tour;
  state.options.destinations = Array.isArray(payload.options?.destinations) ? payload.options.destinations : [];
  state.options.styles = Array.isArray(payload.options?.styles) ? payload.options.styles : [];

  const tour = state.tour;
  const destinationCountries = tourDestinations(tour);
  const styles = tourStyles(tour);
  updateHeader(tour, destinationCountries, styles);

  setInput("tourId", tour.id || "");
  setInput("tourTitleInput", tour.title || "");
  setInput("tourDurationDays", toInputNumber(tour.durationDays));
  setInput("tourPriceFrom", toInputNumber(tour.priceFrom));
  setInput("tourPriority", toInputNumber(tour.priority));
  setInput("tourRating", toInputNumber(tour.rating));
  setInput("tourSeasonality", tour.seasonality || "");
  setInput("tourShortDescription", tour.shortDescription || "");
  setInput("tourHighlights", Array.isArray(tour.highlights) ? tour.highlights.join("\n") : "");
  updateHeroImage(tour.image || "");

  renderDestinationChoices(destinationCountries);
  renderStyleChoices(styles);
}

function renderDestinationChoices(selectedValues) {
  const values = dedupeValues([...(state.options.destinations || []), ...(selectedValues || [])]);
  renderCheckboxes({
    container: els.destinationChoices,
    inputName: "destinationCountryChoice",
    values,
    selectedValues,
    singleSelect: false,
    onChange: () => {
      const selected = getCheckedValues("destinationCountryChoice");
      if (els.destinationHidden) els.destinationHidden.value = selected.join(", ");
    }
  });

  if (els.destinationHidden) {
    els.destinationHidden.value = (selectedValues || []).join(", ");
  }
}

function renderStyleChoices(selectedValues) {
  const values = dedupeValues([...(state.options.styles || []), ...(selectedValues || [])]);
  renderCheckboxes({
    container: els.styleChoices,
    inputName: "styleChoice",
    values,
    selectedValues,
    singleSelect: false,
    onChange: () => {
      if (els.stylesHidden) els.stylesHidden.value = getCheckedValues("styleChoice").join(", ");
    }
  });

  if (els.stylesHidden) {
    els.stylesHidden.value = selectedValues.join(", ");
  }
}

function renderCheckboxes({ container, inputName, values, selectedValues = [], singleSelect = false, onChange }) {
  if (!container) return;
  const selectedSet = new Set(selectedValues.filter(Boolean).map(choiceKey));

  const html = values
    .filter(Boolean)
    .map((value) => {
      const id = `${inputName}_${slugify(value)}`;
      const checked = selectedSet.has(choiceKey(value)) ? "checked" : "";
      return `<label class="backend-checkbox-item" for="${escapeHtml(id)}"><input type="checkbox" id="${escapeHtml(
        id
      )}" name="${escapeHtml(inputName)}" value="${escapeHtml(value)}" ${checked} />${escapeHtml(value)}</label>`;
    })
    .join("");

  container.innerHTML = html;
  container.querySelectorAll(`input[name="${inputName}"]`).forEach((input) => {
    input.addEventListener("change", () => {
      if (singleSelect && input.checked) {
        container.querySelectorAll(`input[name="${inputName}"]`).forEach((el) => {
          if (el !== input) el.checked = false;
        });
      }
      onChange();
    });
  });

  onChange();
}

function getCheckedValues(inputName) {
  return Array.from(document.querySelectorAll(`input[name="${inputName}"]:checked`)).map((el) => String(el.value || "").trim());
}

async function submitForm(event) {
  event.preventDefault();
  clearError();
  clearTitleError();

  const selectedDestinationCountries = getCheckedValues("destinationCountryChoice");
  const selectedStyles = getCheckedValues("styleChoice");

  const payload = {
    title: getInput("tourTitleInput"),
    destinationCountries: selectedDestinationCountries,
    styles: selectedStyles,
    durationDays: toNumberOrNull(getInput("tourDurationDays")),
    priceFrom: toNumberOrNull(getInput("tourPriceFrom")),
    priority: toNumberOrNull(getInput("tourPriority")),
    rating: toNumberOrNull(getInput("tourRating")),
    seasonality: getInput("tourSeasonality"),
    shortDescription: getInput("tourShortDescription"),
    highlights: getInput("tourHighlights")
  };

  if (!payload.title || !payload.destinationCountries.length || !payload.styles.length) {
    setStatus("Title, at least one Destination Country, and at least one Style are required.");
    return;
  }

  const duplicate = await findDuplicateTourTitle(payload.title, state.id);
  if (duplicate) {
    setTitleError(
      `A tour titled "${duplicate.title || payload.title}" already exists (ID: ${duplicate.id}). Please use a different title.`
    );
    setStatus("Save blocked due to duplicate title.");
    const titleInput = document.getElementById("tourTitleInput");
    if (titleInput) titleInput.focus();
    return;
  }

  setStatus("Saving...");
  const result = await fetchApi(`/api/v1/tours/${encodeURIComponent(state.id)}`, {
    method: "PATCH",
    body: payload
  });
  if (!result) return;
  if (result.tour) {
    state.tour = result.tour;
    updateHeader(state.tour, tourDestinations(state.tour), tourStyles(state.tour));
  }

  const file = els.imageUpload?.files?.[0] || null;
  if (file) {
    setStatus("Uploading image...");
    const base64 = await fileToBase64(file);
    const imageResult = await fetchApi(`/api/v1/tours/${encodeURIComponent(state.id)}/image`, {
      method: "POST",
      body: {
        filename: file.name,
        data_base64: base64
      }
    });
    if (!imageResult) return;
  }

  setStatus("Tour updated.");
  if (els.imageUpload) els.imageUpload.value = "";
  await loadTour();
}

async function fileToBase64(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      const comma = value.indexOf(",");
      resolve(comma >= 0 ? value.slice(comma + 1) : value);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function fetchApi(path, options = {}) {
  const method = options.method || "GET";
  const body = options.body;

  try {
    const response = await fetch(`${apiBase}${path}`, {
      method,
      credentials: "include",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });

    const payload = await response.json();
    if (!response.ok) {
      showError(payload.error || "Request failed");
      return null;
    }

    return payload;
  } catch (error) {
    showError("Could not connect to backend API.");
    console.error(error);
    return null;
  }
}

async function findDuplicateTourTitle(title, currentTourId) {
  const normalizedTitle = normalizeCompareText(title);
  if (!normalizedTitle) return null;

  let page = 1;
  const pageSize = 100;
  const maxPages = 50;

  while (page <= maxPages) {
    const query = new URLSearchParams({
      search: title,
      page: String(page),
      page_size: String(pageSize)
    });

    const payload = await fetchApi(`/api/v1/tours?${query.toString()}`);
    if (!payload) return null;

    const items = Array.isArray(payload.items) ? payload.items : [];
    const duplicate = items.find((tour) => {
      const otherId = String(tour?.id || "").trim();
      if (!otherId || otherId === currentTourId) return false;
      return normalizeCompareText(tour?.title) === normalizedTitle;
    });
    if (duplicate) return duplicate;

    const totalPages = Number(payload.total_pages || 1);
    if (!Number.isFinite(totalPages) || page >= totalPages) break;
    page += 1;
  }

  return null;
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

function setTitleError(message) {
  if (!els.titleError) return;
  els.titleError.textContent = message;
  els.titleError.classList.add("show");
}

function clearTitleError() {
  if (!els.titleError) return;
  els.titleError.textContent = "";
  els.titleError.classList.remove("show");
}

function setStatus(message) {
  if (!els.status) return;
  els.status.textContent = message;
}

function updateHeroImage(src) {
  if (!els.heroImage) return;
  const value = String(src || "").trim();
  if (!value) {
    els.heroImage.src = "";
    els.heroImage.classList.add("empty");
    els.heroImage.style.display = "none";
    return;
  }
  els.heroImage.src = absolutizeApiUrl(value);
  els.heroImage.classList.remove("empty");
  els.heroImage.style.display = "block";
}

function updateHeader(tour, destinations, styles) {
  if (els.title) els.title.textContent = tour?.title || "Tour";
  if (!els.subtitle) return;
  const destText = destinations.length ? destinations.join(", ") : "-";
  const styleText = styles.length ? styles.join(", ") : "-";
  els.subtitle.textContent = `Destinations: ${destText} | Styles: ${styleText}`;
}

function tourDestinations(tour) {
  if (Array.isArray(tour?.destinationCountries) && tour.destinationCountries.length) {
    return tour.destinationCountries.map((value) => String(value || "").trim()).filter(Boolean);
  }
  return [];
}

function tourStyles(tour) {
  return Array.isArray(tour?.styles) ? tour.styles.map((value) => String(value || "").trim()).filter(Boolean) : [];
}

function absolutizeApiUrl(urlValue) {
  const value = String(urlValue || "").trim();
  if (!value) return value;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/")) return `${apiBase}${value}`;
  return `${apiBase}/${value}`;
}

function getInput(id) {
  const el = document.getElementById(id);
  return String(el?.value || "").trim();
}

function setInput(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function toNumberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toInputNumber(value) {
  return value === null || value === undefined ? "" : String(value);
}

function dedupeValues(values) {
  const seen = new Set();
  const out = [];
  for (const raw of values || []) {
    const value = String(raw || "").trim();
    if (!value) continue;
    const key = choiceKey(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function choiceKey(value) {
  return String(value || "").trim().toLowerCase();
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeCompareText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
