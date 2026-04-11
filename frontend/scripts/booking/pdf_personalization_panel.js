const BOOKING_PDF_PERSONALIZATION_PANELS = Object.freeze([
  Object.freeze({
    scope: "travel_plan",
    panelElsKey: "travelPlanPdfPersonalizationPanel",
    referenceElsKey: "pdfTravelPlanReference",
    referenceMountId: "booking_pdf_travel_plan_reference",
    title: "PDF Texts",
    variant: "collapsible",
    initiallyOpen: false,
    items: Object.freeze([
      Object.freeze({
        kind: "localized",
        field: "subtitle",
        includeField: "include_subtitle",
        elsKey: "pdfTravelPlanSubtitleMount",
        mountDataKey: "travel-plan-subtitle",
        rows: 2,
        labelKey: "booking.pdf.travel_plan.subtitle",
        labelFallback: "Travel plan subtitle",
        placeholderKey: "subtitle",
        defaultChecked: true,
        enableWhenTextPresent: true
      }),
      Object.freeze({
        kind: "localized",
        field: "welcome",
        includeField: "include_welcome",
        elsKey: "pdfTravelPlanWelcomeMount",
        mountId: "booking_pdf_travel_plan_welcome_mount",
        rows: 4,
        labelKey: "booking.pdf.travel_plan.welcome",
        labelFallback: "Travel plan welcome",
        placeholderKey: "travel_plan_welcome",
        defaultChecked: true,
        enableWhenTextPresent: true
      }),
      Object.freeze({
        kind: "localized",
        field: "children_policy",
        includeField: "include_children_policy",
        elsKey: "pdfTravelPlanChildrenPolicyMount",
        mountId: "booking_pdf_travel_plan_children_policy_mount",
        rows: 3,
        labelKey: "booking.pdf.travel_plan.children_policy",
        labelFallback: "Children's Policy",
        placeholderKey: "",
        defaultChecked: false,
        enableWhenTextPresent: true
      }),
      Object.freeze({
        kind: "localized",
        field: "whats_not_included",
        includeField: "include_whats_not_included",
        elsKey: "pdfTravelPlanWhatsNotIncludedMount",
        mountId: "booking_pdf_travel_plan_whats_not_included_mount",
        rows: 3,
        labelKey: "booking.pdf.travel_plan.whats_not_included",
        labelFallback: "What's not included",
        placeholderKey: "",
        defaultChecked: false,
        enableWhenTextPresent: true
      }),
      Object.freeze({
        kind: "localized",
        field: "closing",
        includeField: "include_closing",
        elsKey: "pdfTravelPlanClosingMount",
        mountId: "booking_pdf_travel_plan_closing_mount",
        rows: 3,
        labelKey: "booking.pdf.travel_plan.closing",
        labelFallback: "Travel plan closing",
        placeholderKey: "closing",
        defaultChecked: true,
        enableWhenTextPresent: true
      }),
      Object.freeze({
        kind: "toggle",
        field: "include_who_is_traveling",
        elsKey: "pdfTravelPlanIncludeWhoIsTravelingMount",
        mountId: "booking_pdf_travel_plan_include_who_is_traveling_mount",
        labelKey: "booking.pdf.travel_plan.include_who_is_traveling",
        labelFallback: "Who is traveling",
        defaultChecked: false,
        previewKey: ""
      })
    ])
  }),
  Object.freeze({
    scope: "offer",
    panelElsKey: "offerPdfPersonalizationPanel",
    referenceElsKey: "pdfOfferReference",
    referenceMountId: "booking_pdf_offer_reference",
    title: "PDF Texts",
    variant: "collapsible",
    initiallyOpen: false,
    items: Object.freeze([
      Object.freeze({
        kind: "localized",
        field: "subtitle",
        includeField: "include_subtitle",
        elsKey: "pdfOfferSubtitleMount",
        mountId: "booking_pdf_offer_subtitle_mount",
        rows: 2,
        labelKey: "booking.pdf.offer.subtitle",
        labelFallback: "Offer subtitle",
        placeholderKey: "subtitle",
        defaultChecked: true,
        enableWhenTextPresent: true
      }),
      Object.freeze({
        kind: "localized",
        field: "welcome",
        includeField: "include_welcome",
        elsKey: "pdfOfferWelcomeMount",
        mountId: "booking_pdf_offer_welcome_mount",
        rows: 4,
        labelKey: "booking.pdf.offer.welcome",
        labelFallback: "Offer welcome",
        placeholderKey: "offer_welcome",
        defaultChecked: true,
        enableWhenTextPresent: true
      }),
      Object.freeze({
        kind: "localized",
        field: "children_policy",
        includeField: "include_children_policy",
        elsKey: "pdfOfferChildrenPolicyMount",
        mountId: "booking_pdf_offer_children_policy_mount",
        rows: 3,
        labelKey: "booking.pdf.offer.children_policy",
        labelFallback: "Children's Policy",
        placeholderKey: "",
        defaultChecked: false,
        enableWhenTextPresent: true
      }),
      Object.freeze({
        kind: "localized",
        field: "whats_not_included",
        includeField: "include_whats_not_included",
        elsKey: "pdfOfferWhatsNotIncludedMount",
        mountId: "booking_pdf_offer_whats_not_included_mount",
        rows: 3,
        labelKey: "booking.pdf.offer.whats_not_included",
        labelFallback: "What's not included",
        placeholderKey: "",
        defaultChecked: false,
        enableWhenTextPresent: true
      }),
      Object.freeze({
        kind: "toggle",
        field: "include_cancellation_policy",
        elsKey: "pdfOfferIncludeCancellationPolicyMount",
        mountId: "booking_pdf_offer_include_cancellation_policy_mount",
        labelKey: "booking.pdf.offer.include_cancellation_policy",
        labelFallback: "Include cancellation policy",
        defaultChecked: true,
        previewKey: "offer_cancellation_policy"
      }),
      Object.freeze({
        kind: "localized",
        field: "closing",
        includeField: "include_closing",
        elsKey: "pdfOfferClosingMount",
        mountId: "booking_pdf_offer_closing_mount",
        rows: 3,
        labelKey: "booking.pdf.offer.closing",
        labelFallback: "Offer closing",
        placeholderKey: "closing",
        defaultChecked: true,
        enableWhenTextPresent: true
      }),
      Object.freeze({
        kind: "toggle",
        field: "include_who_is_traveling",
        elsKey: "pdfOfferIncludeWhoIsTravelingMount",
        mountId: "booking_pdf_offer_include_who_is_traveling_mount",
        labelKey: "booking.pdf.travel_plan.include_who_is_traveling",
        labelFallback: "Who is traveling",
        defaultChecked: true,
        previewKey: ""
      })
    ])
  }),
  Object.freeze({
    scope: "booking_confirmation",
    panelElsKey: "bookingConfirmationPdfPersonalizationPanel",
    referenceElsKey: "pdfBookingConfirmationReference",
    referenceMountId: "booking_pdf_booking_confirmation_reference",
    title: "PDF Texts",
    variant: "collapsible",
    initiallyOpen: false,
    items: Object.freeze([
      Object.freeze({
        kind: "localized",
        field: "subtitle",
        includeField: "include_subtitle",
        elsKey: "pdfBookingConfirmationSubtitleMount",
        mountId: "booking_pdf_booking_confirmation_subtitle_mount",
        rows: 2,
        labelKey: "booking.pdf.booking_confirmation.subtitle",
        labelFallback: "Payment confirmation subtitle",
        placeholderKey: "subtitle",
        defaultChecked: false,
        enableWhenTextPresent: true
      }),
      Object.freeze({
        kind: "localized",
        field: "welcome",
        includeField: "include_welcome",
        elsKey: "pdfBookingConfirmationWelcomeMount",
        mountId: "booking_pdf_booking_confirmation_welcome_mount",
        rows: 3,
        labelKey: "booking.pdf.booking_confirmation.welcome",
        labelFallback: "Payment confirmation welcome",
        placeholderKey: "",
        defaultChecked: true,
        enableWhenTextPresent: true
      }),
      Object.freeze({
        kind: "localized",
        field: "closing",
        includeField: "include_closing",
        elsKey: "pdfBookingConfirmationClosingMount",
        mountId: "booking_pdf_booking_confirmation_closing_mount",
        rows: 3,
        labelKey: "booking.pdf.booking_confirmation.closing",
        labelFallback: "Payment confirmation closing",
        placeholderKey: "closing",
        defaultChecked: true,
        enableWhenTextPresent: true
      })
    ])
  })
]);

