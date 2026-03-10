package api

#EndpointParameterLocation: "path" | "query" | "header" | "body"

#EndpointParameter: {
	name:         string & !=""
	location:     #EndpointParameterLocation
	required:     bool
	typeName:     string & !=""
	description?: string
}

#Endpoint: {
	key:           string & !=""
	path:          string & !=""
	method:        "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
	tag:           string & !=""
	authenticated: bool
	requestType?:  string
	responseType?: string
	parameters?:   [...#EndpointParameter]
}

#Endpoints: [
	{
		key:           "mobile_bootstrap"
		path:          "/public/v1/mobile/bootstrap"
		method:        "GET"
		tag:           "Public"
		authenticated: false
		responseType:  "MobileBootstrap"
	},
	{
		key:           "auth_me"
		path:          "/auth/me"
		method:        "GET"
		tag:           "Auth"
		authenticated: true
		responseType:  "AuthMeResponse"
	},
	{
		key:           "public_bookings"
		path:          "/public/v1/bookings"
		method:        "POST"
		tag:           "Public"
		authenticated: false
		requestType:   "PublicBookingCreateRequest"
		responseType:  "BookingDetail"
	},
	{
		key:           "public_tours"
		path:          "/public/v1/tours"
		method:        "GET"
		tag:           "Public"
		authenticated: false
		responseType:  "TourList"
	},
	{
		key:           "bookings"
		path:          "/api/v1/bookings"
		method:        "GET"
		tag:           "Bookings"
		authenticated: true
		responseType:  "BookingList"
	},
	{
		key:           "booking_detail"
		path:          "/api/v1/bookings/{booking_id}"
		method:        "GET"
		tag:           "Bookings"
		authenticated: true
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_delete"
		path:          "/api/v1/bookings/{booking_id}"
		method:        "DELETE"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingDeleteRequest"
		responseType:  "BookingDeleteResponse"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_chat"
		path:          "/api/v1/bookings/{booking_id}/chat"
		method:        "GET"
		tag:           "Bookings"
		authenticated: true
		responseType:  "BookingChatResponse"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_name"
		path:          "/api/v1/bookings/{booking_id}/name"
		method:        "PATCH"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingNameUpdateRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_stage"
		path:          "/api/v1/bookings/{booking_id}/stage"
		method:        "PATCH"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingStageUpdateRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_owner"
		path:          "/api/v1/bookings/{booking_id}/owner"
		method:        "PATCH"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingOwnerUpdateRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_person_create"
		path:          "/api/v1/bookings/{booking_id}/persons"
		method:        "POST"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingPersonCreateRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_person_update"
		path:          "/api/v1/bookings/{booking_id}/persons/{person_id}"
		method:        "PATCH"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingPersonUpdateRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}, {
			name:     "person_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_person_delete"
		path:          "/api/v1/bookings/{booking_id}/persons/{person_id}"
		method:        "DELETE"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingPersonDeleteRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}, {
			name:     "person_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_person_photo"
		path:          "/api/v1/bookings/{booking_id}/persons/{person_id}/photo"
		method:        "POST"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingPersonPhotoUploadRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}, {
			name:     "person_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_notes"
		path:          "/api/v1/bookings/{booking_id}/notes"
		method:        "PATCH"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingNotesUpdateRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_pricing"
		path:          "/api/v1/bookings/{booking_id}/pricing"
		method:        "PATCH"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingPricingUpdateRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_offer"
		path:          "/api/v1/bookings/{booking_id}/offer"
		method:        "PATCH"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingOfferUpdateRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "offer_exchange_rates"
		path:          "/api/v1/offers/exchange-rates"
		method:        "POST"
		tag:           "Offers"
		authenticated: true
		requestType:   "OfferExchangeRatesRequest"
		responseType:  "OfferExchangeRatesResponse"
	},
	{
		key:           "booking_activities"
		path:          "/api/v1/bookings/{booking_id}/activities"
		method:        "GET"
		tag:           "Bookings"
		authenticated: true
		responseType:  "BookingActivitiesResponse"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_activity_create"
		path:          "/api/v1/bookings/{booking_id}/activities"
		method:        "POST"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingActivityCreateRequest"
		responseType:  "BookingActivityResponse"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_invoices"
		path:          "/api/v1/bookings/{booking_id}/invoices"
		method:        "GET"
		tag:           "Bookings"
		authenticated: true
		responseType:  "BookingInvoicesResponse"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_invoice_create"
		path:          "/api/v1/bookings/{booking_id}/invoices"
		method:        "POST"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingInvoiceUpsertRequest"
		responseType:  "BookingInvoiceResponse"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_invoice_update"
		path:          "/api/v1/bookings/{booking_id}/invoices/{invoice_id}"
		method:        "PATCH"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingInvoiceUpsertRequest"
		responseType:  "BookingInvoiceResponse"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}, {
			name:     "invoice_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "atp_staff"
		path:          "/api/v1/atp_staff"
		method:        "GET"
		tag:           "Staff"
		authenticated: true
		responseType:  "AtpStaffListResponse"
	},
	{
		key:           "atp_staff_create"
		path:          "/api/v1/atp_staff"
		method:        "POST"
		tag:           "Staff"
		authenticated: true
		requestType:   "AtpStaffCreateRequest"
		responseType:  "AtpStaffResponse"
	},
	{
		key:           "tours"
		path:          "/api/v1/tours"
		method:        "GET"
		tag:           "Tours"
		authenticated: true
		responseType:  "TourList"
	},
	{
		key:           "tour_detail"
		path:          "/api/v1/tours/{tour_id}"
		method:        "GET"
		tag:           "Tours"
		authenticated: true
		responseType:  "TourDetail"
		parameters: [{
			name:     "tour_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "tour_create"
		path:          "/api/v1/tours"
		method:        "POST"
		tag:           "Tours"
		authenticated: true
		requestType:   "TourUpsertRequest"
		responseType:  "TourResponse"
	},
	{
		key:           "tour_update"
		path:          "/api/v1/tours/{tour_id}"
		method:        "PATCH"
		tag:           "Tours"
		authenticated: true
		requestType:   "TourUpsertRequest"
		responseType:  "TourResponse"
		parameters: [{
			name:     "tour_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "tour_image"
		path:          "/api/v1/tours/{tour_id}/image"
		method:        "POST"
		tag:           "Tours"
		authenticated: true
		requestType:   "EvidenceUpload"
		responseType:  "TourResponse"
		parameters: [{
			name:     "tour_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
]
