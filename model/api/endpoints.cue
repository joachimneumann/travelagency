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
		key:           "staff"
		path:          "/api/v1/staff"
		method:        "GET"
		authenticated: true
		responseType:  "StaffListResponse"
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
		path:          "/api/v1/customers/{customerId}"
		method:        "GET"
		authenticated: true
		responseType:  "CustomerDetail"
		parameters: [{
			name:     "customerId"
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
