const qs = new URLSearchParams(window.location.search);
const apiBase = (window.CHAPTER2_API_BASE || "").replace(/\/$/, "");

const state = {
  id: qs.get("id") || "",
  user: qs.get("user") || "admin"
};

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  back: document.getElementById("backToBackend"),
  logoutLink: document.getElementById("backendLogoutLink"),
  title: document.getElementById("tourTitle"),
  subtitle: document.getElementById("tourSubtitle"),
  error: document.getElementById("tourError"),
  form: document.getElementById("tourForm"),
  status: document.getElementById("tourFormStatus"),
  cancel: document.getElementById("tourCancelBtn")
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

  loadTour();
}

async function loadTour() {
  const payload = await fetchApi(`/api/v1/tours/${encodeURIComponent(state.id)}`);
  if (!payload?.tour) return;
  const tour = payload.tour;

  if (els.title) els.title.textContent = `Edit Tour ${tour.id}`;
  if (els.subtitle) els.subtitle.textContent = `${tour.title || "-"} | ${tour.destinationCountry || "-"}`;

  setInput("tourId", tour.id || "");
  setInput("tourTitleInput", tour.title || "");
  setInput("tourDestinationCountry", tour.destinationCountry || "");
  setInput("tourStyles", Array.isArray(tour.styles) ? tour.styles.join(", ") : "");
  setInput("tourDurationDays", toInputNumber(tour.durationDays));
  setInput("tourPriceFrom", toInputNumber(tour.priceFrom));
  setInput("tourPriority", toInputNumber(tour.priority));
  setInput("tourRating", toInputNumber(tour.rating));
  setInput("tourImage", tour.image || "");
  setInput("tourFallbackImage", tour.fallbackImage || "");
  setInput("tourSeasonality", tour.seasonality || "");
  setInput("tourShortDescription", tour.shortDescription || "");
  setInput("tourHighlights", Array.isArray(tour.highlights) ? tour.highlights.join("\n") : "");
}

async function submitForm(event) {
  event.preventDefault();
  clearError();

  const payload = {
    title: getInput("tourTitleInput"),
    destinationCountry: getInput("tourDestinationCountry"),
    styles: getInput("tourStyles"),
    durationDays: toNumberOrNull(getInput("tourDurationDays")),
    priceFrom: toNumberOrNull(getInput("tourPriceFrom")),
    priority: toNumberOrNull(getInput("tourPriority")),
    rating: toNumberOrNull(getInput("tourRating")),
    image: getInput("tourImage"),
    fallbackImage: getInput("tourFallbackImage"),
    seasonality: getInput("tourSeasonality"),
    shortDescription: getInput("tourShortDescription"),
    highlights: getInput("tourHighlights")
  };

  if (!payload.title || !payload.destinationCountry || !payload.styles) {
    setStatus("Title, Destination Country, and Styles are required.");
    return;
  }

  const result = await fetchApi(`/api/v1/tours/${encodeURIComponent(state.id)}`, {
    method: "PATCH",
    body: payload
  });
  if (!result) return;

  setStatus("Tour updated.");
  await loadTour();
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

function setStatus(message) {
  if (!els.status) return;
  els.status.textContent = message;
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
