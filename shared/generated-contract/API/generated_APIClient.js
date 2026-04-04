    // Generated from api/generated/openapi.yaml.
// Do not edit by hand.

    import * as RequestFactory from './generated_APIRequestFactory.js';

    export class GeneratedAPIClient {
      constructor({ baseURL = '', fetchImpl = fetch, defaultHeaders = {} } = {}) {
        this.baseURL = baseURL;
        this.fetchImpl = fetchImpl;
        this.defaultHeaders = defaultHeaders;
      }

      buildRequest(key, options = {}) {
        switch (key) {
case "mobile_bootstrap":
  return RequestFactory.mobileBootstrapRequest(options);
case "auth_me":
  return RequestFactory.authMeRequest(options);
case "public_bookings":
  return RequestFactory.publicBookingsRequest(options);
case "public_generated_offer_access":
  return RequestFactory.publicGeneratedOfferAccessRequest(options);
case "public_generated_booking_confirmation":
  return RequestFactory.publicGeneratedBookingConfirmationRequest(options);
case "public_generated_offer_pdf":
  return RequestFactory.publicGeneratedOfferPdfRequest(options);
case "public_traveler_details_access":
  return RequestFactory.publicTravelerDetailsAccessRequest(options);
case "public_traveler_details_update":
  return RequestFactory.publicTravelerDetailsUpdateRequest(options);
case "public_traveler_document_picture_upload":
  return RequestFactory.publicTravelerDocumentPictureUploadRequest(options);
case "booking_person_traveler_details_link":
  return RequestFactory.bookingPersonTravelerDetailsLinkRequest(options);
case "public_tours":
  return RequestFactory.publicToursRequest(options);
case "public_atp_staff_team":
  return RequestFactory.publicAtpStaffTeamRequest(options);
case "bookings":
  return RequestFactory.bookingsRequest(options);
case "booking_create":
  return RequestFactory.bookingCreateRequest(options);
case "booking_detail":
  return RequestFactory.bookingDetailRequest(options);
case "booking_delete":
  return RequestFactory.bookingDeleteRequest(options);
case "booking_clone":
  return RequestFactory.bookingCloneRequest(options);
case "booking_chat":
  return RequestFactory.bookingChatRequest(options);
case "booking_name":
  return RequestFactory.bookingNameRequest(options);
case "booking_customer_language":
  return RequestFactory.bookingCustomerLanguageRequest(options);
case "booking_source":
  return RequestFactory.bookingSourceRequest(options);
case "booking_image":
  return RequestFactory.bookingImageRequest(options);
case "booking_owner":
  return RequestFactory.bookingOwnerRequest(options);
case "booking_milestone_action":
  return RequestFactory.bookingMilestoneActionRequest(options);
case "booking_translate_fields":
  return RequestFactory.bookingTranslateFieldsRequest(options);
case "booking_person_create":
  return RequestFactory.bookingPersonCreateRequest(options);
case "booking_person_update":
  return RequestFactory.bookingPersonUpdateRequest(options);
case "booking_person_delete":
  return RequestFactory.bookingPersonDeleteRequest(options);
case "booking_person_photo":
  return RequestFactory.bookingPersonPhotoRequest(options);
case "booking_person_document_picture":
  return RequestFactory.bookingPersonDocumentPictureRequest(options);
case "booking_notes":
  return RequestFactory.bookingNotesRequest(options);
case "booking_travel_plan":
  return RequestFactory.bookingTravelPlanRequest(options);
case "booking_travel_plan_pdf":
  return RequestFactory.bookingTravelPlanPdfRequest(options);
case "booking_travel_plan_attachment_pdf":
  return RequestFactory.bookingTravelPlanAttachmentPdfRequest(options);
case "booking_travel_plan_translate":
  return RequestFactory.bookingTravelPlanTranslateRequest(options);
case "travel_plan_day_search":
  return RequestFactory.travelPlanDaySearchRequest(options);
case "travel_plan_search":
  return RequestFactory.travelPlanSearchRequest(options);
case "travel_plan_service_search":
  return RequestFactory.travelPlanServiceSearchRequest(options);
case "booking_travel_plan_day_import":
  return RequestFactory.bookingTravelPlanDayImportRequest(options);
case "booking_travel_plan_import":
  return RequestFactory.bookingTravelPlanImportRequest(options);
case "travel_plan_templates":
  return RequestFactory.travelPlanTemplatesRequest(options);
case "travel_plan_template_create":
  return RequestFactory.travelPlanTemplateCreateRequest(options);
case "travel_plan_template_detail":
  return RequestFactory.travelPlanTemplateDetailRequest(options);
case "travel_plan_template_update":
  return RequestFactory.travelPlanTemplateUpdateRequest(options);
case "travel_plan_template_delete":
  return RequestFactory.travelPlanTemplateDeleteRequest(options);
case "booking_travel_plan_template_apply":
  return RequestFactory.bookingTravelPlanTemplateApplyRequest(options);
case "booking_travel_plan_service_import":
  return RequestFactory.bookingTravelPlanServiceImportRequest(options);
case "booking_travel_plan_service_image_upload":
  return RequestFactory.bookingTravelPlanServiceImageUploadRequest(options);
case "booking_travel_plan_service_image_delete":
  return RequestFactory.bookingTravelPlanServiceImageDeleteRequest(options);
case "booking_travel_plan_attachment_upload":
  return RequestFactory.bookingTravelPlanAttachmentUploadRequest(options);
case "booking_travel_plan_attachment_delete":
  return RequestFactory.bookingTravelPlanAttachmentDeleteRequest(options);
case "booking_travel_plan_pdf_create":
  return RequestFactory.bookingTravelPlanPdfCreateRequest(options);
case "booking_travel_plan_pdf_artifact_pdf":
  return RequestFactory.bookingTravelPlanPdfArtifactPdfRequest(options);
case "booking_travel_plan_pdf_update":
  return RequestFactory.bookingTravelPlanPdfUpdateRequest(options);
case "booking_travel_plan_pdf_delete":
  return RequestFactory.bookingTravelPlanPdfDeleteRequest(options);
case "booking_pricing":
  return RequestFactory.bookingPricingRequest(options);
case "booking_offer":
  return RequestFactory.bookingOfferRequest(options);
case "booking_offer_translate":
  return RequestFactory.bookingOfferTranslateRequest(options);
case "booking_generate_offer":
  return RequestFactory.bookingGenerateOfferRequest(options);
case "booking_generated_offer_update":
  return RequestFactory.bookingGeneratedOfferUpdateRequest(options);
case "booking_generated_offer_delete":
  return RequestFactory.bookingGeneratedOfferDeleteRequest(options);
case "booking_generated_offer_pdf":
  return RequestFactory.bookingGeneratedOfferPdfRequest(options);
case "booking_generated_offer_gmail_draft":
  return RequestFactory.bookingGeneratedOfferGmailDraftRequest(options);
case "offer_exchange_rates":
  return RequestFactory.offerExchangeRatesRequest(options);
case "suppliers":
  return RequestFactory.suppliersRequest(options);
case "supplier_create":
  return RequestFactory.supplierCreateRequest(options);
case "supplier_detail":
  return RequestFactory.supplierDetailRequest(options);
case "supplier_update":
  return RequestFactory.supplierUpdateRequest(options);
case "country_reference_info":
  return RequestFactory.countryReferenceInfoRequest(options);
case "country_reference_info_update":
  return RequestFactory.countryReferenceInfoUpdateRequest(options);
case "booking_activities":
  return RequestFactory.bookingActivitiesRequest(options);
case "booking_activity_create":
  return RequestFactory.bookingActivityCreateRequest(options);
case "booking_invoices":
  return RequestFactory.bookingInvoicesRequest(options);
case "booking_invoice_create":
  return RequestFactory.bookingInvoiceCreateRequest(options);
case "booking_invoice_update":
  return RequestFactory.bookingInvoiceUpdateRequest(options);
case "booking_invoice_translate":
  return RequestFactory.bookingInvoiceTranslateRequest(options);
case "invoice_pdf":
  return RequestFactory.invoicePdfRequest(options);
case "keycloak_users":
  return RequestFactory.keycloakUsersRequest(options);
case "staff_profiles":
  return RequestFactory.staffProfilesRequest(options);
case "keycloak_user_staff_profile_update":
  return RequestFactory.keycloakUserStaffProfileUpdateRequest(options);
case "keycloak_user_staff_profile_translate_fields":
  return RequestFactory.keycloakUserStaffProfileTranslateFieldsRequest(options);
case "keycloak_user_staff_profile_picture_upload":
  return RequestFactory.keycloakUserStaffProfilePictureUploadRequest(options);
case "keycloak_user_staff_profile_picture_delete":
  return RequestFactory.keycloakUserStaffProfilePictureDeleteRequest(options);
case "tours":
  return RequestFactory.toursRequest(options);
case "tour_create":
  return RequestFactory.tourCreateRequest(options);
case "tour_detail":
  return RequestFactory.tourDetailRequest(options);
case "tour_update":
  return RequestFactory.tourUpdateRequest(options);
case "tour_delete":
  return RequestFactory.tourDeleteRequest(options);
case "tour_translate_fields":
  return RequestFactory.tourTranslateFieldsRequest(options);
case "tour_image":
  return RequestFactory.tourImageRequest(options);
      default:
            throw new Error(`Unknown generated endpoint ${key}`);
        }
      }

      async request(key, { parseAs = 'json', ...options } = {}) {
        const request = this.buildRequest(key, { ...options, baseURL: this.baseURL });
        const headers = { ...this.defaultHeaders, ...(request.headers || {}) };
        const init = { method: request.method, headers };
        if (request.body !== undefined) {
          init.body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
          if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
        }
        const response = await this.fetchImpl(request.url, init);
        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status} ${response.statusText}: ${detail}`);
        }
        if (parseAs === 'text') return response.text();
        if (response.status === 204) return null;
        return response.json();
      }
    }
