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
case "booking_delete":
  return RequestFactory.bookingDeleteRequest(options);
case "booking_chat":
  return RequestFactory.bookingChatRequest(options);
case "booking_name":
  return RequestFactory.bookingNameRequest(options);
case "booking_stage":
  return RequestFactory.bookingStageRequest(options);
case "booking_owner":
  return RequestFactory.bookingOwnerRequest(options);
case "booking_person_create":
  return RequestFactory.bookingPersonCreateRequest(options);
case "booking_person_update":
  return RequestFactory.bookingPersonUpdateRequest(options);
case "booking_person_delete":
  return RequestFactory.bookingPersonDeleteRequest(options);
case "booking_person_photo":
  return RequestFactory.bookingPersonPhotoRequest(options);
case "booking_notes":
  return RequestFactory.bookingNotesRequest(options);
case "booking_pricing":
  return RequestFactory.bookingPricingRequest(options);
case "booking_offer":
  return RequestFactory.bookingOfferRequest(options);
case "offer_exchange_rates":
  return RequestFactory.offerExchangeRatesRequest(options);
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
case "atp_staff":
  return RequestFactory.atpStaffRequest(options);
case "atp_staff_create":
  return RequestFactory.atpStaffCreateRequest(options);
case "tours":
  return RequestFactory.toursRequest(options);
case "tour_create":
  return RequestFactory.tourCreateRequest(options);
case "tour_detail":
  return RequestFactory.tourDetailRequest(options);
case "tour_update":
  return RequestFactory.tourUpdateRequest(options);
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
