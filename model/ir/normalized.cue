package ir

import (
	apiModel "travelagency.local/model/api"
)

#FieldRefKind: "scalar" | "enum" | "entity" | "valueObject" | "transport"

#FieldDefinition: {
	name:         string & !=""
	kind:         #FieldRefKind
	typeName:     string & !=""
	required:     bool
	isArray?:     bool
	nullable?:    bool
	description?: string
}

#TypeDefinition: {
	name:       string & !=""
	domain:     "currency" | "booking" | "aux" | "api"
	module:     "json" | "database" | "api" | "common" | "enums"
	sourceType: string & !=""
	fields: [...#FieldDefinition]
	requireOneOf?: [...[...string]]
}

#CatalogEntry: {
	code: string & !=""
}

IR: {
	meta: {
		modelVersion:     "0.1.0"
		generatorVersion: "0.1.0"
		modulePath:       "travelagency.local/model"
		defaultCurrency:  "USD"
	}

	enumTypes: {
		LanguageCode: {catalog: "languages"}
		MonthCode: {catalog: "months"}
		CurrencyCode: {catalog: "currencies"}
		ATPStaffRole: {catalog: "roles"}
		BookingSourceChannel: {catalog: "bookingSourceChannels"}
		BookingReferralKind: {catalog: "bookingReferralKinds"}
		BookingPersonRole: {catalog: "bookingPersonRoles"}
		BookingPersonGender: {catalog: "bookingPersonGenders"}
		TravelPlanTimingKind: {catalog: "travelPlanTimingKinds"}
		TravelPlanServiceKind: {catalog: "travelPlanServiceKinds"}
		PaymentStatus: {catalog: "paymentStatuses"}
		PricingAdjustmentType: {catalog: "pricingAdjustmentTypes"}
		OfferCategory: {catalog: "offerCategories"}
		OfferDetailLevel: {catalog: "offerDetailLevels"}
		OfferPaymentTermKind: {catalog: "offerPaymentTermKinds"}
		OfferPaymentAmountMode: {catalog: "offerPaymentAmountModes"}
		OfferPaymentDueType: {catalog: "offerPaymentDueTypes"}
		TourStyleCode: {catalog: "tourStyles"}
		CountryCode: {catalog: "countries"}
		TimezoneCode: {catalog: "timezones"}
		PersonConsentType: {catalog: "personConsentTypes"}
		PersonConsentStatus: {catalog: "personConsentStatuses"}
		PersonDocumentType: {catalog: "personDocumentTypes"}
		BookingActivityType: {catalog: "bookingActivityTypes"}
	}

	types: [
		{
			name:       "AtpStaffLocalizedTextEntry"
			domain:     "aux"
			module:     "json"
			sourceType: "json.#AtpStaffLocalizedTextEntry"
			fields: [
				{name: "lang", kind: "enum", typeName: "LanguageCode", required: true},
				{name: "value", kind: "scalar", typeName: "string", required: true},
			]
		},
		{
			name:       "AtpStaffProfile"
			domain:     "aux"
			module:     "json"
			sourceType: "json.#AtpStaffProfile"
			fields: [
				{name: "username", kind: "scalar", typeName: "string", required: true},
				{name: "name", kind: "scalar", typeName: "string", required: false},
				{name: "full_name", kind: "scalar", typeName: "string", required: false},
				{name: "friendly_short_name", kind: "scalar", typeName: "string", required: false},
				{name: "team_order", kind: "scalar", typeName: "int", required: false},
				{name: "picture_ref", kind: "scalar", typeName: "string", required: false},
				{name: "languages", kind: "enum", typeName: "LanguageCode", required: true, isArray: true},
				{name: "destinations", kind: "enum", typeName: "CountryCode", required: false, isArray: true},
			]
		},
		{
			name:       "CountryEmergencyContact"
			domain:     "aux"
			module:     "json"
			sourceType: "json.#CountryEmergencyContact"
			fields: [
				{name: "label", kind: "scalar", typeName: "string", required: true},
				{name: "phone", kind: "scalar", typeName: "string", required: true},
				{name: "note", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "CountryPracticalInfo"
			domain:     "aux"
			module:     "json"
			sourceType: "json.#CountryPracticalInfo"
			fields: [
				{name: "country", kind: "enum", typeName: "CountryCode", required: true},
				{name: "published_on_webpage", kind: "scalar", typeName: "bool", required: true},
				{name: "practical_tips", kind: "scalar", typeName: "string", required: true, isArray: true},
				{name: "emergency_contacts", kind: "entity", typeName: "CountryEmergencyContact", required: true, isArray: true},
				{name: "updated_at", kind: "scalar", typeName: "Timestamp", required: false},
			]
		},
		{
			name:       "Tour"
			domain:     "aux"
			module:     "json"
			sourceType: "json.#Tour"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "title", kind: "scalar", typeName: "string", required: false},
				{name: "destinations", kind: "scalar", typeName: "string", required: true, isArray: true},
				{name: "styles", kind: "scalar", typeName: "string", required: true, isArray: true},
				{name: "priority", kind: "scalar", typeName: "int", required: false},
				{name: "seasonality_start_month", kind: "enum", typeName: "MonthCode", required: false},
				{name: "seasonality_end_month", kind: "enum", typeName: "MonthCode", required: false},
				{name: "short_description", kind: "scalar", typeName: "string", required: false},
				{name: "pictures", kind: "scalar", typeName: "string", required: false, isArray: true},
				{name: "image", kind: "scalar", typeName: "string", required: false},
				{name: "created_at", kind: "scalar", typeName: "Timestamp", required: false},
				{name: "updated_at", kind: "scalar", typeName: "Timestamp", required: false},
			]
		},
		{
			name:       "TravelPlanTemplate"
			domain:     "aux"
			module:     "json"
			sourceType: "json.#TravelPlanTemplate"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "title", kind: "scalar", typeName: "string", required: true},
				{name: "destinations", kind: "enum", typeName: "CountryCode", required: true, isArray: true},
				{name: "travel_plan", kind: "entity", typeName: "BookingTravelPlan", required: true},
			]
		},
		{
			name:       "BookingPersonAddress"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingPersonAddress"
			fields: [
				{name: "line_1", kind: "scalar", typeName: "string", required: false},
				{name: "line_2", kind: "scalar", typeName: "string", required: false},
				{name: "city", kind: "scalar", typeName: "string", required: false},
				{name: "state_region", kind: "scalar", typeName: "string", required: false},
				{name: "postal_code", kind: "scalar", typeName: "string", required: false},
				{name: "country_code", kind: "enum", typeName: "CountryCode", required: false},
			]
		},
		{
			name:       "BookingPersonConsent"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingPersonConsent"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "consent_type", kind: "enum", typeName: "PersonConsentType", required: true},
				{name: "status", kind: "enum", typeName: "PersonConsentStatus", required: true},
				{name: "captured_via", kind: "scalar", typeName: "string", required: false},
				{name: "captured_at", kind: "scalar", typeName: "Timestamp", required: true},
				{name: "evidence_ref", kind: "scalar", typeName: "string", required: false},
				{name: "updated_at", kind: "scalar", typeName: "Timestamp", required: true},
			]
		},
		{
			name:       "BookingPersonDocument"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingPersonDocument"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "document_type", kind: "enum", typeName: "PersonDocumentType", required: true},
				{name: "holder_name", kind: "scalar", typeName: "string", required: false},
				{name: "document_number", kind: "scalar", typeName: "string", required: false},
				{name: "document_picture_ref", kind: "scalar", typeName: "string", required: false},
				{name: "issuing_country", kind: "enum", typeName: "CountryCode", required: false},
				{name: "issued_on", kind: "scalar", typeName: "DateOnly", required: false},
				{name: "no_expiration_date", kind: "scalar", typeName: "bool", required: false},
				{name: "expires_on", kind: "scalar", typeName: "DateOnly", required: false},
				{name: "created_at", kind: "scalar", typeName: "Timestamp", required: true},
				{name: "updated_at", kind: "scalar", typeName: "Timestamp", required: true},
			]
		},
		{
			name:       "BookingPerson"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingPerson"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "name", kind: "scalar", typeName: "string", required: true},
				{name: "photo_ref", kind: "scalar", typeName: "string", required: false},
				{name: "emails", kind: "scalar", typeName: "Email", required: false, isArray: true},
				{name: "phone_numbers", kind: "scalar", typeName: "string", required: false, isArray: true},
				{name: "preferred_language", kind: "enum", typeName: "LanguageCode", required: false},
				{name: "food_preferences", kind: "scalar", typeName: "string", required: false, isArray: true},
				{name: "allergies", kind: "scalar", typeName: "string", required: false, isArray: true},
				{name: "hotel_room_smoker", kind: "scalar", typeName: "bool", required: false},
				{name: "hotel_room_sharing_ok", kind: "scalar", typeName: "bool", required: false},
				{name: "date_of_birth", kind: "scalar", typeName: "DateOnly", required: false},
				{name: "gender", kind: "enum", typeName: "BookingPersonGender", required: false},
				{name: "nationality", kind: "enum", typeName: "CountryCode", required: false},
				{name: "address", kind: "entity", typeName: "BookingPersonAddress", required: false},
				{name: "roles", kind: "enum", typeName: "BookingPersonRole", required: false, isArray: true},
				{name: "consents", kind: "entity", typeName: "BookingPersonConsent", required: false, isArray: true},
				{name: "documents", kind: "entity", typeName: "BookingPersonDocument", required: false, isArray: true},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "BookingTravelPlanServiceImageSourceAttribution"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingTravelPlanServiceImageSourceAttribution"
			fields: [
				{name: "source_name", kind: "scalar", typeName: "string", required: false},
				{name: "source_url", kind: "scalar", typeName: "string", required: false},
				{name: "photographer", kind: "scalar", typeName: "string", required: false},
				{name: "license", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "BookingTravelPlanServiceImageFocalPoint"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingTravelPlanServiceImageFocalPoint"
			fields: [
				{name: "x", kind: "scalar", typeName: "float", required: true},
				{name: "y", kind: "scalar", typeName: "float", required: true},
			]
		},
		{
			name:       "BookingTravelPlanServiceImage"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingTravelPlanServiceImage"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "storage_path", kind: "scalar", typeName: "string", required: true},
				{name: "caption", kind: "scalar", typeName: "string", required: false},
				{name: "alt_text", kind: "scalar", typeName: "string", required: false},
				{name: "sort_order", kind: "scalar", typeName: "int", required: true},
				{name: "is_primary", kind: "scalar", typeName: "bool", required: false},
				{name: "is_customer_visible", kind: "scalar", typeName: "bool", required: false},
				{name: "width_px", kind: "scalar", typeName: "int", required: false},
				{name: "height_px", kind: "scalar", typeName: "int", required: false},
				{name: "source_attribution", kind: "entity", typeName: "BookingTravelPlanServiceImageSourceAttribution", required: false},
				{name: "focal_point", kind: "entity", typeName: "BookingTravelPlanServiceImageFocalPoint", required: false},
				{name: "created_at", kind: "scalar", typeName: "Timestamp", required: false},
			]
		},
		{
			name:       "BookingTravelPlanServiceCopiedFrom"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingTravelPlanServiceCopiedFrom"
			fields: [
				{name: "source_type", kind: "scalar", typeName: "string", required: true},
				{name: "source_booking_id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "source_day_id", kind: "scalar", typeName: "Identifier", required: false},
				{name: "source_service_id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "copied_at", kind: "scalar", typeName: "Timestamp", required: true},
				{name: "copied_by_atp_staff_id", kind: "scalar", typeName: "Identifier", required: false},
			]
		},
		{
			name:       "BookingTravelPlanService"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingTravelPlanService"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "timing_kind", kind: "enum", typeName: "TravelPlanTimingKind", required: true},
				{name: "time_label", kind: "scalar", typeName: "string", required: false},
				{name: "time_point", kind: "scalar", typeName: "string", required: false},
				{name: "kind", kind: "enum", typeName: "TravelPlanServiceKind", required: true},
				{name: "title", kind: "scalar", typeName: "string", required: false},
				{name: "details", kind: "scalar", typeName: "string", required: false},
				{name: "image_subtitle", kind: "scalar", typeName: "string", required: false},
				{name: "location", kind: "scalar", typeName: "string", required: false},
				{name: "start_time", kind: "scalar", typeName: "string", required: false},
				{name: "end_time", kind: "scalar", typeName: "string", required: false},
				{name: "image", kind: "entity", typeName: "BookingTravelPlanServiceImage", required: false},
				{name: "copied_from", kind: "entity", typeName: "BookingTravelPlanServiceCopiedFrom", required: false},
			]
		},
		{
			name:       "BookingTravelPlanDay"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingTravelPlanDay"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "day_number", kind: "scalar", typeName: "int", required: true},
				{name: "date", kind: "scalar", typeName: "DateOnly", required: false},
				{name: "date_string", kind: "scalar", typeName: "string", required: false},
				{name: "title", kind: "scalar", typeName: "string", required: false},
				{name: "overnight_location", kind: "scalar", typeName: "string", required: false},
				{name: "services", kind: "entity", typeName: "BookingTravelPlanService", required: false, isArray: true},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "BookingTravelPlanAttachment"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingTravelPlanAttachment"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "filename", kind: "scalar", typeName: "string", required: true},
				{name: "storage_path", kind: "scalar", typeName: "string", required: true},
				{name: "page_count", kind: "scalar", typeName: "int", required: true},
				{name: "sort_order", kind: "scalar", typeName: "int", required: true},
				{name: "created_at", kind: "scalar", typeName: "Timestamp", required: false},
			]
		},
		{
			name:       "BookingTravelPlan"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingTravelPlan"
			fields: [
				{name: "destinations", kind: "enum", typeName: "CountryCode", required: false, isArray: true},
				{name: "days", kind: "entity", typeName: "BookingTravelPlanDay", required: false, isArray: true},
				{name: "attachments", kind: "entity", typeName: "BookingTravelPlanAttachment", required: false, isArray: true},
			]
		},
		{
			name:       "BaseBooking"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BaseBooking"
			fields: [
				{name: "name", kind: "scalar", typeName: "string", required: false},
				{name: "travel_styles", kind: "scalar", typeName: "string", required: false, isArray: true},
				{name: "travel_plan", kind: "entity", typeName: "BookingTravelPlan", required: false},
			]
		},
		{
			name:       "BaseBookingWithPersons"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BaseBookingWithPersons"
			fields: [
				{name: "name", kind: "scalar", typeName: "string", required: false},
				{name: "travel_styles", kind: "scalar", typeName: "string", required: false, isArray: true},
				{name: "travel_plan", kind: "entity", typeName: "BookingTravelPlan", required: false},
				{name: "persons", kind: "entity", typeName: "BookingPerson", required: false, isArray: true},
			]
		},
		{
			name:       "PricingAdjustment"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#PricingAdjustment"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "type", kind: "enum", typeName: "PricingAdjustmentType", required: true},
				{name: "label", kind: "scalar", typeName: "string", required: true},
				{name: "amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "note", kind: "scalar", typeName: "string", required: false},
				{name: "created_at", kind: "scalar", typeName: "Timestamp", required: false},
				{name: "updated_at", kind: "scalar", typeName: "Timestamp", required: false},
			]
		},
		{
			name:       "PaymentDocumentComponent"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#PaymentDocumentComponent"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: false},
				{name: "description", kind: "scalar", typeName: "string", required: true},
				{name: "quantity", kind: "scalar", typeName: "int", required: true},
				{name: "unit_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "total_amount_cents", kind: "transport", typeName: "MoneyAmount", required: false},
			]
		},
		{
			name:       "BookingPaymentDocument"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingPaymentDocument"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "booking_id", kind: "scalar", typeName: "Identifier", required: false},
				{name: "document_number", kind: "scalar", typeName: "string", required: false},
				{name: "version", kind: "scalar", typeName: "int", required: false},
				{name: "status", kind: "scalar", typeName: "string", required: false},
				{name: "document_kind", kind: "scalar", typeName: "string", required: false},
				{name: "payment_id", kind: "scalar", typeName: "Identifier", required: false},
				{name: "payment_term_line_id", kind: "scalar", typeName: "Identifier", required: false},
				{name: "payment_kind", kind: "scalar", typeName: "string", required: false},
				{name: "payment_label", kind: "scalar", typeName: "string", required: false},
				{name: "currency", kind: "enum", typeName: "CurrencyCode", required: true},
				{name: "issue_date", kind: "scalar", typeName: "DateOnly", required: false},
				{name: "title", kind: "scalar", typeName: "string", required: false},
				{name: "subtitle", kind: "scalar", typeName: "string", required: false},
				{name: "intro", kind: "scalar", typeName: "string", required: false},
				{name: "components", kind: "entity", typeName: "PaymentDocumentComponent", required: true, isArray: true},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
				{name: "closing", kind: "scalar", typeName: "string", required: false},
				{name: "payment_received_at", kind: "scalar", typeName: "Timestamp", required: false},
				{name: "payment_confirmed_by_atp_staff_id", kind: "scalar", typeName: "Identifier", required: false},
				{name: "payment_confirmed_by_label", kind: "scalar", typeName: "string", required: false},
				{name: "payment_reference", kind: "scalar", typeName: "string", required: false},
				{name: "total_amount_cents", kind: "transport", typeName: "MoneyAmount", required: false},
				{name: "due_amount_cents", kind: "transport", typeName: "MoneyAmount", required: false},
				{name: "created_at", kind: "scalar", typeName: "Timestamp", required: false},
				{name: "updated_at", kind: "scalar", typeName: "Timestamp", required: false},
				{name: "pdf_url", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "BookingOfferCategoryRule"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingOfferCategoryRule"
			fields: [
				{name: "category", kind: "enum", typeName: "OfferCategory", required: true},
				{name: "tax_rate_basis_points", kind: "scalar", typeName: "int", required: true},
			]
		},
		{
			name:       "BookingOfferDiscount"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingOfferDiscount"
			fields: [
				{name: "reason", kind: "scalar", typeName: "string", required: true},
				{name: "amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "currency", kind: "enum", typeName: "CurrencyCode", required: true},
				{name: "line_net_amount_cents", kind: "transport", typeName: "MoneyAmount", required: false},
				{name: "line_tax_amount_cents", kind: "transport", typeName: "MoneyAmount", required: false},
				{name: "line_gross_amount_cents", kind: "transport", typeName: "MoneyAmount", required: false},
			]
		},
		{
			name:       "BookingOfferTaxBucket"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingOfferTaxBucket"
			fields: [
				{name: "tax_rate_basis_points", kind: "scalar", typeName: "int", required: true},
				{name: "net_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "tax_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "gross_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "items_count", kind: "scalar", typeName: "int", required: true},
			]
		},
		{
			name:       "BookingOfferTotals"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingOfferTotals"
			fields: [
				{name: "net_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "tax_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "gross_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "total_price_cents", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "items_count", kind: "scalar", typeName: "int", required: true},
			]
		},
		{
			name:       "BookingOfferQuotationSummary"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingOfferQuotationSummary"
			fields: [
				{name: "tax_included", kind: "scalar", typeName: "bool", required: true},
				{name: "subtotal_net_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "total_tax_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "grand_total_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "tax_breakdown", kind: "entity", typeName: "BookingOfferTaxBucket", required: true, isArray: true},
			]
		},
		{
			name:       "BookingOfferPaymentDueRule"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingOfferPaymentDueRule"
			fields: [
				{name: "type", kind: "enum", typeName: "OfferPaymentDueType", required: true},
				{name: "fixed_date", kind: "scalar", typeName: "DateOnly", required: false},
				{name: "days", kind: "scalar", typeName: "int", required: false},
			]
		},
		{
			name:       "BookingOfferPaymentAmountSpec"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingOfferPaymentAmountSpec"
			fields: [
				{name: "mode", kind: "enum", typeName: "OfferPaymentAmountMode", required: true},
				{name: "fixed_amount_cents", kind: "scalar", typeName: "int", required: false},
				{name: "percentage_basis_points", kind: "scalar", typeName: "int", required: false},
			]
		},
		{
			name:       "BookingOfferPaymentTermLine"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingOfferPaymentTermLine"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "kind", kind: "enum", typeName: "OfferPaymentTermKind", required: true},
				{name: "label", kind: "scalar", typeName: "string", required: true},
				{name: "sequence", kind: "scalar", typeName: "int", required: true},
				{name: "amount_spec", kind: "entity", typeName: "BookingOfferPaymentAmountSpec", required: true},
				{name: "due_rule", kind: "entity", typeName: "BookingOfferPaymentDueRule", required: true},
			]
		},
		{
			name:       "BookingOfferPaymentTerms"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingOfferPaymentTerms"
			fields: [
				{name: "currency", kind: "enum", typeName: "CurrencyCode", required: true},
				{name: "lines", kind: "entity", typeName: "BookingOfferPaymentTermLine", required: true, isArray: true},
			]
		},
		{
			name:       "BookingOfferTripPriceInternal"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingOfferTripPriceInternal"
			fields: [
				{name: "label", kind: "scalar", typeName: "string", required: false},
				{name: "amount_cents", kind: "scalar", typeName: "NonNegativeMoneyAmount", required: true},
				{name: "tax_rate_basis_points", kind: "scalar", typeName: "int", required: true},
				{name: "currency", kind: "enum", typeName: "CurrencyCode", required: true},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
				{name: "line_net_amount_cents", kind: "scalar", typeName: "MoneyAmount", required: false},
				{name: "line_tax_amount_cents", kind: "scalar", typeName: "MoneyAmount", required: false},
				{name: "line_gross_amount_cents", kind: "scalar", typeName: "MoneyAmount", required: false},
				{name: "line_total_amount_cents", kind: "scalar", typeName: "int", required: false},
			]
		},
		{
			name:       "BookingOfferDayPriceInternal"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingOfferDayPriceInternal"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: false},
				{name: "day_number", kind: "scalar", typeName: "int", required: true},
				{name: "label", kind: "scalar", typeName: "string", required: false},
				{name: "amount_cents", kind: "scalar", typeName: "NonNegativeMoneyAmount", required: true},
				{name: "tax_rate_basis_points", kind: "scalar", typeName: "int", required: true},
				{name: "currency", kind: "enum", typeName: "CurrencyCode", required: true},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
				{name: "sort_order", kind: "scalar", typeName: "int", required: false},
				{name: "line_net_amount_cents", kind: "scalar", typeName: "MoneyAmount", required: false},
				{name: "line_tax_amount_cents", kind: "scalar", typeName: "MoneyAmount", required: false},
				{name: "line_gross_amount_cents", kind: "scalar", typeName: "MoneyAmount", required: false},
				{name: "line_total_amount_cents", kind: "scalar", typeName: "int", required: false},
			]
		},
		{
			name:       "BookingOfferAdditionalItem"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingOfferAdditionalItem"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "label", kind: "scalar", typeName: "string", required: true},
				{name: "details", kind: "scalar", typeName: "string", required: false},
				{name: "day_number", kind: "scalar", typeName: "int", required: false},
				{name: "quantity", kind: "scalar", typeName: "int", required: true},
				{name: "unit_amount_cents", kind: "scalar", typeName: "NonNegativeMoneyAmount", required: true},
				{name: "unit_tax_amount_cents", kind: "scalar", typeName: "MoneyAmount", required: false},
				{name: "unit_total_amount_cents", kind: "scalar", typeName: "MoneyAmount", required: false},
				{name: "tax_rate_basis_points", kind: "scalar", typeName: "int", required: true},
				{name: "currency", kind: "enum", typeName: "CurrencyCode", required: true},
				{name: "category", kind: "enum", typeName: "OfferCategory", required: false},
				{name: "line_net_amount_cents", kind: "scalar", typeName: "MoneyAmount", required: false},
				{name: "line_tax_amount_cents", kind: "scalar", typeName: "MoneyAmount", required: false},
				{name: "line_gross_amount_cents", kind: "scalar", typeName: "MoneyAmount", required: false},
				{name: "line_total_amount_cents", kind: "scalar", typeName: "int", required: false},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
				{name: "sort_order", kind: "scalar", typeName: "int", required: false},
				{name: "created_at", kind: "scalar", typeName: "Timestamp", required: false},
				{name: "updated_at", kind: "scalar", typeName: "Timestamp", required: false},
			]
		},
		{
			name:       "BookingOffer"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingOffer"
			fields: [
				{name: "status", kind: "scalar", typeName: "string", required: false},
				{name: "currency", kind: "enum", typeName: "CurrencyCode", required: true},
				{name: "offer_detail_level_internal", kind: "enum", typeName: "OfferDetailLevel", required: true},
				{name: "offer_detail_level_visible", kind: "enum", typeName: "OfferDetailLevel", required: true},
				{name: "category_rules", kind: "entity", typeName: "BookingOfferCategoryRule", required: true, isArray: true},
				{name: "trip_price_internal", kind: "entity", typeName: "BookingOfferTripPriceInternal", required: false},
				{name: "days_internal", kind: "entity", typeName: "BookingOfferDayPriceInternal", required: false, isArray: true},
				{name: "additional_items", kind: "entity", typeName: "BookingOfferAdditionalItem", required: false, isArray: true},
				{name: "discount", kind: "entity", typeName: "BookingOfferDiscount", required: false},
				{name: "totals", kind: "entity", typeName: "BookingOfferTotals", required: true},
				{name: "quotation_summary", kind: "entity", typeName: "BookingOfferQuotationSummary", required: false},
				{name: "payment_terms", kind: "entity", typeName: "BookingOfferPaymentTerms", required: false},
				{name: "total_price_cents", kind: "scalar", typeName: "int", required: true},
			]
		},
		{
			name:       "GeneratedBookingOffer"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#GeneratedBookingOffer"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "booking_id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "version", kind: "scalar", typeName: "int", required: true},
				{name: "filename", kind: "scalar", typeName: "string", required: true},
				{name: "lang", kind: "enum", typeName: "LanguageCode", required: true},
				{name: "comment", kind: "scalar", typeName: "string", required: false},
				{name: "created_at", kind: "scalar", typeName: "Timestamp", required: true},
				{name: "created_by", kind: "scalar", typeName: "string", required: false},
				{name: "currency", kind: "enum", typeName: "CurrencyCode", required: true},
				{name: "total_price_cents", kind: "scalar", typeName: "int", required: true},
				{name: "offer", kind: "entity", typeName: "BookingOffer", required: true},
				{name: "travel_plan", kind: "entity", typeName: "BookingTravelPlan", required: false},
				{name: "pdf_frozen_at", kind: "scalar", typeName: "Timestamp", required: false},
				{name: "pdf_sha256", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "BookingActivity"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingActivity"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "booking_id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "type", kind: "enum", typeName: "BookingActivityType", required: true},
				{name: "actor", kind: "scalar", typeName: "string", required: true},
				{name: "detail", kind: "scalar", typeName: "string", required: true},
				{name: "created_at", kind: "scalar", typeName: "Timestamp", required: true},
			]
		},
		{
			name:       "BookingWebFormSubmission"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#BookingWebFormSubmission"
			fields: [
				{name: "destinations", kind: "enum", typeName: "CountryCode", required: false, isArray: true},
				{name: "travel_style", kind: "scalar", typeName: "string", required: false, isArray: true},
				{name: "booking_name", kind: "scalar", typeName: "string", required: false},
				{name: "tour_id", kind: "scalar", typeName: "Identifier", required: false},
				{name: "page_url", kind: "scalar", typeName: "string", required: false},
				{name: "ip_address", kind: "scalar", typeName: "string", required: false},
				{name: "ip_country_guess", kind: "scalar", typeName: "string", required: false},
				{name: "referrer", kind: "scalar", typeName: "string", required: false},
				{name: "utm_source", kind: "scalar", typeName: "string", required: false},
				{name: "utm_medium", kind: "scalar", typeName: "string", required: false},
				{name: "utm_campaign", kind: "scalar", typeName: "string", required: false},
				{name: "travel_month", kind: "scalar", typeName: "string", required: false},
				{name: "number_of_travelers", kind: "scalar", typeName: "int", required: false},
				{name: "preferred_currency", kind: "enum", typeName: "CurrencyCode", required: false},
				{name: "travel_duration_days_min", kind: "scalar", typeName: "int", required: false},
				{name: "travel_duration_days_max", kind: "scalar", typeName: "int", required: false},
				{name: "name", kind: "scalar", typeName: "string", required: false},
				{name: "email", kind: "scalar", typeName: "Email", required: false},
				{name: "phone_number", kind: "scalar", typeName: "string", required: false},
				{name: "budget_lower_usd", kind: "scalar", typeName: "int", required: false},
				{name: "budget_upper_usd", kind: "scalar", typeName: "int", required: false},
				{name: "preferred_language", kind: "enum", typeName: "LanguageCode", required: false},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
				{name: "submitted_at", kind: "scalar", typeName: "Timestamp", required: false},
			]
		},
		{
			name:       "Booking"
			domain:     "booking"
			module:     "database"
			sourceType: "database.#Booking"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "name", kind: "scalar", typeName: "string", required: false},
				{name: "image", kind: "scalar", typeName: "string", required: false},
				{name: "assigned_keycloak_user_id", kind: "scalar", typeName: "Identifier", required: false},
				{name: "source_channel", kind: "enum", typeName: "BookingSourceChannel", required: false},
				{name: "referral_kind", kind: "enum", typeName: "BookingReferralKind", required: false},
				{name: "referral_label", kind: "scalar", typeName: "string", required: false},
				{name: "referral_staff_user_id", kind: "scalar", typeName: "Identifier", required: false},
				{name: "assigned_keycloak_user_label", kind: "scalar", typeName: "string", required: false},
				{name: "core_revision", kind: "scalar", typeName: "int", required: false},
				{name: "notes_revision", kind: "scalar", typeName: "int", required: false},
				{name: "persons_revision", kind: "scalar", typeName: "int", required: false},
				{name: "travel_plan_revision", kind: "scalar", typeName: "int", required: false},
				{name: "offer_revision", kind: "scalar", typeName: "int", required: false},
				{name: "payment_documents_revision", kind: "scalar", typeName: "int", required: false},
				{name: "travel_styles", kind: "scalar", typeName: "string", required: false, isArray: true},
				{name: "travel_start_day", kind: "scalar", typeName: "DateOnly", required: false},
				{name: "travel_end_day", kind: "scalar", typeName: "DateOnly", required: false},
				{name: "number_of_travelers", kind: "scalar", typeName: "int", required: false},
				{name: "preferred_currency", kind: "enum", typeName: "CurrencyCode", required: false},
				{name: "customer_language", kind: "enum", typeName: "LanguageCode", required: false},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
				{name: "persons", kind: "entity", typeName: "BookingPerson", required: false, isArray: true},
				{name: "travel_plan", kind: "entity", typeName: "BookingTravelPlan", required: false},
				{name: "web_form_submission", kind: "entity", typeName: "BookingWebFormSubmission", required: false},
				{name: "offer", kind: "entity", typeName: "BookingOffer", required: true},
				{name: "generated_offers", kind: "entity", typeName: "GeneratedBookingOffer", required: false, isArray: true},
				{name: "created_at", kind: "scalar", typeName: "Timestamp", required: true},
				{name: "updated_at", kind: "scalar", typeName: "Timestamp", required: true},
			]
		},
		{
			name:       "TranslationStatusSummary"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TranslationStatusSummary"
			fields: [
				{name: "lang", kind: "enum", typeName: "LanguageCode", required: true},
				{name: "source_lang", kind: "enum", typeName: "LanguageCode", required: true},
				{name: "status", kind: "scalar", typeName: "string", required: true},
				{name: "origin", kind: "scalar", typeName: "string", required: false},
				{name: "updated_at", kind: "scalar", typeName: "Timestamp", required: false},
				{name: "stale", kind: "scalar", typeName: "bool", required: true},
				{name: "total_fields", kind: "scalar", typeName: "int", required: true},
				{name: "translated_fields", kind: "scalar", typeName: "int", required: true},
				{name: "missing_fields", kind: "scalar", typeName: "int", required: true},
				{name: "has_source_content", kind: "scalar", typeName: "bool", required: true},
				{name: "has_target_content", kind: "scalar", typeName: "bool", required: true},
				{name: "source_hash", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "BookingOfferPaymentTermLineReadModel"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingOfferPaymentTermLineReadModel"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "kind", kind: "enum", typeName: "OfferPaymentTermKind", required: true},
				{name: "label", kind: "scalar", typeName: "string", required: true},
				{name: "sequence", kind: "scalar", typeName: "int", required: true},
				{name: "amount_spec", kind: "entity", typeName: "BookingOfferPaymentAmountSpec", required: true},
				{name: "due_rule", kind: "entity", typeName: "BookingOfferPaymentDueRule", required: true},
				{name: "description", kind: "scalar", typeName: "string", required: false},
				{name: "resolved_amount_cents", kind: "scalar", typeName: "int", required: true},
			]
		},
		{
			name:       "BookingOfferPaymentTermsReadModel"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingOfferPaymentTermsReadModel"
			fields: [
				{name: "currency", kind: "enum", typeName: "CurrencyCode", required: true},
				{name: "lines", kind: "transport", typeName: "BookingOfferPaymentTermLineReadModel", required: true, isArray: true},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
				{name: "basis_total_amount_cents", kind: "scalar", typeName: "int", required: true},
				{name: "scheduled_total_amount_cents", kind: "scalar", typeName: "int", required: true},
			]
		},
		{
			name:       "BookingOfferVisibleTripPriceReadModel"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingOfferVisibleTripPriceReadModel"
			fields: [
				{name: "label", kind: "scalar", typeName: "string", required: false},
				{name: "amount_cents", kind: "scalar", typeName: "MoneyAmount", required: true},
				{name: "currency", kind: "enum", typeName: "CurrencyCode", required: true},
				{name: "line_net_amount_cents", kind: "scalar", typeName: "MoneyAmount", required: true},
				{name: "line_tax_amount_cents", kind: "scalar", typeName: "MoneyAmount", required: true},
				{name: "line_gross_amount_cents", kind: "scalar", typeName: "MoneyAmount", required: true},
			]
		},
		{
			name:       "BookingOfferVisibleDayPriceReadModel"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingOfferVisibleDayPriceReadModel"
			fields: [
				{name: "day_number", kind: "scalar", typeName: "int", required: false},
				{name: "label", kind: "scalar", typeName: "string", required: false},
				{name: "amount_cents", kind: "scalar", typeName: "MoneyAmount", required: true},
				{name: "currency", kind: "enum", typeName: "CurrencyCode", required: true},
				{name: "line_net_amount_cents", kind: "scalar", typeName: "MoneyAmount", required: true},
				{name: "line_tax_amount_cents", kind: "scalar", typeName: "MoneyAmount", required: true},
				{name: "line_gross_amount_cents", kind: "scalar", typeName: "MoneyAmount", required: true},
			]
		},
		{
			name:       "BookingOfferVisiblePricingReadModel"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingOfferVisiblePricingReadModel"
			fields: [
				{name: "detail_level", kind: "enum", typeName: "OfferDetailLevel", required: true},
				{name: "derivable", kind: "scalar", typeName: "bool", required: true},
				{name: "trip_price", kind: "transport", typeName: "BookingOfferVisibleTripPriceReadModel", required: false},
				{name: "days", kind: "transport", typeName: "BookingOfferVisibleDayPriceReadModel", required: true, isArray: true},
				{name: "additional_items", kind: "entity", typeName: "BookingOfferAdditionalItem", required: true, isArray: true},
			]
		},
		{
			name:       "BookingOfferReadModel"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingOfferReadModel"
			fields: [
				{name: "status", kind: "scalar", typeName: "string", required: false},
				{name: "currency", kind: "enum", typeName: "CurrencyCode", required: true},
				{name: "offer_detail_level_internal", kind: "enum", typeName: "OfferDetailLevel", required: true},
				{name: "offer_detail_level_visible", kind: "enum", typeName: "OfferDetailLevel", required: true},
				{name: "category_rules", kind: "entity", typeName: "BookingOfferCategoryRule", required: true, isArray: true},
				{name: "trip_price_internal", kind: "entity", typeName: "BookingOfferTripPriceInternal", required: false},
				{name: "days_internal", kind: "entity", typeName: "BookingOfferDayPriceInternal", required: false, isArray: true},
				{name: "additional_items", kind: "entity", typeName: "BookingOfferAdditionalItem", required: false, isArray: true},
				{name: "discount", kind: "entity", typeName: "BookingOfferDiscount", required: false},
				{name: "totals", kind: "entity", typeName: "BookingOfferTotals", required: true},
				{name: "quotation_summary", kind: "entity", typeName: "BookingOfferQuotationSummary", required: false},
				{name: "payment_terms", kind: "transport", typeName: "BookingOfferPaymentTermsReadModel", required: false},
				{name: "visible_pricing", kind: "transport", typeName: "BookingOfferVisiblePricingReadModel", required: true},
				{name: "total_price_cents", kind: "scalar", typeName: "int", required: true},
			]
		},
		{
			name:       "GeneratedBookingOfferReadModel"
			domain:     "api"
			module:     "api"
			sourceType: "api.#GeneratedBookingOfferReadModel"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "booking_id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "version", kind: "scalar", typeName: "int", required: true},
				{name: "filename", kind: "scalar", typeName: "string", required: true},
				{name: "lang", kind: "enum", typeName: "LanguageCode", required: true},
				{name: "comment", kind: "scalar", typeName: "string", required: false},
				{name: "created_at", kind: "scalar", typeName: "Timestamp", required: true},
				{name: "created_by", kind: "scalar", typeName: "string", required: false},
				{name: "currency", kind: "enum", typeName: "CurrencyCode", required: true},
				{name: "total_price_cents", kind: "scalar", typeName: "int", required: true},
				{name: "payment_terms", kind: "transport", typeName: "BookingOfferPaymentTermsReadModel", required: false},
				{name: "offer", kind: "transport", typeName: "BookingOfferReadModel", required: true},
				{name: "travel_plan", kind: "entity", typeName: "BookingTravelPlan", required: false},
				{name: "pdf_url", kind: "scalar", typeName: "string", required: true},
			]
		},
		{
			name:       "BookingTravelPlanPdfReadModel"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingTravelPlanPdfReadModel"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "filename", kind: "scalar", typeName: "string", required: true},
				{name: "page_count", kind: "scalar", typeName: "int", required: true},
				{name: "created_at", kind: "scalar", typeName: "Timestamp", required: true},
				{name: "sent_to_customer", kind: "scalar", typeName: "bool", required: true},
				{name: "comment", kind: "scalar", typeName: "string", required: false},
				{name: "pdf_url", kind: "scalar", typeName: "string", required: true},
			]
		},
		{
			name:       "TravelPlanPdfArtifactCreateResponse"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TravelPlanPdfArtifactCreateResponse"
			fields: [
				{name: "artifact", kind: "transport", typeName: "BookingTravelPlanPdfReadModel", required: true},
			]
		},
		{
			name:       "BookingReadModel"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingReadModel"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "name", kind: "scalar", typeName: "string", required: false},
				{name: "image", kind: "scalar", typeName: "string", required: false},
				{name: "assigned_keycloak_user_id", kind: "scalar", typeName: "Identifier", required: false},
				{name: "source_channel", kind: "enum", typeName: "BookingSourceChannel", required: false},
				{name: "referral_kind", kind: "enum", typeName: "BookingReferralKind", required: false},
				{name: "referral_label", kind: "scalar", typeName: "string", required: false},
				{name: "referral_staff_user_id", kind: "scalar", typeName: "Identifier", required: false},
				{name: "assigned_keycloak_user_label", kind: "scalar", typeName: "string", required: false},
				{name: "assigned_atp_staff", kind: "entity", typeName: "AtpStaffProfile", required: false},
				{name: "core_revision", kind: "scalar", typeName: "int", required: false},
				{name: "notes_revision", kind: "scalar", typeName: "int", required: false},
				{name: "persons_revision", kind: "scalar", typeName: "int", required: false},
				{name: "travel_plan_revision", kind: "scalar", typeName: "int", required: false},
				{name: "offer_revision", kind: "scalar", typeName: "int", required: false},
				{name: "payment_documents_revision", kind: "scalar", typeName: "int", required: false},
				{name: "travel_styles", kind: "scalar", typeName: "string", required: false, isArray: true},
				{name: "travel_start_day", kind: "scalar", typeName: "DateOnly", required: false},
				{name: "travel_end_day", kind: "scalar", typeName: "DateOnly", required: false},
				{name: "number_of_travelers", kind: "scalar", typeName: "int", required: false},
				{name: "preferred_currency", kind: "enum", typeName: "CurrencyCode", required: false},
				{name: "customer_language", kind: "enum", typeName: "LanguageCode", required: false},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
				{name: "persons", kind: "entity", typeName: "BookingPerson", required: false, isArray: true},
				{name: "travel_plan", kind: "entity", typeName: "BookingTravelPlan", required: false},
				{name: "web_form_submission", kind: "entity", typeName: "BookingWebFormSubmission", required: false},
				{name: "offer", kind: "transport", typeName: "BookingOfferReadModel", required: true},
				{name: "travel_plan_pdfs", kind: "transport", typeName: "BookingTravelPlanPdfReadModel", required: false, isArray: true},
				{name: "generated_offers", kind: "transport", typeName: "GeneratedBookingOfferReadModel", required: false, isArray: true},
				{name: "travel_plan_translation_status", kind: "transport", typeName: "TranslationStatusSummary", required: true},
				{name: "generated_offer_email_enabled", kind: "scalar", typeName: "bool", required: true},
				{name: "translation_enabled", kind: "scalar", typeName: "bool", required: true},
				{name: "created_at", kind: "scalar", typeName: "Timestamp", required: true},
				{name: "updated_at", kind: "scalar", typeName: "Timestamp", required: true},
			]
		},
		{
			name:       "BookingListFilters"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingListFilters"
			fields: [
				{name: "assigned_keycloak_user_id", kind: "scalar", typeName: "Identifier", required: false},
				{name: "search", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "BookingList"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingList"
			fields: [
				{name: "items", kind: "transport", typeName: "BookingReadModel", required: true, isArray: true},
				{name: "pagination", kind: "transport", typeName: "Pagination", required: true},
				{name: "filters", kind: "transport", typeName: "BookingListFilters", required: false},
				{name: "sort", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "TourListFilters"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TourListFilters"
			fields: [
				{name: "destination", kind: "enum", typeName: "CountryCode", required: false},
				{name: "style", kind: "enum", typeName: "TourStyleCode", required: false},
				{name: "search", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "TravelPlanServiceSearchResult"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TravelPlanServiceSearchResult"
			fields: [
				{name: "source_booking_id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "source_booking_name", kind: "scalar", typeName: "string", required: false},
				{name: "source_booking_code", kind: "scalar", typeName: "string", required: false},
				{name: "day_number", kind: "scalar", typeName: "int", required: false},
				{name: "service_id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "service_kind", kind: "enum", typeName: "TravelPlanServiceKind", required: false},
				{name: "title", kind: "scalar", typeName: "string", required: true},
				{name: "details", kind: "scalar", typeName: "string", required: false},
				{name: "location", kind: "scalar", typeName: "string", required: false},
				{name: "overnight_location", kind: "scalar", typeName: "string", required: false},
				{name: "thumbnail_url", kind: "scalar", typeName: "string", required: false},
				{name: "image_count", kind: "scalar", typeName: "int", required: false},
				{name: "updated_at", kind: "scalar", typeName: "Timestamp", required: false},
			]
		},
		{
			name:       "TravelPlanServiceSearchResponse"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TravelPlanServiceSearchResponse"
			fields: [
				{name: "items", kind: "transport", typeName: "TravelPlanServiceSearchResult", required: true, isArray: true},
				{name: "total", kind: "scalar", typeName: "int", required: true},
			]
		},
		{
			name:       "TourList"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TourList"
			fields: [
				{name: "items", kind: "entity", typeName: "Tour", required: true, isArray: true},
				{name: "pagination", kind: "transport", typeName: "Pagination", required: true},
				{name: "filters", kind: "transport", typeName: "TourListFilters", required: false},
				{name: "sort", kind: "scalar", typeName: "string", required: false},
				{name: "available_destinations", kind: "transport", typeName: "CatalogOption", required: false, isArray: true},
				{name: "available_styles", kind: "transport", typeName: "CatalogOption", required: false, isArray: true},
			]
		},
		{
			name:       "BookingDetail"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingDetail"
			fields: [
				{name: "booking", kind: "transport", typeName: "BookingReadModel", required: true},
				{name: "unchanged", kind: "scalar", typeName: "bool", required: false},
			]
		},
		{
			name:       "CatalogOption"
			domain:     "api"
			module:     "api"
			sourceType: "api.#CatalogOption"
			fields: [
				{name: "code", kind: "scalar", typeName: "string", required: true},
				{name: "label", kind: "scalar", typeName: "string", required: true},
			]
		},
		{
			name:       "TourOptions"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TourOptions"
			fields: [
				{name: "destinations", kind: "transport", typeName: "CatalogOption", required: false, isArray: true},
				{name: "styles", kind: "transport", typeName: "CatalogOption", required: false, isArray: true},
			]
		},
		{
			name:       "TourDetail"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TourDetail"
			fields: [
				{name: "tour", kind: "entity", typeName: "Tour", required: true},
				{name: "options", kind: "transport", typeName: "TourOptions", required: true},
			]
		},
		{
			name:       "KeycloakUserDirectoryEntry"
			domain:     "api"
			module:     "api"
			sourceType: "api.#KeycloakUserDirectoryEntry"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "name", kind: "scalar", typeName: "string", required: true},
				{name: "active", kind: "scalar", typeName: "bool", required: false},
				{name: "username", kind: "scalar", typeName: "string", required: false},
				{name: "realm_roles", kind: "scalar", typeName: "string", required: false, isArray: true},
				{name: "client_roles", kind: "scalar", typeName: "string", required: false, isArray: true},
				{name: "staff_profile", kind: "entity", typeName: "AtpStaffProfile", required: false},
			]
		},
		{
			name:       "KeycloakUserListResponse"
			domain:     "api"
			module:     "api"
			sourceType: "api.#KeycloakUserListResponse"
			fields: [
				{name: "items", kind: "transport", typeName: "KeycloakUserDirectoryEntry", required: true, isArray: true},
				{name: "total", kind: "scalar", typeName: "int", required: true},
			]
		},
		{
			name:       "KeycloakUserDirectoryEntryResponse"
			domain:     "api"
			module:     "api"
			sourceType: "api.#KeycloakUserDirectoryEntryResponse"
			fields: [
				{name: "user", kind: "transport", typeName: "KeycloakUserDirectoryEntry", required: true},
			]
		},
		{
			name:       "BookingDeleteResponse"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingDeleteResponse"
			fields: [
				{name: "deleted", kind: "scalar", typeName: "bool", required: true},
				{name: "booking_id", kind: "scalar", typeName: "Identifier", required: true},
			]
		},
		{
			name:       "BookingActivitiesResponse"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingActivitiesResponse"
			fields: [
				{name: "items", kind: "entity", typeName: "BookingActivity", required: true, isArray: true},
				{name: "activities", kind: "entity", typeName: "BookingActivity", required: true, isArray: true},
				{name: "total", kind: "scalar", typeName: "int", required: true},
			]
		},
		{
			name:       "BookingActivityResponse"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingActivityResponse"
			fields: [
				{name: "activity", kind: "entity", typeName: "BookingActivity", required: true},
				{name: "booking", kind: "transport", typeName: "BookingReadModel", required: true},
			]
		},
		{
			name:       "BookingPaymentDocumentsResponse"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingPaymentDocumentsResponse"
			fields: [
				{name: "items", kind: "entity", typeName: "BookingPaymentDocument", required: true, isArray: true},
				{name: "total", kind: "scalar", typeName: "int", required: true},
			]
		},
		{
			name:       "BookingPaymentDocumentResponse"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingPaymentDocumentResponse"
			fields: [
				{name: "document", kind: "entity", typeName: "BookingPaymentDocument", required: true},
				{name: "booking", kind: "transport", typeName: "BookingReadModel", required: true},
				{name: "unchanged", kind: "scalar", typeName: "bool", required: false},
			]
		},
		{
			name:       "TranslationEntry"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TranslationEntry"
			fields: [
				{name: "key", kind: "scalar", typeName: "string", required: true},
				{name: "value", kind: "scalar", typeName: "string", required: true},
			]
		},
		{
			name:       "TranslationEntriesResponse"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TranslationEntriesResponse"
			fields: [
				{name: "source_lang", kind: "enum", typeName: "LanguageCode", required: true},
				{name: "target_lang", kind: "enum", typeName: "LanguageCode", required: true},
				{name: "entries", kind: "transport", typeName: "TranslationEntry", required: true, isArray: true},
			]
		},
		{
			name:       "BookingChatEvent"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingChatEvent"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "channel", kind: "scalar", typeName: "string", required: true},
				{name: "direction", kind: "scalar", typeName: "string", required: true},
				{name: "event_type", kind: "scalar", typeName: "string", required: true},
				{name: "external_status", kind: "scalar", typeName: "string", required: false},
				{name: "text_preview", kind: "scalar", typeName: "string", required: true},
				{name: "sender_display", kind: "scalar", typeName: "string", required: false},
				{name: "sender_contact", kind: "scalar", typeName: "string", required: false},
				{name: "sent_at", kind: "scalar", typeName: "Timestamp", required: false},
				{name: "received_at", kind: "scalar", typeName: "Timestamp", required: false},
				{name: "conversation_id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "open_url", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "BookingChatConversation"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingChatConversation"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "channel", kind: "scalar", typeName: "string", required: true},
				{name: "external_contact_id", kind: "scalar", typeName: "string", required: false},
				{name: "booking_id", kind: "scalar", typeName: "Identifier", required: false},
				{name: "last_event_at", kind: "scalar", typeName: "Timestamp", required: false},
				{name: "latest_preview", kind: "scalar", typeName: "string", required: false},
				{name: "open_url", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "BookingChatResponse"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingChatResponse"
			fields: [
				{name: "mode", kind: "scalar", typeName: "string", required: false},
				{name: "items", kind: "transport", typeName: "BookingChatEvent", required: true, isArray: true},
				{name: "total", kind: "scalar", typeName: "int", required: true},
				{name: "conversations", kind: "transport", typeName: "BookingChatConversation", required: true, isArray: true},
				{name: "conversation_total", kind: "scalar", typeName: "int", required: true},
			]
		},
		{
			name:       "SettingsObservabilityLoggedInUser"
			domain:     "api"
			module:     "api"
			sourceType: "api.#SettingsObservabilityLoggedInUser"
			fields: [
				{name: "sub", kind: "scalar", typeName: "string", required: false},
				{name: "preferred_username", kind: "scalar", typeName: "string", required: false},
				{name: "name", kind: "scalar", typeName: "string", required: false},
				{name: "email", kind: "scalar", typeName: "Email", required: false},
				{name: "roles", kind: "scalar", typeName: "string", required: false, isArray: true},
				{name: "session_count", kind: "scalar", typeName: "int", required: true},
				{name: "latest_login_at", kind: "scalar", typeName: "Timestamp", required: false},
				{name: "latest_expires_at", kind: "scalar", typeName: "Timestamp", required: false},
			]
		},
		{
			name:       "SettingsObservabilityBookingActivity"
			domain:     "api"
			module:     "api"
			sourceType: "api.#SettingsObservabilityBookingActivity"
			fields: [
				{name: "type", kind: "scalar", typeName: "string", required: false},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
				{name: "detail", kind: "scalar", typeName: "string", required: false},
				{name: "created_at", kind: "scalar", typeName: "Timestamp", required: false},
			]
		},
		{
			name:       "SettingsObservabilityLatestChangedBooking"
			domain:     "api"
			module:     "api"
			sourceType: "api.#SettingsObservabilityLatestChangedBooking"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "name", kind: "scalar", typeName: "string", required: false},
				{name: "updated_at", kind: "scalar", typeName: "Timestamp", required: false},
				{name: "assigned_keycloak_user_id", kind: "scalar", typeName: "Identifier", required: false},
				{name: "last_activity", kind: "transport", typeName: "SettingsObservabilityBookingActivity", required: false},
			]
		},
		{
			name:       "SettingsObservabilityResponse"
			domain:     "api"
			module:     "api"
			sourceType: "api.#SettingsObservabilityResponse"
			fields: [
				{name: "logged_in_users", kind: "transport", typeName: "SettingsObservabilityLoggedInUser", required: true, isArray: true},
				{name: "session_count", kind: "scalar", typeName: "int", required: true},
				{name: "user_count", kind: "scalar", typeName: "int", required: true},
				{name: "latest_changed_booking", kind: "transport", typeName: "SettingsObservabilityLatestChangedBooking", required: false},
			]
		},
		{
			name:       "OfferExchangeRatesResponse"
			domain:     "api"
			module:     "api"
			sourceType: "api.#OfferExchangeRatesResponse"
			fields: [
				{name: "from_currency", kind: "scalar", typeName: "string", required: true},
				{name: "to_currency", kind: "scalar", typeName: "string", required: true},
				{name: "exchange_rate", kind: "scalar", typeName: "float", required: true},
				{name: "total_price_cents", kind: "scalar", typeName: "int", required: true},
				{name: "converted_lines", kind: "entity", typeName: "BookingOfferAdditionalItem", required: true, isArray: true},
				{name: "warning", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "TourResponse"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TourResponse"
			fields: [
				{name: "tour", kind: "entity", typeName: "Tour", required: true},
			]
		},
		{
			name:       "TravelPlanTemplateReadModel"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TravelPlanTemplateReadModel"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "title", kind: "scalar", typeName: "string", required: true},
				{name: "destinations", kind: "enum", typeName: "CountryCode", required: true, isArray: true},
				{name: "travel_plan", kind: "entity", typeName: "BookingTravelPlan", required: true},
			]
		},
		{
			name:       "TravelPlanTemplateListResponse"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TravelPlanTemplateListResponse"
			fields: [
				{name: "items", kind: "transport", typeName: "TravelPlanTemplateReadModel", required: true, isArray: true},
				{name: "total", kind: "scalar", typeName: "int", required: true},
			]
		},
		{
			name:       "TravelPlanTemplateResponse"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TravelPlanTemplateResponse"
			fields: [
				{name: "template", kind: "transport", typeName: "TravelPlanTemplateReadModel", required: true},
			]
		},
		{
			name:       "MobileBootstrap"
			domain:     "api"
			module:     "api"
			sourceType: "api.#MobileBootstrap"
			fields: [
				{name: "app", kind: "transport", typeName: "MobileAppVersionGate", required: true},
				{name: "api", kind: "transport", typeName: "APIContractVersion", required: true},
				{name: "features", kind: "transport", typeName: "FeatureFlags", required: true},
			]
		},
		{
			name:       "FeatureFlags"
			domain:     "api"
			module:     "api"
			sourceType: "api.#FeatureFlags"
			fields: [
				{name: "bookings", kind: "scalar", typeName: "bool", required: true},
				{name: "tours", kind: "scalar", typeName: "bool", required: true},
			]
		},
		{
			name:       "MobileAppVersionGate"
			domain:     "api"
			module:     "api"
			sourceType: "api.#MobileAppVersionGate"
			fields: [
				{name: "min_supported_version", kind: "scalar", typeName: "string", required: true},
				{name: "latest_version", kind: "scalar", typeName: "string", required: true},
				{name: "force_update", kind: "scalar", typeName: "bool", required: true},
			]
		},
		{
			name:       "APIContractVersion"
			domain:     "api"
			module:     "api"
			sourceType: "api.#APIContractVersion"
			fields: [
				{name: "contract_version", kind: "scalar", typeName: "string", required: true},
			]
		},
		{
			name:       "Pagination"
			domain:     "api"
			module:     "api"
			sourceType: "api.#Pagination"
			fields: [
				{name: "page", kind: "scalar", typeName: "int", required: true},
				{name: "page_size", kind: "scalar", typeName: "int", required: true},
				{name: "total_items", kind: "scalar", typeName: "int", required: true},
				{name: "total_pages", kind: "scalar", typeName: "int", required: true},
			]
		},
		{
			name:       "PaginatedRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#PaginatedRequest"
			fields: [
				{name: "page", kind: "scalar", typeName: "int", required: false},
				{name: "page_size", kind: "scalar", typeName: "int", required: false},
				{name: "sort", kind: "scalar", typeName: "string", required: false},
				{name: "query", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "AuthenticatedUser"
			domain:     "api"
			module:     "api"
			sourceType: "api.#AuthenticatedUser"
			fields: [
				{name: "sub", kind: "scalar", typeName: "string", required: false},
				{name: "name", kind: "scalar", typeName: "string", required: false},
				{name: "given_name", kind: "scalar", typeName: "string", required: false},
				{name: "family_name", kind: "scalar", typeName: "string", required: false},
				{name: "email", kind: "scalar", typeName: "Email", required: false},
				{name: "preferred_username", kind: "scalar", typeName: "string", required: false},
				{name: "roles", kind: "scalar", typeName: "string", required: false, isArray: true},
			]
		},
		{
			name:       "AuthMeResponse"
			domain:     "api"
			module:     "api"
			sourceType: "api.#AuthMeResponse"
			fields: [
				{name: "authenticated", kind: "scalar", typeName: "bool", required: true},
				{name: "user", kind: "transport", typeName: "AuthenticatedUser", required: false},
			]
		},
		{
			name:       "WebsiteBookingForm"
			domain:     "api"
			module:     "api"
			sourceType: "api.#WebsiteBookingForm"
			requireOneOf: [["email", "phone_number"]]
			fields: [
				{name: "destinations", kind: "scalar", typeName: "string", required: false, isArray: true},
				{name: "travel_style", kind: "scalar", typeName: "string", required: false, isArray: true},
				{name: "travel_month", kind: "scalar", typeName: "string", required: false},
				{name: "number_of_travelers", kind: "scalar", typeName: "int", required: false},
				{name: "preferred_currency", kind: "enum", typeName: "CurrencyCode", required: true},
				{name: "travel_duration_days_min", kind: "scalar", typeName: "int", required: false},
				{name: "travel_duration_days_max", kind: "scalar", typeName: "int", required: false},
				{name: "name", kind: "scalar", typeName: "string", required: true},
				{name: "email", kind: "scalar", typeName: "Email", required: false},
				{name: "phone_number", kind: "scalar", typeName: "string", required: false},
				{name: "budget_lower_usd", kind: "scalar", typeName: "int", required: false},
				{name: "budget_upper_usd", kind: "scalar", typeName: "int", required: false},
				{name: "preferred_language", kind: "enum", typeName: "LanguageCode", required: true},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "PublicBookingCreateRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#PublicBookingCreateRequest"
			requireOneOf: [["email", "phone_number"]]
			fields: [
				{name: "destinations", kind: "scalar", typeName: "string", required: false, isArray: true},
				{name: "travel_style", kind: "scalar", typeName: "string", required: false, isArray: true},
				{name: "travel_month", kind: "scalar", typeName: "string", required: false},
				{name: "number_of_travelers", kind: "scalar", typeName: "int", required: false},
				{name: "preferred_currency", kind: "enum", typeName: "CurrencyCode", required: true},
				{name: "travel_duration_days_min", kind: "scalar", typeName: "int", required: false},
				{name: "travel_duration_days_max", kind: "scalar", typeName: "int", required: false},
				{name: "name", kind: "scalar", typeName: "string", required: true},
				{name: "email", kind: "scalar", typeName: "Email", required: false},
				{name: "phone_number", kind: "scalar", typeName: "string", required: false},
				{name: "budget_lower_usd", kind: "scalar", typeName: "int", required: false},
				{name: "budget_upper_usd", kind: "scalar", typeName: "int", required: false},
				{name: "preferred_language", kind: "enum", typeName: "LanguageCode", required: true},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
				{name: "booking_name", kind: "scalar", typeName: "string", required: false},
				{name: "tour_id", kind: "scalar", typeName: "Identifier", required: false},
				{name: "page_url", kind: "scalar", typeName: "string", required: false},
				{name: "referrer", kind: "scalar", typeName: "string", required: false},
				{name: "utm_source", kind: "scalar", typeName: "string", required: false},
				{name: "utm_medium", kind: "scalar", typeName: "string", required: false},
				{name: "utm_campaign", kind: "scalar", typeName: "string", required: false},
				{name: "idempotency_key", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "BookingDeleteRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingDeleteRequest"
			fields: [
				{name: "expected_core_revision", kind: "scalar", typeName: "int", required: false},
			]
		},
		{
			name:       "BookingNameUpdateRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingNameUpdateRequest"
			fields: [
				{name: "expected_core_revision", kind: "scalar", typeName: "int", required: false},
				{name: "name", kind: "scalar", typeName: "string", required: false},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "BookingCustomerLanguageUpdateRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingCustomerLanguageUpdateRequest"
			fields: [
				{name: "expected_core_revision", kind: "scalar", typeName: "int", required: false},
				{name: "customer_language", kind: "enum", typeName: "LanguageCode", required: true},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "BookingSourceUpdateRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingSourceUpdateRequest"
			fields: [
				{name: "expected_core_revision", kind: "scalar", typeName: "int", required: false},
				{name: "source_channel", kind: "enum", typeName: "BookingSourceChannel", required: true},
				{name: "referral_kind", kind: "enum", typeName: "BookingReferralKind", required: true},
				{name: "referral_label", kind: "scalar", typeName: "string", required: false},
				{name: "referral_staff_user_id", kind: "scalar", typeName: "Identifier", required: false},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "BookingImageUploadRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingImageUploadRequest"
			fields: [
				{name: "filename", kind: "scalar", typeName: "string", required: true},
				{name: "mime_type", kind: "scalar", typeName: "string", required: false},
				{name: "data_base64", kind: "scalar", typeName: "string", required: true},
				{name: "expected_core_revision", kind: "scalar", typeName: "int", required: false},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "BookingOwnerUpdateRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingOwnerUpdateRequest"
			fields: [
				{name: "expected_core_revision", kind: "scalar", typeName: "int", required: false},
				{name: "assigned_keycloak_user_id", kind: "scalar", typeName: "Identifier", required: false},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "BookingCloneRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingCloneRequest"
			fields: [
				{name: "expected_core_revision", kind: "scalar", typeName: "int", required: false},
				{name: "name", kind: "scalar", typeName: "string", required: true},
				{name: "include_travelers", kind: "scalar", typeName: "bool", required: false},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "BookingPersonCreateRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingPersonCreateRequest"
			fields: [
				{name: "expected_persons_revision", kind: "scalar", typeName: "int", required: false},
				{name: "person", kind: "entity", typeName: "BookingPerson", required: true},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "BookingPersonUpdateRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingPersonUpdateRequest"
			fields: [
				{name: "expected_persons_revision", kind: "scalar", typeName: "int", required: false},
				{name: "person", kind: "entity", typeName: "BookingPerson", required: true},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "BookingPersonDeleteRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingPersonDeleteRequest"
			fields: [
				{name: "expected_persons_revision", kind: "scalar", typeName: "int", required: false},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "BookingNotesUpdateRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingNotesUpdateRequest"
			fields: [
				{name: "expected_notes_revision", kind: "scalar", typeName: "int", required: false},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "TranslationEntriesRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TranslationEntriesRequest"
			fields: [
				{name: "source_lang", kind: "enum", typeName: "LanguageCode", required: true},
				{name: "target_lang", kind: "enum", typeName: "LanguageCode", required: true},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
				{name: "entries", kind: "transport", typeName: "TranslationEntry", required: true, isArray: true},
			]
		},
		{
			name:       "BookingTravelPlanUpdateRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingTravelPlanUpdateRequest"
			fields: [
				{name: "expected_travel_plan_revision", kind: "scalar", typeName: "int", required: false},
				{name: "travel_plan", kind: "entity", typeName: "BookingTravelPlan", required: true},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "BookingTravelPlanTranslateRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingTravelPlanTranslateRequest"
			fields: [
				{name: "expected_travel_plan_revision", kind: "scalar", typeName: "int", required: false},
				{name: "source_lang", kind: "enum", typeName: "LanguageCode", required: true},
				{name: "target_lang", kind: "enum", typeName: "LanguageCode", required: true},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "TravelPlanTemplateUpsertRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TravelPlanTemplateUpsertRequest"
			fields: [
				{name: "title", kind: "scalar", typeName: "string", required: false},
				{name: "destinations", kind: "enum", typeName: "CountryCode", required: false, isArray: true},
				{name: "source_booking_id", kind: "scalar", typeName: "Identifier", required: false},
				{name: "travel_plan", kind: "entity", typeName: "BookingTravelPlan", required: false},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "BookingTravelPlanTemplateApplyRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingTravelPlanTemplateApplyRequest"
			fields: [
				{name: "expected_travel_plan_revision", kind: "scalar", typeName: "int", required: false},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "TravelPlanServiceSearchRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TravelPlanServiceSearchRequest"
			fields: [
				{name: "q", kind: "scalar", typeName: "string", required: false},
				{name: "destination", kind: "scalar", typeName: "string", required: false},
				{name: "country", kind: "enum", typeName: "CountryCode", required: false},
				{name: "style", kind: "scalar", typeName: "string", required: false},
				{name: "service_kind", kind: "enum", typeName: "TravelPlanServiceKind", required: false},
				{name: "limit", kind: "scalar", typeName: "int", required: false},
				{name: "offset", kind: "scalar", typeName: "int", required: false},
			]
		},
		{
			name:       "TravelPlanServiceImportRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TravelPlanServiceImportRequest"
			fields: [
				{name: "expected_travel_plan_revision", kind: "scalar", typeName: "int", required: false},
				{name: "source_booking_id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "source_service_id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "insert_after_service_id", kind: "scalar", typeName: "Identifier", required: false},
				{name: "include_images", kind: "scalar", typeName: "bool", required: true},
				{name: "include_customer_visible_images_only", kind: "scalar", typeName: "bool", required: true},
				{name: "include_notes", kind: "scalar", typeName: "bool", required: true},
				{name: "include_translations", kind: "scalar", typeName: "bool", required: true},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "TravelPlanServiceImageUploadRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TravelPlanServiceImageUploadRequest"
			fields: [
				{name: "filename", kind: "scalar", typeName: "string", required: true},
				{name: "mime_type", kind: "scalar", typeName: "string", required: false},
				{name: "data_base64", kind: "scalar", typeName: "string", required: true},
				{name: "expected_travel_plan_revision", kind: "scalar", typeName: "int", required: false},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "TravelPlanServiceImageDeleteRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TravelPlanServiceImageDeleteRequest"
			fields: [
				{name: "expected_travel_plan_revision", kind: "scalar", typeName: "int", required: false},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "TravelPlanAttachmentUploadRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TravelPlanAttachmentUploadRequest"
			fields: [
				{name: "filename", kind: "scalar", typeName: "string", required: true},
				{name: "mime_type", kind: "scalar", typeName: "string", required: false},
				{name: "data_base64", kind: "scalar", typeName: "string", required: true},
				{name: "expected_travel_plan_revision", kind: "scalar", typeName: "int", required: false},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "TravelPlanAttachmentDeleteRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TravelPlanAttachmentDeleteRequest"
			fields: [
				{name: "expected_travel_plan_revision", kind: "scalar", typeName: "int", required: false},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "TravelPlanPdfArtifactCreateRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TravelPlanPdfArtifactCreateRequest"
			fields: [
				{name: "expected_travel_plan_revision", kind: "scalar", typeName: "int", required: false},
				{name: "lang", kind: "enum", typeName: "LanguageCode", required: false},
				{name: "filename_suffix", kind: "scalar", typeName: "string", required: false},
				{name: "comment", kind: "scalar", typeName: "string", required: false},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "TravelPlanPdfArtifactUpdateRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TravelPlanPdfArtifactUpdateRequest"
			fields: [
				{name: "expected_travel_plan_revision", kind: "scalar", typeName: "int", required: false},
				{name: "sent_to_customer", kind: "scalar", typeName: "bool", required: false},
				{name: "comment", kind: "scalar", typeName: "string", required: false},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "TravelPlanPdfArtifactDeleteRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TravelPlanPdfArtifactDeleteRequest"
			fields: [
				{name: "expected_travel_plan_revision", kind: "scalar", typeName: "int", required: false},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "BookingOfferUpdateRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingOfferUpdateRequest"
			fields: [
				{name: "expected_offer_revision", kind: "scalar", typeName: "int", required: false},
				{name: "offer", kind: "entity", typeName: "BookingOffer", required: true},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "BookingGenerateOfferRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingGenerateOfferRequest"
			fields: [
				{name: "expected_offer_revision", kind: "scalar", typeName: "int", required: false},
				{name: "comment", kind: "scalar", typeName: "string", required: false},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "OfferExchangeRateLine"
			domain:     "api"
			module:     "api"
			sourceType: "api.#OfferExchangeRateLine"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: false},
				{name: "category", kind: "enum", typeName: "OfferCategory", required: true},
				{name: "quantity", kind: "scalar", typeName: "int", required: true},
				{name: "unit_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "tax_rate_basis_points", kind: "scalar", typeName: "int", required: false},
			]
		},
		{
			name:       "OfferExchangeRatesRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#OfferExchangeRatesRequest"
			fields: [
				{name: "from_currency", kind: "enum", typeName: "CurrencyCode", required: true},
				{name: "to_currency", kind: "enum", typeName: "CurrencyCode", required: true},
				{name: "lines", kind: "transport", typeName: "OfferExchangeRateLine", required: false, isArray: true},
			]
		},
		{
			name:       "BookingActivityCreateRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingActivityCreateRequest"
			fields: [
				{name: "expected_core_revision", kind: "scalar", typeName: "int", required: false},
				{name: "type", kind: "enum", typeName: "BookingActivityType", required: true},
				{name: "detail", kind: "scalar", typeName: "string", required: false},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "BookingPaymentDocumentCreateRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingPaymentDocumentCreateRequest"
			fields: [
				{name: "expected_payment_documents_revision", kind: "scalar", typeName: "int", required: false},
				{name: "document_kind", kind: "scalar", typeName: "string", required: false},
				{name: "payment_id", kind: "scalar", typeName: "Identifier", required: false},
				{name: "payment_received_at", kind: "scalar", typeName: "Timestamp", required: false},
				{name: "payment_confirmed_by_atp_staff_id", kind: "scalar", typeName: "Identifier", required: false},
				{name: "payment_reference", kind: "scalar", typeName: "string", required: false},
				{name: "payment_confirmed_by_label", kind: "scalar", typeName: "string", required: false},
				{name: "pdf_personalization", kind: "scalar", typeName: "string", required: false},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "AtpStaffProfileUpdateRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#AtpStaffProfileUpdateRequest"
			fields: [
				{name: "languages", kind: "enum", typeName: "LanguageCode", required: true, isArray: true},
				{name: "destinations", kind: "enum", typeName: "CountryCode", required: false, isArray: true},
				{name: "full_name", kind: "scalar", typeName: "string", required: false},
				{name: "friendly_short_name", kind: "scalar", typeName: "string", required: false},
				{name: "team_order", kind: "scalar", typeName: "int", required: false},
			]
		},
		{
			name:       "AtpStaffPhotoUploadRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#AtpStaffPhotoUploadRequest"
			fields: [
				{name: "filename", kind: "scalar", typeName: "string", required: true},
				{name: "mime_type", kind: "scalar", typeName: "string", required: false},
				{name: "data_base64", kind: "scalar", typeName: "string", required: true},
			]
		},
		{
			name:       "TourUpsertRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TourUpsertRequest"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: false},
				{name: "title", kind: "scalar", typeName: "string", required: false},
				{name: "destinations", kind: "enum", typeName: "CountryCode", required: false, isArray: true},
				{name: "styles", kind: "enum", typeName: "TourStyleCode", required: false, isArray: true},
				{name: "priority", kind: "scalar", typeName: "int", required: false},
				{name: "seasonality_start_month", kind: "enum", typeName: "MonthCode", required: false},
				{name: "seasonality_end_month", kind: "enum", typeName: "MonthCode", required: false},
				{name: "short_description", kind: "scalar", typeName: "string", required: false},
				{name: "pictures", kind: "scalar", typeName: "string", required: false, isArray: true},
				{name: "image", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "TourTranslateFieldsRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#TourTranslateFieldsRequest"
			fields: [
				{name: "source_lang", kind: "enum", typeName: "LanguageCode", required: true},
				{name: "target_lang", kind: "enum", typeName: "LanguageCode", required: true},
				{name: "actor", kind: "scalar", typeName: "string", required: false},
				{name: "entries", kind: "transport", typeName: "TranslationEntry", required: true, isArray: true},
			]
		},
		{
			name:       "EvidenceUpload"
			domain:     "api"
			module:     "api"
			sourceType: "api.#EvidenceUpload"
			fields: [
				{name: "filename", kind: "scalar", typeName: "string", required: true},
				{name: "mime_type", kind: "scalar", typeName: "string", required: false},
				{name: "data_base64", kind: "scalar", typeName: "string", required: true},
			]
		},
		{
			name:       "ErrorResponse"
			domain:     "api"
			module:     "api"
			sourceType: "api.#ErrorResponse"
			fields: [
				{name: "error", kind: "scalar", typeName: "string", required: true},
				{name: "detail", kind: "scalar", typeName: "string", required: false},
				{name: "code", kind: "scalar", typeName: "string", required: false},
				{name: "request_id", kind: "scalar", typeName: "Identifier", required: false},
			]
		},
	]

	api: {
		endpoints: apiModel.#Endpoints
	}
}
