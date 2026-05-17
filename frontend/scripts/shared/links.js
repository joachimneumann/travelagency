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

function normalizeContentLang(value) {
  return String(value || "").trim().toLowerCase();
}

function resolveBookingContentLang(source = {}) {
  if (!source || typeof source !== "object") return "";
  return normalizeContentLang(
    source.content_lang
    || source.contentLang
    || source.customer_language
    || source.customerLanguage
    || source.web_form_submission?.preferred_language
    || source.preferred_language
  );
}

export function buildBookingHref(id, booking = {}) {
  const params = new URLSearchParams({ id });
  const contentLang = resolveBookingContentLang(booking);
  if (contentLang) params.set("content_lang", contentLang);
  addLangParam(params);
  return `booking.html?${params.toString()}`;
}

export function buildTourEditHref(id) {
  const params = new URLSearchParams({ id });
  addLangParam(params);
  return `marketing_tour.html?${params.toString()}`;
}

export function buildTourCreateHref() {
  const params = new URLSearchParams();
  addLangParam(params);
  return params.toString() ? `marketing_tour.html?${params.toString()}` : "marketing_tour.html";
}

export function buildTourVariantEditHref(id) {
  const params = new URLSearchParams({ id });
  addLangParam(params);
  return `tour_variant.html?${params.toString()}`;
}

export function buildTourVariantCreateHref(baseMarketingTourId = "") {
  const params = new URLSearchParams();
  const baseId = String(baseMarketingTourId || "").trim();
  if (baseId) params.set("base_marketing_tour_id", baseId);
  addLangParam(params);
  return params.toString() ? `tour_variant.html?${params.toString()}` : "tour_variant.html";
}