const BOOKING_PDF_PERSONALIZATION_PANEL_BY_SCOPE = Object.freeze(
  Object.fromEntries(BOOKING_PDF_PERSONALIZATION_PANELS.map((config) => [config.scope, config]))
);

function buildPdfFieldMountsMarkup(config) {
  return config.items
    .map((item) => {
      if (item.mountId) return `<div id="${item.mountId}"></div>`;
      if (item.mountDataKey) return `<div data-booking-pdf-mount="${item.mountDataKey}"></div>`;
      return "<div></div>";
    })
    .join("");
}

function buildPdfReferenceMarkup(config) {
  return `
    <aside class="booking-pdf-reference">
      <div class="booking-pdf-reference__head">
        <h3 class="booking-pdf-reference__title booking-pdf-reference__title--compact" data-i18n-id="booking.pdf.reference.web_form_title">Web form submission:</h3>
      </div>
      <div id="${config.referenceMountId}"></div>
    </aside>
  `;
}

function buildPdfPanelBodyMarkup(config) {
  const titleMarkup = config.variant === "static"
    ? `<h3 class="booking-pdf-panel__title">${config.title}</h3>`
    : "";
  return `
    <div class="booking-pdf-panel__body">
      ${titleMarkup}
      <div class="booking-pdf-panel__fields">
        ${buildPdfFieldMountsMarkup(config)}
      </div>
      ${buildPdfReferenceMarkup(config)}
    </div>
  `;
}

