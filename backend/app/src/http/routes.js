export const CONTRACT_ROUTE_DEFINITIONS = Object.freeze([
  { method: "GET", path: "/public/v1/mobile/bootstrap", handlerKey: "handleMobileBootstrap" },
  { method: "GET", path: "/public/v1/tours", handlerKey: "handlePublicListTours" },
  { method: "GET", path: "/public/v1/team", handlerKey: "handleListPublicAtpStaffProfiles" },
  { method: "POST", path: "/public/v1/bookings", handlerKey: "handleCreateBooking" },
  { method: "POST", path: "/api/v1/bookings", handlerKey: "handleCreateBackendBooking" },
  { method: "GET", path: "/public/v1/bookings/{booking_id}/persons/{person_id}/traveler-details/access", handlerKey: "handleGetPublicTravelerDetailsAccess" },
  { method: "PATCH", path: "/public/v1/bookings/{booking_id}/persons/{person_id}/traveler-details", handlerKey: "handlePatchPublicTravelerDetails" },
  { method: "POST", path: "/public/v1/bookings/{booking_id}/persons/{person_id}/documents/{document_type}/picture", handlerKey: "handleUploadPublicTravelerDocumentPicture" },
  { method: "GET", path: "/api/v1/bookings", handlerKey: "handleListBookings" },
  { method: "GET", path: "/api/v1/bookings/{booking_id}", handlerKey: "handleGetBooking" },
  { method: "DELETE", path: "/api/v1/bookings/{booking_id}", handlerKey: "handleDeleteBooking" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/clone", handlerKey: "handleCloneBooking" },
  { method: "GET", path: "/api/v1/bookings/{booking_id}/chat", handlerKey: "handleListBookingChatEvents" },
  { method: "PATCH", path: "/api/v1/bookings/{booking_id}/name", handlerKey: "handlePatchBookingName" },
  { method: "PATCH", path: "/api/v1/bookings/{booking_id}/customer-language", handlerKey: "handlePatchBookingCustomerLanguage" },
  { method: "PATCH", path: "/api/v1/bookings/{booking_id}/source", handlerKey: "handlePatchBookingSource" },
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
  { method: "POST", path: "/api/v1/bookings/{booking_id}/travel-plan/pdfs", handlerKey: "handlePostBookingTravelPlanPdf" },
  { method: "GET", path: "/api/v1/bookings/{booking_id}/travel-plan/pdfs/{artifact_id}/pdf", handlerKey: "handleGetBookingTravelPlanPdfArtifact" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/travel-plan/translate", handlerKey: "handleTranslateBookingTravelPlanFromEnglish" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/travel-plan/days/import", handlerKey: "handleImportTravelPlanDay" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/travel-plan/tours/{tour_id}/apply", handlerKey: "handleApplyTourToBooking" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/travel-plan/days/{day_id}/services/import", handlerKey: "handleImportTravelPlanService" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/travel-plan/days/{day_id}/services/{service_id}/image", handlerKey: "handleUploadTravelPlanServiceImage" },
  { method: "DELETE", path: "/api/v1/bookings/{booking_id}/travel-plan/days/{day_id}/services/{service_id}/image", handlerKey: "handleDeleteTravelPlanServiceImage" },
  { method: "GET", path: "/api/v1/bookings/{booking_id}/travel-plan/attachments/{attachment_id}/pdf", handlerKey: "handleGetTravelPlanAttachmentPdf" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/travel-plan/attachments", handlerKey: "handleUploadTravelPlanAttachment" },
  { method: "DELETE", path: "/api/v1/bookings/{booking_id}/travel-plan/attachments/{attachment_id}", handlerKey: "handleDeleteTravelPlanAttachment" },
  { method: "PATCH", path: "/api/v1/bookings/{booking_id}/travel-plan/pdfs/{artifact_id}", handlerKey: "handlePatchBookingTravelPlanPdfArtifact" },
  { method: "DELETE", path: "/api/v1/bookings/{booking_id}/travel-plan/pdfs/{artifact_id}", handlerKey: "handleDeleteBookingTravelPlanPdfArtifact" },
  { method: "PATCH", path: "/api/v1/bookings/{booking_id}/offer", handlerKey: "handlePatchBookingOffer" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/generated-offers", handlerKey: "handleGenerateBookingOffer" },
  { method: "PATCH", path: "/api/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}", handlerKey: "handlePatchGeneratedBookingOffer" },
  { method: "DELETE", path: "/api/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}", handlerKey: "handleDeleteGeneratedBookingOffer" },
  { method: "GET", path: "/api/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}/pdf", handlerKey: "handleGetGeneratedOfferPdf" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}/gmail-draft", handlerKey: "handleCreateGeneratedOfferGmailDraft" },
  { method: "POST", path: "/api/v1/offers/exchange-rates", handlerKey: "handlePostOfferExchangeRates" },
  { method: "GET", path: "/api/v1/bookings/{booking_id}/activities", handlerKey: "handleListActivities" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/activities", handlerKey: "handleCreateActivity" },
  { method: "GET", path: "/api/v1/bookings/{booking_id}/payment-documents", handlerKey: "handleListBookingPaymentDocuments" },
  { method: "POST", path: "/api/v1/bookings/{booking_id}/payment-documents", handlerKey: "handleCreateBookingPaymentDocument" },
  { method: "GET", path: "/api/v1/payment-documents/{document_id}/pdf", handlerKey: "handleGetPaymentDocumentPdf" },
  { method: "GET", path: "/api/v1/keycloak_users", handlerKey: "handleListKeycloakUsers" },
  { method: "GET", path: "/api/v1/settings/observability", handlerKey: "handleGetSettingsObservability" },
  { method: "GET", path: "/api/v1/settings/translation-rules", handlerKey: "handleGetSettingsTranslationRules" },
  { method: "PATCH", path: "/api/v1/settings/translation-rules", handlerKey: "handlePatchSettingsTranslationRules" },
  { method: "GET", path: "/api/v1/staff-profiles", handlerKey: "handleListAtpStaffDirectoryEntries" },
  { method: "PATCH", path: "/api/v1/keycloak_users/{username}/staff-profile", handlerKey: "handlePatchAtpStaffProfile" },
  { method: "POST", path: "/api/v1/keycloak_users/{username}/staff-profile/translate-fields", handlerKey: "handleTranslateAtpStaffProfileFields" },
  { method: "POST", path: "/api/v1/keycloak_users/{username}/staff-profile/picture", handlerKey: "handleUploadAtpStaffPhoto" },
  { method: "DELETE", path: "/api/v1/keycloak_users/{username}/staff-profile/picture", handlerKey: "handleDeleteAtpStaffPhoto" },
  { method: "GET", path: "/api/v1/country-reference-info", handlerKey: "handleListCountryReferenceInfo" },
  { method: "PATCH", path: "/api/v1/country-reference-info", handlerKey: "handlePatchCountryReferenceInfo" },
  { method: "GET", path: "/api/v1/destination-scope/catalog", handlerKey: "handleListDestinationScopeCatalog" },
  { method: "POST", path: "/api/v1/destination-scope/destinations", handlerKey: "handleCreateDestinationScopeDestination" },
  { method: "POST", path: "/api/v1/destination-scope/areas", handlerKey: "handleCreateDestinationArea" },
  { method: "POST", path: "/api/v1/destination-scope/places", handlerKey: "handleCreateDestinationPlace" },
  { method: "GET", path: "/api/v1/tours", handlerKey: "handleListTours" },
  { method: "GET", path: "/api/v1/tours/travel-plan-days/search", handlerKey: "handleSearchTourTravelPlanDays" },
  { method: "GET", path: "/api/v1/tours/travel-plan-services/search", handlerKey: "handleSearchTourTravelPlanServices" },
  { method: "GET", path: "/api/v1/tours/{tour_id}", handlerKey: "handleGetTour" },
  { method: "POST", path: "/api/v1/tours/translate-fields", handlerKey: "handleTranslateTourFields" },
  { method: "POST", path: "/api/v1/tours", handlerKey: "handleCreateTour" },
  { method: "PATCH", path: "/api/v1/tours/{tour_id}", handlerKey: "handlePatchTour" },
  { method: "DELETE", path: "/api/v1/tours/{tour_id}", handlerKey: "handleDeleteTour" },
  { method: "PATCH", path: "/api/v1/tours/{tour_id}/travel-plan", handlerKey: "handlePatchTourTravelPlan" },
  { method: "POST", path: "/api/v1/tours/{tour_id}/travel-plan/days/import", handlerKey: "handleImportTourTravelPlanDay" },
  { method: "POST", path: "/api/v1/tours/{tour_id}/travel-plan/days/{day_id}/services/import", handlerKey: "handleImportTourTravelPlanService" },
  { method: "POST", path: "/api/v1/tours/{tour_id}/travel-plan/days/{day_id}/services/{service_id}/image", handlerKey: "handleUploadTourTravelPlanServiceImage" },
  { method: "DELETE", path: "/api/v1/tours/{tour_id}/travel-plan/days/{day_id}/services/{service_id}/image", handlerKey: "handleDeleteTourTravelPlanServiceImage" },
  { method: "GET", path: "/auth/me", handlerKey: "handleAuthMe" }
]);

const OPERATIONAL_ROUTE_DEFINITIONS = Object.freeze([
  { method: "GET", pattern: /^\/health$/, handlerKey: "handleHealth" },
  { method: "GET", pattern: /^\/integrations\/meta\/webhook\/status$/, handlerKey: "handleMetaWebhookStatus" },
  { method: "GET", pattern: /^\/integrations\/meta\/webhook$/, handlerKey: "handleMetaWebhookVerify" },
  { method: "POST", pattern: /^\/integrations\/meta\/webhook$/, handlerKey: "handleMetaWebhookIngest" },
  { method: "GET", pattern: /^\/backend-access\/check$/, handlerKey: "handleBackendAccessCheck" },
  { method: "GET", pattern: /^\/staging-access\/login$/, handlerKey: "handleStagingAccessLoginPage" },
  { method: "POST", pattern: /^\/staging-access\/login$/, handlerKey: "handleStagingAccessLoginSubmit" },
  { method: "GET", pattern: /^\/staging-access\/check$/, handlerKey: "handleStagingAccessCheck" },
  { method: "GET", pattern: /^\/staging-access\/logout$/, handlerKey: "handleStagingAccessLogout" },
  { method: "GET", pattern: /^\/api\/v1\/static-translations\/domains$/, handlerKey: "handleListStaticTranslationDomains" },
  { method: "GET", pattern: /^\/api\/v1\/static-translations\/status$/, handlerKey: "handleGetStaticTranslationStatus" },
  { method: "GET", pattern: /^\/api\/v1\/static-translations\/([^/]+)\/languages$/, handlerKey: "handleListStaticTranslationLanguages" },
  { method: "POST", pattern: /^\/api\/v1\/static-translations\/apply$/, handlerKey: "handleStartStaticTranslationApply" },
  { method: "POST", pattern: /^\/api\/v1\/static-translations\/publish$/, handlerKey: "handleStartStaticTranslationPublish" },
  { method: "POST", pattern: /^\/api\/v1\/static-translations\/retranslate$/, handlerKey: "handleStartStaticTranslationRetranslate" },
  { method: "GET", pattern: /^\/api\/v1\/static-translations\/apply\/([^/]+)$/, handlerKey: "handleGetStaticTranslationApplyJob" },
  { method: "GET", pattern: /^\/api\/v1\/static-translations\/([^/]+)\/([^/]+)$/, handlerKey: "handleGetStaticTranslationLanguageState" },
  { method: "PATCH", pattern: /^\/api\/v1\/static-translations\/([^/]+)\/([^/]+)\/overrides$/, handlerKey: "handlePatchStaticTranslationOverrides" },
  { method: "DELETE", pattern: /^\/api\/v1\/static-translations\/([^/]+)\/([^/]+)\/cache\/([^/]+)$/, handlerKey: "handleDeleteStaticTranslationCache" },
  { method: "GET", pattern: /^\/api\/v1\/tours\/([^/]+)\/one-pager\.pdf$/, handlerKey: "handleGetTourOnePagerPdf" },
  { method: "GET", pattern: /^\/public\/v1\/tours\/([^/]+)\/one-pager\.pdf$/, handlerKey: "handleGetPublicTourOnePagerPdf" },
  { method: "POST", pattern: /^\/api\/v1\/tours\/([^/]+)\/publish$/, handlerKey: "handlePublishTour" },
  { method: "GET", pattern: /^\/api\/v1\/tours\/([^/]+)\/video$/, handlerKey: "handleGetTourVideo" },
  { method: "POST", pattern: /^\/api\/v1\/tours\/([^/]+)\/video$/, handlerKey: "handleUploadTourVideo" },
  { method: "DELETE", pattern: /^\/api\/v1\/tours\/([^/]+)\/video$/, handlerKey: "handleDeleteTourVideo" },
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

function resolveRouteHandler(route, handlers) {
  const handler = handlers[route.handlerKey];
  if (typeof handler !== "function") {
    throw new Error(`Missing route handler for ${route.method} ${route.path || route.pattern}: ${route.handlerKey}`);
  }
  return handler;
}

function materializeContractRoutes(handlers) {
  return CONTRACT_ROUTE_DEFINITIONS.map((route) => ({
    method: route.method,
    pattern: pathTemplateToPattern(route.path),
    handler: resolveRouteHandler(route, handlers)
  }));
}

function materializeOperationalRoutes(handlers) {
  return OPERATIONAL_ROUTE_DEFINITIONS.map((route) => ({
    method: route.method,
    pattern: route.pattern,
    handler: resolveRouteHandler(route, handlers)
  }));
}

export function buildApiRoutes({ authRoutes = [], handlers }) {
  return [
    ...authRoutes,
    ...materializeOperationalRoutes(handlers),
    ...materializeContractRoutes(handlers)
  ];
}
