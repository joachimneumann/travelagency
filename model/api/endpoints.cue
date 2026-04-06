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
	parameters?: [...#EndpointParameter]
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
		key:           "public_generated_offer_access"
		path:          "/public/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}/access"
		method:        "GET"
		tag:           "Public"
		authenticated: false
		responseType:  "PublicGeneratedOfferAccessResponse"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}, {
			name:     "generated_offer_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}, {
			name:     "token"
			location: "query"
			required: true
			typeName: "string"
		}]
	},
	{
		key:           "public_generated_booking_confirmation"
		path:          "/public/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}/accept"
		method:        "POST"
		tag:           "Public"
		authenticated: false
		requestType:   "PublicGeneratedOfferAcceptRequest"
		responseType:  "PublicGeneratedOfferAcceptResponse"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}, {
			name:     "generated_offer_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "public_generated_offer_pdf"
		path:          "/public/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}/pdf"
		method:        "GET"
		tag:           "Public"
		authenticated: false
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}, {
			name:     "generated_offer_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}, {
			name:     "token"
			location: "query"
			required: true
			typeName: "string"
		}]
	},
	{
		key:           "public_traveler_details_access"
		path:          "/public/v1/bookings/{booking_id}/persons/{person_id}/traveler-details/access"
		method:        "GET"
		tag:           "Public"
		authenticated: false
		responseType:  "PublicTravelerDetailsAccessResponse"
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
		}, {
			name:     "token"
			location: "query"
			required: true
			typeName: "string"
		}]
	},
	{
		key:           "public_traveler_details_update"
		path:          "/public/v1/bookings/{booking_id}/persons/{person_id}/traveler-details"
		method:        "PATCH"
		tag:           "Public"
		authenticated: false
		requestType:   "PublicTravelerDetailsUpdateRequest"
		responseType:  "PublicTravelerDetailsUpdateResponse"
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
		}, {
			name:     "token"
			location: "query"
			required: true
			typeName: "string"
		}]
	},
	{
		key:           "public_traveler_document_picture_upload"
		path:          "/public/v1/bookings/{booking_id}/persons/{person_id}/documents/{document_type}/picture"
		method:        "POST"
		tag:           "Public"
		authenticated: false
		requestType:   "EvidenceUpload"
		responseType:  "PublicTravelerDetailsUpdateResponse"
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
		}, {
			name:     "document_type"
			location: "path"
			required: true
			typeName: "string"
		}, {
			name:     "token"
			location: "query"
			required: true
			typeName: "string"
		}]
	},
	{
		key:           "booking_person_traveler_details_link"
		path:          "/api/v1/bookings/{booking_id}/persons/{person_id}/traveler-details-link"
		method:        "POST"
		tag:           "Bookings"
		authenticated: true
		responseType:  "BookingPersonTravelerDetailsLinkResponse"
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
		key:           "public_tours"
		path:          "/public/v1/tours"
		method:        "GET"
		tag:           "Public"
		authenticated: false
		responseType:  "TourList"
	},
	{
		key:           "public_atp_staff_team"
		path:          "/public/v1/team"
		method:        "GET"
		tag:           "Public"
		authenticated: false
		responseType:  "PublicAtpStaffTeamResponse"
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
		key:           "booking_create"
		path:          "/api/v1/bookings"
		method:        "POST"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingCreateRequest"
		responseType:  "BookingDetail"
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
		key:           "booking_clone"
		path:          "/api/v1/bookings/{booking_id}/clone"
		method:        "POST"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingCloneRequest"
		responseType:  "BookingDetail"
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
		key:           "booking_customer_language"
		path:          "/api/v1/bookings/{booking_id}/customer-language"
		method:        "PATCH"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingCustomerLanguageUpdateRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_source"
		path:          "/api/v1/bookings/{booking_id}/source"
		method:        "PATCH"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingSourceUpdateRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_image"
		path:          "/api/v1/bookings/{booking_id}/image"
		method:        "POST"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingImageUploadRequest"
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
		key:           "booking_milestone_action"
		path:          "/api/v1/bookings/{booking_id}/milestone-actions"
		method:        "POST"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingMilestoneActionRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_translate_fields"
		path:          "/api/v1/bookings/{booking_id}/translate-fields"
		method:        "POST"
		tag:           "Bookings"
		authenticated: true
		requestType:   "TranslationEntriesRequest"
		responseType:  "TranslationEntriesResponse"
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
		key:           "booking_person_document_picture"
		path:          "/api/v1/bookings/{booking_id}/persons/{person_id}/documents/{document_type}/picture"
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
		}, {
			name:     "document_type"
			location: "path"
			required: true
			typeName: "PersonDocumentType"
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
		key:           "booking_travel_plan"
		path:          "/api/v1/bookings/{booking_id}/travel-plan"
		method:        "PATCH"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingTravelPlanUpdateRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_travel_plan_pdf"
		path:          "/api/v1/bookings/{booking_id}/travel-plan/pdf"
		method:        "GET"
		tag:           "Bookings"
		authenticated: true
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}, {
			name:     "lang"
			location: "query"
			required: false
			typeName: "LanguageCode"
		}]
	},
	{
		key:           "booking_travel_plan_attachment_pdf"
		path:          "/api/v1/bookings/{booking_id}/travel-plan/attachments/{attachment_id}/pdf"
		method:        "GET"
		tag:           "Bookings"
		authenticated: true
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}, {
			name:     "attachment_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_travel_plan_translate"
		path:          "/api/v1/bookings/{booking_id}/travel-plan/translate"
		method:        "POST"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingTravelPlanTranslateRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "travel_plan_day_search"
		path:          "/api/v1/travel-plan-days/search"
		method:        "GET"
		tag:           "Bookings"
		authenticated: true
		responseType:  "TravelPlanDaySearchResponse"
		parameters: [{
			name:     "q"
			location: "query"
			required: false
			typeName: "string"
		}, {
			name:     "destination"
			location: "query"
			required: false
			typeName: "string"
		}, {
			name:     "country"
			location: "query"
			required: false
			typeName: "CountryCode"
		}, {
			name:     "style"
			location: "query"
			required: false
			typeName: "string"
		}, {
			name:     "limit"
			location: "query"
			required: false
			typeName: "int"
		}, {
			name:     "offset"
			location: "query"
			required: false
			typeName: "int"
		}]
	},
	{
		key:           "travel_plan_search"
		path:          "/api/v1/travel-plan/plans"
		method:        "GET"
		tag:           "Bookings"
		authenticated: true
		responseType:  "TravelPlanSearchResponse"
		parameters: [{
			name:     "q"
			location: "query"
			required: false
			typeName: "string"
		}, {
			name:     "destination"
			location: "query"
			required: false
			typeName: "string"
		}, {
			name:     "country"
			location: "query"
			required: false
			typeName: "CountryCode"
		}, {
			name:     "style"
			location: "query"
			required: false
			typeName: "string"
		}, {
			name:     "limit"
			location: "query"
			required: false
			typeName: "int"
		}, {
			name:     "offset"
			location: "query"
			required: false
			typeName: "int"
		}]
	},
	{
		key:           "travel_plan_service_search"
		path:          "/api/v1/travel-plan-services/search"
		method:        "GET"
		tag:           "Bookings"
		authenticated: true
		responseType:  "TravelPlanServiceSearchResponse"
		parameters: [{
			name:     "q"
			location: "query"
			required: false
			typeName: "string"
		}, {
			name:     "destination"
			location: "query"
			required: false
			typeName: "string"
		}, {
			name:     "country"
			location: "query"
			required: false
			typeName: "CountryCode"
		}, {
			name:     "style"
			location: "query"
			required: false
			typeName: "string"
		}, {
			name:     "service_kind"
			location: "query"
			required: false
			typeName: "TravelPlanServiceKind"
		}, {
			name:     "limit"
			location: "query"
			required: false
			typeName: "int"
		}, {
			name:     "offset"
			location: "query"
			required: false
			typeName: "int"
		}]
	},
	{
		key:           "booking_travel_plan_day_import"
		path:          "/api/v1/bookings/{booking_id}/travel-plan/days/import"
		method:        "POST"
		tag:           "Bookings"
		authenticated: true
		requestType:   "TravelPlanDayImportRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_travel_plan_import"
		path:          "/api/v1/bookings/{booking_id}/travel-plan/import"
		method:        "POST"
		tag:           "Bookings"
		authenticated: true
		requestType:   "TravelPlanImportRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "travel_plan_templates"
		path:          "/api/v1/travel-plan-templates"
		method:        "GET"
		tag:           "Travel plan templates"
		authenticated: true
		responseType:  "TravelPlanTemplateListResponse"
		parameters: [{
			name:     "q"
			location: "query"
			required: false
			typeName: "string"
		}, {
			name:     "status"
			location: "query"
			required: false
			typeName: "TravelPlanTemplateStatus"
		}, {
			name:     "destination"
			location: "query"
			required: false
			typeName: "CountryCode"
		}, {
			name:     "page"
			location: "query"
			required: false
			typeName: "int"
		}, {
			name:     "page_size"
			location: "query"
			required: false
			typeName: "int"
		}]
	},
	{
		key:           "travel_plan_template_create"
		path:          "/api/v1/travel-plan-templates"
		method:        "POST"
		tag:           "Travel plan templates"
		authenticated: true
		requestType:   "TravelPlanTemplateUpsertRequest"
		responseType:  "TravelPlanTemplateResponse"
	},
	{
		key:           "travel_plan_template_detail"
		path:          "/api/v1/travel-plan-templates/{template_id}"
		method:        "GET"
		tag:           "Travel plan templates"
		authenticated: true
		responseType:  "TravelPlanTemplateResponse"
		parameters: [{
			name:     "template_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "travel_plan_template_update"
		path:          "/api/v1/travel-plan-templates/{template_id}"
		method:        "PATCH"
		tag:           "Travel plan templates"
		authenticated: true
		requestType:   "TravelPlanTemplateUpsertRequest"
		responseType:  "TravelPlanTemplateResponse"
		parameters: [{
			name:     "template_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "travel_plan_template_delete"
		path:          "/api/v1/travel-plan-templates/{template_id}"
		method:        "DELETE"
		tag:           "Travel plan templates"
		authenticated: true
		parameters: [{
			name:     "template_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_travel_plan_template_apply"
		path:          "/api/v1/bookings/{booking_id}/travel-plan/templates/{template_id}/apply"
		method:        "POST"
		tag:           "Travel plan templates"
		authenticated: true
		requestType:   "BookingTravelPlanTemplateApplyRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}, {
			name:     "template_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_travel_plan_service_import"
		path:          "/api/v1/bookings/{booking_id}/travel-plan/days/{day_id}/services/import"
		method:        "POST"
		tag:           "Bookings"
		authenticated: true
		requestType:   "TravelPlanServiceImportRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}, {
			name:     "day_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_travel_plan_service_image_upload"
		path:          "/api/v1/bookings/{booking_id}/travel-plan/days/{day_id}/services/{service_id}/image"
		method:        "POST"
		tag:           "Bookings"
		authenticated: true
		requestType:   "TravelPlanServiceImageUploadRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}, {
			name:     "day_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}, {
			name:     "service_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_travel_plan_service_image_delete"
		path:          "/api/v1/bookings/{booking_id}/travel-plan/days/{day_id}/services/{service_id}/image"
		method:        "DELETE"
		tag:           "Bookings"
		authenticated: true
		requestType:   "TravelPlanServiceImageDeleteRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}, {
			name:     "day_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}, {
			name:     "service_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_travel_plan_attachment_upload"
		path:          "/api/v1/bookings/{booking_id}/travel-plan/attachments"
		method:        "POST"
		tag:           "Bookings"
		authenticated: true
		requestType:   "TravelPlanAttachmentUploadRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_travel_plan_attachment_delete"
		path:          "/api/v1/bookings/{booking_id}/travel-plan/attachments/{attachment_id}"
		method:        "DELETE"
		tag:           "Bookings"
		authenticated: true
		requestType:   "TravelPlanAttachmentDeleteRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}, {
			name:     "attachment_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_travel_plan_pdf_create"
		path:          "/api/v1/bookings/{booking_id}/travel-plan/pdfs"
		method:        "POST"
		tag:           "Bookings"
		authenticated: true
		requestType:   "TravelPlanPdfArtifactCreateRequest"
		responseType:  "TravelPlanPdfArtifactCreateResponse"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_travel_plan_pdf_artifact_pdf"
		path:          "/api/v1/bookings/{booking_id}/travel-plan/pdfs/{artifact_id}/pdf"
		method:        "GET"
		tag:           "Bookings"
		authenticated: true
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}, {
			name:     "artifact_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_travel_plan_pdf_update"
		path:          "/api/v1/bookings/{booking_id}/travel-plan/pdfs/{artifact_id}"
		method:        "PATCH"
		tag:           "Bookings"
		authenticated: true
		requestType:   "TravelPlanPdfArtifactUpdateRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}, {
			name:     "artifact_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_travel_plan_pdf_delete"
		path:          "/api/v1/bookings/{booking_id}/travel-plan/pdfs/{artifact_id}"
		method:        "DELETE"
		tag:           "Bookings"
		authenticated: true
		requestType:   "TravelPlanPdfArtifactDeleteRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}, {
			name:     "artifact_id"
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
		key:           "booking_offer_translate"
		path:          "/api/v1/bookings/{booking_id}/offer/translate"
		method:        "POST"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingOfferTranslateRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_generate_offer"
		path:          "/api/v1/bookings/{booking_id}/generated-offers"
		method:        "POST"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingGenerateOfferRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_generated_offer_update"
		path:          "/api/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}"
		method:        "PATCH"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingGeneratedOfferUpdateRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}, {
			name:     "generated_offer_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_generated_offer_delete"
		path:          "/api/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}"
		method:        "DELETE"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingGeneratedOfferDeleteRequest"
		responseType:  "BookingDetail"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}, {
			name:     "generated_offer_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_generated_offer_pdf"
		path:          "/api/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}/pdf"
		method:        "GET"
		tag:           "Bookings"
		authenticated: true
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}, {
			name:     "generated_offer_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "booking_generated_offer_gmail_draft"
		path:          "/api/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}/gmail-draft"
		method:        "POST"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingGeneratedOfferGmailDraftRequest"
		responseType:  "BookingGeneratedOfferGmailDraftResponse"
		parameters: [{
			name:     "booking_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}, {
			name:     "generated_offer_id"
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
		key:           "suppliers"
		path:          "/api/v1/suppliers"
		method:        "GET"
		tag:           "Suppliers"
		authenticated: true
		responseType:  "SupplierListResponse"
	},
	{
		key:           "supplier_detail"
		path:          "/api/v1/suppliers/{supplier_id}"
		method:        "GET"
		tag:           "Suppliers"
		authenticated: true
		responseType:  "SupplierResponse"
		parameters: [{
			name:     "supplier_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "supplier_create"
		path:          "/api/v1/suppliers"
		method:        "POST"
		tag:           "Suppliers"
		authenticated: true
		requestType:   "SupplierCreateRequest"
		responseType:  "SupplierResponse"
	},
	{
		key:           "supplier_update"
		path:          "/api/v1/suppliers/{supplier_id}"
		method:        "PATCH"
		tag:           "Suppliers"
		authenticated: true
		requestType:   "SupplierUpdateRequest"
		responseType:  "SupplierResponse"
		parameters: [{
			name:     "supplier_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "country_reference_info"
		path:          "/api/v1/country-reference-info"
		method:        "GET"
		tag:           "CountryReference"
		authenticated: true
		responseType:  "CountryPracticalInfoListResponse"
	},
	{
		key:           "country_reference_info_update"
		path:          "/api/v1/country-reference-info"
		method:        "PATCH"
		tag:           "CountryReference"
		authenticated: true
		requestType:   "CountryPracticalInfoUpdateRequest"
		responseType:  "CountryPracticalInfoListResponse"
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
		key:           "booking_invoice_translate"
		path:          "/api/v1/bookings/{booking_id}/invoices/{invoice_id}/translate"
		method:        "POST"
		tag:           "Bookings"
		authenticated: true
		requestType:   "BookingInvoiceTranslateRequest"
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
		key:           "invoice_pdf"
		path:          "/api/v1/invoices/{invoice_id}/pdf"
		method:        "GET"
		tag:           "Bookings"
		authenticated: true
		parameters: [{
			name:     "invoice_id"
			location: "path"
			required: true
			typeName: "Identifier"
		}]
	},
	{
		key:           "keycloak_users"
		path:          "/api/v1/keycloak_users"
		method:        "GET"
		tag:           "Auth"
		authenticated: true
		responseType:  "KeycloakUserListResponse"
	},
	{
		key:           "staff_profiles"
		path:          "/api/v1/staff-profiles"
		method:        "GET"
		tag:           "Auth"
		authenticated: true
		responseType:  "KeycloakUserStaffProfileListResponse"
	},
	{
		key:           "keycloak_user_staff_profile_update"
		path:          "/api/v1/keycloak_users/{username}/staff-profile"
		method:        "PATCH"
		tag:           "Auth"
		authenticated: true
		requestType:   "AtpStaffProfileUpdateRequest"
		responseType:  "KeycloakUserStaffProfileEntryResponse"
		parameters: [{
			name:     "username"
			location: "path"
			required: true
			typeName: "string"
		}]
	},
	{
		key:           "keycloak_user_staff_profile_translate_fields"
		path:          "/api/v1/keycloak_users/{username}/staff-profile/translate-fields"
		method:        "POST"
		tag:           "Auth"
		authenticated: true
		requestType:   "TranslationEntriesRequest"
		responseType:  "TranslationEntriesResponse"
		parameters: [{
			name:     "username"
			location: "path"
			required: true
			typeName: "string"
		}]
	},
	{
		key:           "keycloak_user_staff_profile_picture_upload"
		path:          "/api/v1/keycloak_users/{username}/staff-profile/picture"
		method:        "POST"
		tag:           "Auth"
		authenticated: true
		requestType:   "AtpStaffPhotoUploadRequest"
		responseType:  "KeycloakUserStaffProfileEntryResponse"
		parameters: [{
			name:     "username"
			location: "path"
			required: true
			typeName: "string"
		}]
	},
	{
		key:           "keycloak_user_staff_profile_picture_delete"
		path:          "/api/v1/keycloak_users/{username}/staff-profile/picture"
		method:        "DELETE"
		tag:           "Auth"
		authenticated: true
		responseType:  "KeycloakUserStaffProfileEntryResponse"
		parameters: [{
			name:     "username"
			location: "path"
			required: true
			typeName: "string"
		}]
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
		key:           "tour_translate_fields"
		path:          "/api/v1/tours/translate-fields"
		method:        "POST"
		tag:           "Tours"
		authenticated: true
		requestType:   "TourTranslateFieldsRequest"
		responseType:  "TranslationEntriesResponse"
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
		key:           "tour_delete"
		path:          "/api/v1/tours/{tour_id}"
		method:        "DELETE"
		tag:           "Tours"
		authenticated: true
		responseType:  "TourDeleteResponse"
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