function renderCollapsiblePdfPanel(panel, config) {
  panel.className = "booking-collapsible";
  panel.dataset.bookingPdfPanel = config.scope;
  panel.classList.toggle("is-open", config.initiallyOpen === true);
  panel.innerHTML = `
    <div class="booking-collapsible__head">
      <button class="booking-collapsible__summary booking-section__summary--inline-pad-16" type="button">
        <span class="backend-section-header">
          <span class="backend-section-header__primary">${config.title}</span>
        </span>
      </button>
    </div>
    <div class="booking-collapsible__body">
      ${buildPdfPanelBodyMarkup(config)}
    </div>
  `;
}

function renderStaticPdfPanel(panel, config) {
  panel.className = "booking-pdf-panel booking-pdf-panel--spaced";
  panel.dataset.bookingPdfPanel = config.scope;
  panel.innerHTML = buildPdfPanelBodyMarkup(config);
}

function findElementById(root, id) {
  if (root && typeof root.getElementById === "function") {
    return root.getElementById(id);
  }
  if (!(root instanceof HTMLElement)) return null;
  return root.querySelector(`#${id}`);
}

function findElementBySelector(root, selector) {
  if (!root || typeof root.querySelector !== "function") return null;
  return root.querySelector(selector);
}

function resolvePdfPanelElement(config, root) {
  return findElementById(root, config.referenceMountId);
}

function resolvePdfItemElements(config, root) {
  return Object.fromEntries(
    config.items.map((item) => {
      if (item.mountId) return [item.elsKey, findElementById(root, item.mountId)];
      if (item.mountDataKey) return [item.elsKey, findElementBySelector(root, `[data-booking-pdf-mount="${item.mountDataKey}"]`)];
      return [item.elsKey, null];
    })
  );
}

export function getBookingPdfPersonalizationPanelConfig(scope) {
  return BOOKING_PDF_PERSONALIZATION_PANEL_BY_SCOPE[String(scope || "").trim()] || null;
}

export function getBookingPdfPersonalizationItemConfig(scope, field) {
  const panel = getBookingPdfPersonalizationPanelConfig(scope);
  if (!panel) return null;
  const normalizedField = String(field || "").trim();
  return panel.items.find((item) => item.field === normalizedField || item.includeField === normalizedField) || null;
}

export function renderBookingPdfPersonalizationPanels(els) {
  if (!els || typeof els !== "object") return;
  BOOKING_PDF_PERSONALIZATION_PANELS.forEach((config) => {
    const panel = els[config.panelElsKey];
    if (!(panel instanceof HTMLElement)) return;
    if (config.variant === "collapsible") {
      renderCollapsiblePdfPanel(panel, config);
      return;
    }
    renderStaticPdfPanel(panel, config);
  });
}

export function resolveBookingPdfPersonalizationElements(root = document) {
  return Object.assign({}, ...BOOKING_PDF_PERSONALIZATION_PANELS.map((config) => ({
    [config.referenceElsKey]: resolvePdfPanelElement(config, root),
    ...resolvePdfItemElements(config, root)
  })));
}

export {
  BOOKING_PDF_PERSONALIZATION_PANELS
};
