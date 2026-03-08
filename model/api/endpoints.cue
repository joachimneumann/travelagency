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
	authenticated: bool
	requestType?:  string
	responseType?: string
	parameters?: [...#EndpointParameter]
}

#Endpoints: [
	{
		key:           "mobile_bootstrap"
		path:          "/public/v1/mobile/bootstrap"
		method:        "GET"
		authenticated: false
		responseType:  "MobileBootstrap"
	},
	{
		key:           "auth_me"
		path:          "/auth/me"
		method:        "GET"
		authenticated: true
		responseType:  "AuthMeResponse"
	},
	{
		key:           "public_bookings"
		path:          "/public/v1/bookings"
		method:        "POST"
		authenticated: false
		requestType:   "PublicBookingCreateRequest"
		responseType:  "BookingDetail"
	},
	{
		key:           "public_tours"
		path:          "/public/v1/tours"
		method:        "GET"
		authenticated: false
		responseType:  "TourList"
	},
	{
		key:           "bookings"
		path:          "/api/v1/bookings"
		method:        "GET"
		authenticated: true
		responseType:  "BookingList"
	},
	{
		key:           "booking_detail"
		path:          "/api/v1/bookings/{bookingId}"
		method:        "GET"
		authenticated: true
		responseType:  "BookingDetail"
		parameters: [{
			name:     "bookingId"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_chat"
		path:          "/api/v1/bookings/{bookingId}/chat"
		method:        "GET"
		authenticated: true
		responseType:  "BookingChatResponse"
		parameters: [{
			name:     "bookingId"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_stage"
		path:          "/api/v1/bookings/{bookingId}/stage"
		method:        "PATCH"
		authenticated: true
		responseType:  "BookingDetail"
		parameters: [{
			name:     "bookingId"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_assignment"
		path:          "/api/v1/bookings/{bookingId}/owner"
		method:        "PATCH"
		authenticated: true
		responseType:  "BookingDetail"
		parameters: [{
			name:     "bookingId"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_note"
		path:          "/api/v1/bookings/{bookingId}/notes"
		method:        "PATCH"
		authenticated: true
		responseType:  "BookingDetail"
		parameters: [{
			name:     "bookingId"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_client"
		path:          "/api/v1/bookings/{bookingId}/client"
		method:        "PATCH"
		authenticated: true
		requestType:   "BookingClientUpdateRequest"
		responseType:  "BookingClientUpdateResponse"
		parameters: [{
			name:     "bookingId"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_client_create_customer"
		path:          "/api/v1/bookings/{bookingId}/client/create-customer"
		method:        "POST"
		authenticated: true
		requestType:   "BookingClientCreateCustomerRequest"
		responseType:  "BookingClientCreateCustomerResponse"
		parameters: [{
			name:     "bookingId"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_client_create_group"
		path:          "/api/v1/bookings/{bookingId}/client/create-group"
		method:        "POST"
		authenticated: true
		requestType:   "BookingClientCreateGroupRequest"
		responseType:  "BookingClientCreateCustomerResponse"
		parameters: [{
			name:     "bookingId"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_group_members"
		path:          "/api/v1/bookings/{bookingId}/client/members"
		method:        "POST"
		authenticated: true
		requestType:   "BookingGroupMemberCreateRequest"
		responseType:  "BookingGroupMemberCreateResponse"
		parameters: [{
			name:     "bookingId"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_pricing"
		path:          "/api/v1/bookings/{bookingId}/pricing"
		method:        "PATCH"
		authenticated: true
		requestType:   "BookingPricingUpdateRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "bookingId"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_offer"
		path:          "/api/v1/bookings/{bookingId}/offer"
		method:        "PATCH"
		authenticated: true
		requestType:   "BookingOfferUpdateRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "bookingId"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_activities"
		path:          "/api/v1/bookings/{bookingId}/activities"
		method:        "GET"
		authenticated: true
		responseType:  "BookingActivitiesResponse"
		parameters: [{
			name:     "bookingId"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_invoices"
		path:          "/api/v1/bookings/{bookingId}/invoices"
		method:        "GET"
		authenticated: true
		responseType:  "BookingInvoicesResponse"
		parameters: [{
			name:     "bookingId"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "atp_staff"
		path:          "/api/v1/atp_staff"
		method:        "GET"
		authenticated: true
		responseType:  "AtpStaffListResponse"
	},
	{
		key:           "customers"
		path:          "/api/v1/customers"
		method:        "GET"
		authenticated: true
		responseType:  "CustomerList"
	},
	{
		key:           "customer_detail"
		path:          "/api/v1/customers/{customerClientId}"
		method:        "GET"
		authenticated: true
		responseType:  "CustomerDetail"
		parameters: [{
			name:     "customerClientId"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "customer_update"
		path:          "/api/v1/customers/{customerClientId}"
		method:        "PATCH"
		authenticated: true
		requestType:   "CustomerUpdateRequest"
		responseType:  "CustomerUpdateResponse"
		parameters: [{
			name:     "customerClientId"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "customer_photo_upload"
		path:          "/api/v1/customers/{customerClientId}/photo"
		method:        "POST"
		authenticated: true
		requestType:   "CustomerPhotoUploadRequest"
		responseType:  "CustomerPhotoUploadResponse"
		parameters: [{
			name:     "customerClientId"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "customer_consent_create"
		path:          "/api/v1/customers/{customerClientId}/consents"
		method:        "POST"
		authenticated: true
		requestType:   "CustomerConsentCreateRequest"
		responseType:  "CustomerConsentCreateResponse"
		parameters: [{
			name:     "customerClientId"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "travel_groups"
		path:          "/api/v1/travel_groups"
		method:        "GET"
		authenticated: true
		responseType:  "TravelGroupList"
	},
	{
		key:           "travel_group_create"
		path:          "/api/v1/travel_groups"
		method:        "POST"
		authenticated: true
		requestType:   "TravelGroupCreateRequest"
		responseType:  "TravelGroupDetail"
	},
	{
		key:           "travel_group_detail"
		path:          "/api/v1/travel_groups/{travelGroupId}"
		method:        "GET"
		authenticated: true
		responseType:  "TravelGroupDetail"
		parameters: [{
			name:     "travelGroupId"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "travel_group_update"
		path:          "/api/v1/travel_groups/{travelGroupId}"
		method:        "PATCH"
		authenticated: true
		requestType:   "TravelGroupUpdateRequest"
		responseType:  "TravelGroupDetail"
		parameters: [{
			name:     "travelGroupId"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "tours"
		path:          "/api/v1/tours"
		method:        "GET"
		authenticated: true
		responseType:  "TourList"
	},
	{
		key:           "tour_detail"
		path:          "/api/v1/tours/{tourId}"
		method:        "GET"
		authenticated: true
		responseType:  "TourDetail"
		parameters: [{
			name:     "tourId"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "tour_image"
		path:          "/api/v1/tours/{tourId}/image"
		method:        "GET"
		authenticated: true
		parameters: [{
			name:     "tourId"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
]
