import { bookingT } from "./i18n.js";

export function setBookingPageOverlay(els, isVisible, message = "") {
  const overlay = els?.booking_page_overlay || els?.travel_plan_translate_overlay;
  const overlayText = els?.booking_page_overlay_text || els?.travel_plan_translate_overlay_text;

  if (overlayText) {
    overlayText.textContent = String(
      message || bookingT("booking.translation.translating_overlay", "Please wait.")
    ).trim();
  }
  if (els?.pageBody instanceof HTMLElement) {
    els.pageBody.classList.toggle("booking-detail-page--translation-busy", Boolean(isVisible));
  }
  if (els?.pageHeader instanceof HTMLElement) {
    els.pageHeader.inert = Boolean(isVisible);
    els.pageHeader.setAttribute("aria-busy", isVisible ? "true" : "false");
  }
  if (els?.mainContent instanceof HTMLElement) {
    els.mainContent.inert = Boolean(isVisible);
    els.mainContent.setAttribute("aria-busy", isVisible ? "true" : "false");
  }
  if (!(overlay instanceof HTMLElement)) return;
  if (isVisible) {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    return;
  }
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");
}
