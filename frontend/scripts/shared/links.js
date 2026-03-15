function currentLang() {
  if (typeof window === "undefined") return "";
  if (typeof window.backendI18n?.getLang === "function") return window.backendI18n.getLang();
  const params = new URLSearchParams(window.location.search);
  return String(params.get("lang") || "").trim();
}

function addLangParam(params) {
  const lang = currentLang();
  if (lang) params.set("lang", lang);
}

export function buildBookingHref(id) {
  const params = new URLSearchParams({ id });
  addLangParam(params);
  return `booking.html?${params.toString()}`;
}

export function buildPersonsHref(search = "") {
  const params = new URLSearchParams();
  if (String(search || "").trim()) params.set("search", String(search).trim());
  addLangParam(params);
  const query = params.toString();
  return query ? `persons.html?${query}` : "persons.html";
}

export function buildTourEditHref(id) {
  const params = new URLSearchParams({ id });
  addLangParam(params);
  return `tour.html?${params.toString()}`;
}
