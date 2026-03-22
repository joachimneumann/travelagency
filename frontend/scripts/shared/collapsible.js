import { escapeHtml, normalizeText } from "./api.js";

let backendCollapsibleCounter = 0;
const BACKEND_COLLAPSIBLE_DURATION_MS = 240;

function resolveCollapsibleText(value) {
  return normalizeText(value);
}

function resolveCollapsibleElements(panel) {
  if (!(panel instanceof HTMLElement)) return { trigger: null, body: null };
  const trigger = panel.querySelector(".backend-collapsible__summary, .booking-collapsible__summary");
  const body = panel.querySelector(".backend-collapsible__body, .booking-collapsible__body");
  return {
    trigger: trigger instanceof HTMLElement ? trigger : null,
    body: body instanceof HTMLElement ? body : null
  };
}

function finishCollapsibleTransition(body, isOpen) {
  if (!(body instanceof HTMLElement)) return;
  if (body._backendCollapsibleCleanup) {
    body.removeEventListener("transitionend", body._backendCollapsibleCleanup);
    body._backendCollapsibleCleanup = null;
  }
  if (body._backendCollapsibleTimer) {
    window.clearTimeout(body._backendCollapsibleTimer);
    body._backendCollapsibleTimer = null;
  }
  body.dataset.animating = "false";
  body.style.overflow = isOpen ? "" : "hidden";
  body.style.height = isOpen ? "auto" : "0px";
}

function animateCollapsibleBody(body, isOpen) {
  if (!(body instanceof HTMLElement)) return;

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reduceMotion) {
    body.dataset.animating = "false";
    body.style.overflow = isOpen ? "" : "hidden";
    body.style.height = isOpen ? "auto" : "0px";
    return;
  }

  finishCollapsibleTransition(body, !isOpen);

  const startHeight = body.getBoundingClientRect().height;
  body.dataset.animating = "true";
  body.style.overflow = "hidden";
  body.style.height = `${startHeight}px`;

  const targetHeight = isOpen ? body.scrollHeight : 0;
  void body.offsetHeight;

  const cleanup = (event) => {
    if (event && event.target !== body) return;
    if (event && event.propertyName !== "height") return;
    finishCollapsibleTransition(body, isOpen);
  };

  body._backendCollapsibleCleanup = cleanup;
  body.addEventListener("transitionend", cleanup);
  body._backendCollapsibleTimer = window.setTimeout(() => {
    finishCollapsibleTransition(body, isOpen);
  }, BACKEND_COLLAPSIBLE_DURATION_MS + 80);

  body.style.height = `${targetHeight}px`;
}

export function buildBackendCollapsibleHeaderMarkup({ primary = "", secondary = "" } = {}) {
  const normalizedPrimary = resolveCollapsibleText(primary);
  const normalizedSecondary = resolveCollapsibleText(secondary);
  const primaryMarkup = `<span class="backend-collapsible-header__primary">${escapeHtml(normalizedPrimary)}</span>`;
  const secondaryMarkup = normalizedSecondary
    ? `<span class="backend-collapsible-header__secondary">${escapeHtml(normalizedSecondary)}</span>`
    : "";
  return `<span class="backend-collapsible-header">${primaryMarkup}${secondaryMarkup}</span>`;
}

export function renderBackendCollapsibleHeader(target, options = {}) {
  if (!(target instanceof HTMLElement)) return;
  target.innerHTML = buildBackendCollapsibleHeaderMarkup(options);
}

export function setBackendCollapsibleOpen(panel, isOpen, options = {}) {
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
    animateCollapsibleBody(body, open);
  } else {
    finishCollapsibleTransition(body, open);
  }
}

export function initializeBackendCollapsible(panel) {
  if (!(panel instanceof HTMLElement)) return;
  const { trigger, body } = resolveCollapsibleElements(panel);
  if (!trigger || !body) return;

  if (!body.id) {
    backendCollapsibleCounter += 1;
    body.id = panel.id ? `${panel.id}_body` : `backend_collapsible_body_${backendCollapsibleCounter}`;
  }

  trigger.setAttribute("aria-controls", body.id);

  if (trigger instanceof HTMLButtonElement && !trigger.type) {
    trigger.type = "button";
  }

  if (panel.dataset.backendCollapsibleBound !== "true") {
    trigger.addEventListener("click", () => {
      setBackendCollapsibleOpen(panel, !panel.classList.contains("is-open"));
    });
    panel.dataset.backendCollapsibleBound = "true";
  }

  setBackendCollapsibleOpen(panel, panel.classList.contains("is-open"), { animate: false });
}

export function initializeBackendCollapsibles(root = document) {
  if (!(root instanceof Document || root instanceof HTMLElement)) return;
  root.querySelectorAll(".backend-collapsible, .booking-collapsible").forEach((panel) => {
    initializeBackendCollapsible(panel);
  });
}
