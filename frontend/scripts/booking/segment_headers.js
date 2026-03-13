function normalizeSegmentText(value) {
  return String(value || "").trim();
}

let bookingCollapsibleCounter = 0;
const BOOKING_COLLAPSIBLE_DURATION_MS = 240;

function escapeSegmentText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildBookingSegmentHeaderMarkup({ primary = "", secondary = "" } = {}) {
  const normalizedPrimary = normalizeSegmentText(primary);
  const normalizedSecondary = normalizeSegmentText(secondary);
  const primaryMarkup = `<span class="booking-segment-header__primary">${escapeSegmentText(normalizedPrimary)}</span>`;
  const secondaryMarkup = normalizedSecondary
    ? `<span class="booking-segment-header__secondary">${escapeSegmentText(normalizedSecondary)}</span>`
    : "";
  return `<span class="booking-segment-header">${primaryMarkup}${secondaryMarkup}</span>`;
}

export function renderBookingSegmentHeader(target, options = {}) {
  if (!(target instanceof HTMLElement)) return;
  target.innerHTML = buildBookingSegmentHeaderMarkup(options);
}

function resolveCollapsibleElements(panel) {
  if (!(panel instanceof HTMLElement)) return { trigger: null, body: null };
  const trigger = panel.querySelector(".booking-collapsible__summary");
  const body = panel.querySelector(".booking-collapsible__body");
  return {
    trigger: trigger instanceof HTMLElement ? trigger : null,
    body: body instanceof HTMLElement ? body : null
  };
}

function finishBookingCollapsibleTransition(body, isOpen) {
  if (!(body instanceof HTMLElement)) return;
  if (body._bookingCollapsibleCleanup) {
    body.removeEventListener("transitionend", body._bookingCollapsibleCleanup);
    body._bookingCollapsibleCleanup = null;
  }
  if (body._bookingCollapsibleTimer) {
    window.clearTimeout(body._bookingCollapsibleTimer);
    body._bookingCollapsibleTimer = null;
  }
  body.dataset.animating = "false";
  body.style.overflow = isOpen ? "" : "hidden";
  body.style.height = isOpen ? "auto" : "0px";
}

function animateBookingCollapsibleBody(body, isOpen) {
  if (!(body instanceof HTMLElement)) return;

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reduceMotion) {
    body.dataset.animating = "false";
    body.style.overflow = isOpen ? "" : "hidden";
    body.style.height = isOpen ? "auto" : "0px";
    return;
  }

  finishBookingCollapsibleTransition(body, !isOpen);

  const startHeight = body.getBoundingClientRect().height;
  body.dataset.animating = "true";
  body.style.overflow = "hidden";
  body.style.height = `${startHeight}px`;

  const targetHeight = isOpen ? body.scrollHeight : 0;
  // Force layout so the browser treats the next height assignment as a transition.
  void body.offsetHeight;

  const cleanup = (event) => {
    if (event && event.target !== body) return;
    if (event && event.propertyName !== "height") return;
    finishBookingCollapsibleTransition(body, isOpen);
  };

  body._bookingCollapsibleCleanup = cleanup;
  body.addEventListener("transitionend", cleanup);
  body._bookingCollapsibleTimer = window.setTimeout(() => {
    finishBookingCollapsibleTransition(body, isOpen);
  }, BOOKING_COLLAPSIBLE_DURATION_MS + 80);

  body.style.height = `${targetHeight}px`;
}

export function setBookingCollapsibleOpen(panel, isOpen, options = {}) {
  const { trigger, body } = resolveCollapsibleElements(panel);
  if (!trigger || !body) return;
  const open = Boolean(isOpen);
  const shouldAnimate = options.animate !== false;
  panel.classList.toggle("is-open", open);
  trigger.setAttribute("aria-expanded", String(open));
  body.setAttribute("aria-hidden", String(!open));
  if ("inert" in body) {
    body.inert = !open;
  }

  if (shouldAnimate) {
    animateBookingCollapsibleBody(body, open);
  } else {
    finishBookingCollapsibleTransition(body, open);
  }
}

export function initializeBookingCollapsible(panel) {
  if (!(panel instanceof HTMLElement)) return;
  const { trigger, body } = resolveCollapsibleElements(panel);
  if (!trigger || !body) return;

  if (!body.id) {
    bookingCollapsibleCounter += 1;
    body.id = panel.id ? `${panel.id}_body` : `booking_collapsible_body_${bookingCollapsibleCounter}`;
  }

  trigger.setAttribute("aria-controls", body.id);

  if (trigger instanceof HTMLButtonElement && !trigger.type) {
    trigger.type = "button";
  }

  if (panel.dataset.bookingCollapsibleBound !== "true") {
    trigger.addEventListener("click", () => {
      setBookingCollapsibleOpen(panel, !panel.classList.contains("is-open"));
    });
    panel.dataset.bookingCollapsibleBound = "true";
  }

  setBookingCollapsibleOpen(panel, panel.classList.contains("is-open"), { animate: false });
}

export function initializeBookingCollapsibles(root = document) {
  if (!(root instanceof Document || root instanceof HTMLElement)) return;
  root.querySelectorAll(".booking-collapsible").forEach((panel) => {
    initializeBookingCollapsible(panel);
  });
}
