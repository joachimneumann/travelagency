export const CONTRACT_ROUTE_DEFINITIONS = Object.freeze([
  { method: "GET", path: "/public/v1/mobile/bootstrap", handlerKey: "handleMobileBootstrap" },
  { method: "GET", path: "/public/v1/tours", handlerKey: "handlePublicListTours" },
  { method: "POST", path: "/public/v1/bookings", handlerKey: "handleCreateBooking" },
  { method: "GET", path: "/public/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}/access", handlerKey: "handleGetPublicGeneratedOfferAccess" },
  { method: "GET", path: "/public/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}/pdf", handlerKey: "handleGetPublicGeneratedOfferPdf" },
  { method: "POST", path: "/public/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}/accept", handlerKey: "handlePublicAcceptGeneratedOffer" },
  { method: "GET", path: "/public/v1/bookings/{booking_id}/persons/{person_id}/traveler-details/access", handlerKey: "handleGetPublicTravelerDetailsAccess" },
  { method: "PATCH", path: "/public/v1/bookings/{booking_id}/persons/{person_id}/traveler-details", handlerKey: "handlePatchPublicTravelerDetails" },
  { method: "GET", path: "/api/v1/bookings", handlerKey: "handleListBookings" },
  { method: "GET", path: "/api/v1/bookings/{booking_id}", handlerKey: "handleGetBooking" },
  { method: "DELETE", path: "/api/v1/bookings/{booking_id}", handlerKey: "handleDeleteBooking" },
  { method: "GET", path: "/api/v1/bookings/{booking_id}/chat", handlerKey: "handleListBookingChatEvents" },
  { method: "PATCH", path: "/api/v1/bookings/{booking_id}/name", handlerKey: "handlePatchBookingName" },
  { method: "PATCH", path: "/api/v1/bookings/{booking_id}/customer-language", handlerKey: "handlePatchBookingCustomerLanguage" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/milestone-actions", handlerKey: "handlePostBookingMilestoneAction" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/translate-fields", handlerKey: "handleTranslateBookingFields" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/image", handlerKey: "handleUploadBookingImage" },
  { method: "PATCH", path: "/api/v1/bookings/{booking_id}/owner", handlerKey: "handlePatchBookingOwner" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/persons", handlerKey: "handleCreateBookingPerson" },
  { method: "PATCH", path: "/api/v1/bookings/{booking_id}/persons/{person_id}", handlerKey: "handlePatchBookingPerson" },
  { method: "DELETE", path: "/api/v1/bookings/{booking_id}/persons/{person_id}", handlerKey: "handleDeleteBookingPerson" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/persons/{person_id}/photo", handlerKey: "handleUploadBookingPersonPhoto" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/persons/{person_id}/documents/{document_type}/picture", handlerKey: "handleUploadBookingPersonDocumentPicture" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/persons/{person_id}/traveler-details-link", handlerKey: "handlePostBookingPersonTravelerDetailsLink" },
  { method: "PATCH", path: "/api/v1/bookings/{booking_id}/notes", handlerKey: "handlePatchBookingNotes" },
  { method: "PATCH", path: "/api/v1/bookings/{booking_id}/travel-plan", handlerKey: "handlePatchBookingTravelPlan" },
  { method: "GET", path: "/api/v1/bookings/{booking_id}/travel-plan/pdf", handlerKey: "handleGetBookingTravelPlanPdf" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/travel-plan/translate", handlerKey: "handleTranslateBookingTravelPlanFromEnglish" },
  { method: "GET", path: "/api/v1/travel-plan-items/search", handlerKey: "handleSearchTravelPlanItems" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/travel-plan/days/{day_id}/items/import", handlerKey: "handleImportTravelPlanItem" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/travel-plan/days/{day_id}/items/{item_id}/images", handlerKey: "handleUploadTravelPlanItemImage" },
  { method: "DELETE", path: "/api/v1/bookings/{booking_id}/travel-plan/days/{day_id}/items/{item_id}/images/{image_id}", handlerKey: "handleDeleteTravelPlanItemImage" },
  { method: "PATCH", path: "/api/v1/bookings/{booking_id}/travel-plan/days/{day_id}/items/{item_id}/images/order", handlerKey: "handleReorderTravelPlanItemImages" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/travel-plan/attachments", handlerKey: "handleUploadTravelPlanAttachment" },
  { method: "DELETE", path: "/api/v1/bookings/{booking_id}/travel-plan/attachments/{attachment_id}", handlerKey: "handleDeleteTravelPlanAttachment" },
  { method: "PATCH", path: "/api/v1/bookings/{booking_id}/pricing", handlerKey: "handlePatchBookingPricing" },
  { method: "PATCH", path: "/api/v1/bookings/{booking_id}/offer", handlerKey: "handlePatchBookingOffer" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/offer/translate", handlerKey: "handleTranslateBookingOfferFromEnglish" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/generated-offers", handlerKey: "handleGenerateBookingOffer" },
  { method: "PATCH", path: "/api/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}", handlerKey: "handlePatchGeneratedBookingOffer" },
  { method: "DELETE", path: "/api/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}", handlerKey: "handleDeleteGeneratedBookingOffer" },
  { method: "GET", path: "/api/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}/pdf", handlerKey: "handleGetGeneratedOfferPdf" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}/gmail-draft", handlerKey: "handleCreateGeneratedOfferGmailDraft" },
  { method: "POST", path: "/api/v1/offers/exchange-rates", handlerKey: "handlePostOfferExchangeRates" },
  { method: "GET", path: "/api/v1/bookings/{booking_id}/activities", handlerKey: "handleListActivities" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/activities", handlerKey: "handleCreateActivity" },
  { method: "GET", path: "/api/v1/bookings/{booking_id}/invoices", handlerKey: "handleListBookingInvoices" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/invoices", handlerKey: "handleCreateBookingInvoice" },
  { method: "PATCH", path: "/api/v1/bookings/{booking_id}/invoices/{invoice_id}", handlerKey: "handlePatchBookingInvoice" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/invoices/{invoice_id}/translate", handlerKey: "handleTranslateBookingInvoiceFromEnglish" },
  { method: "GET", path: "/api/v1/invoices/{invoice_id}/pdf", handlerKey: "handleGetInvoicePdf" },
  { method: "GET", path: "/api/v1/keycloak_users", handlerKey: "handleListKeycloakUsers" },
  { method: "PATCH", path: "/api/v1/keycloak_users/{username}/staff-profile", handlerKey: "handlePatchAtpStaffProfile" },
  { method: "POST", path: "/api/v1/keycloak_users/{username}/staff-profile/picture", handlerKey: "handleUploadAtpStaffPhoto" },
  { method: "DELETE", path: "/api/v1/keycloak_users/{username}/staff-profile/picture", handlerKey: "handleDeleteAtpStaffPhoto" },
  { method: "GET", path: "/api/v1/suppliers", handlerKey: "handleListSuppliers" },
  { method: "GET", path: "/api/v1/suppliers/{supplier_id}", handlerKey: "handleGetSupplier" },
  { method: "POST", path: "/api/v1/suppliers", handlerKey: "handleCreateSupplier" },
  { method: "PATCH", path: "/api/v1/suppliers/{supplier_id}", handlerKey: "handlePatchSupplier" },
  { method: "GET", path: "/api/v1/tours", handlerKey: "handleListTours" },
  { method: "GET", path: "/api/v1/tours/{tour_id}", handlerKey: "handleGetTour" },
  { method: "POST", path: "/api/v1/tours/translate-fields", handlerKey: "handleTranslateTourFields" },
  { method: "POST", path: "/api/v1/tours", handlerKey: "handleCreateTour" },
  { method: "PATCH", path: "/api/v1/tours/{tour_id}", handlerKey: "handlePatchTour" },
  { method: "POST", path: "/api/v1/tours/{tour_id}/image", handlerKey: "handleUploadTourImage" },
  { method: "GET", path: "/auth/me", handlerKey: "handleAuthMe" }
]);

const OPERATIONAL_ROUTE_DEFINITIONS = Object.freeze([
  { method: "GET", pattern: /^\/health$/, handlerKey: "handleHealth" },
  { method: "GET", pattern: /^\/integrations\/meta\/webhook\/status$/, handlerKey: "handleMetaWebhookStatus" },
  { method: "GET", pattern: /^\/integrations\/meta\/webhook$/, handlerKey: "handleMetaWebhookVerify" },
  { method: "POST", pattern: /^\/integrations\/meta\/webhook$/, handlerKey: "handleMetaWebhookIngest" },
  { method: "GET", pattern: /^\/staging-access\/login$/, handlerKey: "handleStagingAccessLoginPage" },
  { method: "POST", pattern: /^\/staging-access\/login$/, handlerKey: "handleStagingAccessLoginSubmit" },
  { method: "GET", pattern: /^\/staging-access\/check$/, handlerKey: "handleStagingAccessCheck" },
  { method: "GET", pattern: /^\/staging-access\/logout$/, handlerKey: "handleStagingAccessLogout" },
  { method: "GET", pattern: /^\/public\/v1\/tour-images\/(.+)$/, handlerKey: "handlePublicTourImage" },
  { method: "GET", pattern: /^\/public\/v1\/booking-images\/(.+)$/, handlerKey: "handlePublicBookingImage" },
  { method: "GET", pattern: /^\/public\/v1\/booking-person-photos\/(.+)$/, handlerKey: "handlePublicBookingPersonPhoto" },
  { method: "GET", pattern: /^\/public\/v1\/atp-staff-photos\/(.+)$/, handlerKey: "handlePublicAtpStaffPhoto" }
]);

function escapeRouteLiteral(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pathTemplateToPattern(pathTemplate) {
  const parts = String(pathTemplate).split(/(\{[^}]+\})/).filter(Boolean);
  const source = parts.map((part) => (part.startsWith("{") ? "([^/]+)" : escapeRouteLiteral(part))).join("");
  return new RegExp(`^${source}$`);
}

function materializeContractRoutes(handlers) {
  return CONTRACT_ROUTE_DEFINITIONS.map((route) => ({
    method: route.method,
    pattern: pathTemplateToPattern(route.path),
    handler: handlers[route.handlerKey]
  }));
}

function materializeOperationalRoutes(handlers) {
  return OPERATIONAL_ROUTE_DEFINITIONS.map((route) => ({
    method: route.method,
    pattern: route.pattern,
    handler: handlers[route.handlerKey]
  }));
}

export function buildApiRoutes({ authRoutes = [], handlers }) {
  return [
    ...authRoutes,
    ...materializeOperationalRoutes(handlers),
    ...materializeContractRoutes(handlers)
  ];
}
