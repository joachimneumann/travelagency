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
case "public_tours":
  return RequestFactory.publicToursRequest(options);
case "bookings":
  return RequestFactory.bookingsRequest(options);
case "booking_detail":
  return RequestFactory.bookingDetailRequest(options);
case "booking_chat":
  return RequestFactory.bookingChatRequest(options);
case "booking_stage":
  return RequestFactory.bookingStageRequest(options);
case "booking_assignment":
  return RequestFactory.bookingAssignmentRequest(options);
case "booking_note":
  return RequestFactory.bookingNoteRequest(options);
case "booking_client":
  return RequestFactory.bookingClientRequest(options);
case "booking_client_create_customer":
  return RequestFactory.bookingClientCreateCustomerRequest(options);
case "booking_client_create_group":
  return RequestFactory.bookingClientCreateGroupRequest(options);
case "booking_group_members":
  return RequestFactory.bookingGroupMembersRequest(options);
case "booking_pricing":
  return RequestFactory.bookingPricingRequest(options);
case "booking_offer":
  return RequestFactory.bookingOfferRequest(options);
case "booking_activities":
  return RequestFactory.bookingActivitiesRequest(options);
case "booking_invoices":
  return RequestFactory.bookingInvoicesRequest(options);
case "atp_staff":
  return RequestFactory.atpStaffRequest(options);
case "customers":
  return RequestFactory.customersRequest(options);
case "customer_detail":
  return RequestFactory.customerDetailRequest(options);
case "customer_update":
  return RequestFactory.customerUpdateRequest(options);
case "customer_photo_upload":
  return RequestFactory.customerPhotoUploadRequest(options);
case "customer_consent_create":
  return RequestFactory.customerConsentCreateRequest(options);
case "travel_groups":
  return RequestFactory.travelGroupsRequest(options);
case "travel_group_create":
  return RequestFactory.travelGroupCreateRequest(options);
case "travel_group_detail":
  return RequestFactory.travelGroupDetailRequest(options);
case "travel_group_update":
  return RequestFactory.travelGroupUpdateRequest(options);
case "tours":
  return RequestFactory.toursRequest(options);
case "tour_detail":
  return RequestFactory.tourDetailRequest(options);
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
