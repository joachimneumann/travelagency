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
	domain:     "currency" | "atp_staff" | "booking" | "aux" | "api"
	module:     "entities" | "api" | "common" | "enums"
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
		BookingStage: {catalog: "stages"}
		BookingPersonRole: {catalog: "bookingPersonRoles"}
		PaymentStatus: {catalog: "paymentStatuses"}
		PricingAdjustmentType: {catalog: "pricingAdjustmentTypes"}
		OfferCategory: {catalog: "offerCategories"}
		CountryCode: {catalog: "countries"}
		TimezoneCode: {catalog: "timezones"}
		PersonConsentType: {catalog: "personConsentTypes"}
		PersonConsentStatus: {catalog: "personConsentStatuses"}
		PersonDocumentType: {catalog: "personDocumentTypes"}
		BookingActivityType: {catalog: "bookingActivityTypes"}
	}

		types: [
			{
				name:       "ATPStaff"
				domain:     "atp_staff"
				module:     "entities"
				sourceType: "entities.#ATPStaff"
				fields: [
					{name: "id", kind: "scalar", typeName: "Identifier", required: true},
					{name: "preferred_username", kind: "scalar", typeName: "string", required: true},
					{name: "display_name", kind: "scalar", typeName: "string", required: false},
					{name: "email", kind: "scalar", typeName: "Email", required: false},
					{name: "roles", kind: "enum", typeName: "ATPStaffRole", required: true, isArray: true},
					{name: "staff_id", kind: "scalar", typeName: "Identifier", required: false},
					{name: "active", kind: "scalar", typeName: "bool", required: false},
					{name: "created_at", kind: "scalar", typeName: "Timestamp", required: false},
					{name: "updated_at", kind: "scalar", typeName: "Timestamp", required: false},
				]
			},
			{
				name:       "Tour"
				domain:     "aux"
				module:     "entities"
				sourceType: "entities.#Tour"
				fields: [
					{name: "id", kind: "scalar", typeName: "Identifier", required: true},
					{name: "title", kind: "scalar", typeName: "string", required: false},
					{name: "destinations", kind: "scalar", typeName: "string", required: true, isArray: true},
					{name: "styles", kind: "scalar", typeName: "string", required: true, isArray: true},
					{name: "travel_duration_days", kind: "scalar", typeName: "int", required: false},
					{name: "budget_lower_usd", kind: "scalar", typeName: "int", required: false},
					{name: "priority", kind: "scalar", typeName: "int", required: false},
					{name: "rating", kind: "scalar", typeName: "float", required: false},
					{name: "seasonality_start_month", kind: "enum", typeName: "MonthCode", required: false},
					{name: "seasonality_end_month", kind: "enum", typeName: "MonthCode", required: false},
					{name: "short_description", kind: "scalar", typeName: "string", required: false},
					{name: "highlights", kind: "scalar", typeName: "string", required: false, isArray: true},
					{name: "image", kind: "scalar", typeName: "string", required: false},
					{name: "created_at", kind: "scalar", typeName: "Timestamp", required: false},
					{name: "updated_at", kind: "scalar", typeName: "Timestamp", required: false},
				]
			},
			{
				name:       "BookingPersonAddress"
				domain:     "booking"
				module:     "entities"
				sourceType: "entities.#BookingPersonAddress"
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
				module:     "entities"
				sourceType: "entities.#BookingPersonConsent"
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
				module:     "entities"
				sourceType: "entities.#BookingPersonDocument"
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
				module:     "entities"
				sourceType: "entities.#BookingPerson"
				fields: [
					{name: "id", kind: "scalar", typeName: "Identifier", required: true},
					{name: "name", kind: "scalar", typeName: "string", required: true},
					{name: "photo_ref", kind: "scalar", typeName: "string", required: false},
					{name: "emails", kind: "scalar", typeName: "Email", required: false, isArray: true},
					{name: "phone_numbers", kind: "scalar", typeName: "string", required: false, isArray: true},
					{name: "preferred_language", kind: "enum", typeName: "LanguageCode", required: false},
					{name: "date_of_birth", kind: "scalar", typeName: "DateOnly", required: false},
					{name: "nationality", kind: "enum", typeName: "CountryCode", required: false},
					{name: "address", kind: "entity", typeName: "BookingPersonAddress", required: false},
					{name: "roles", kind: "enum", typeName: "BookingPersonRole", required: false, isArray: true},
					{name: "consents", kind: "entity", typeName: "BookingPersonConsent", required: false, isArray: true},
					{name: "documents", kind: "entity", typeName: "BookingPersonDocument", required: false, isArray: true},
					{name: "notes", kind: "scalar", typeName: "string", required: false},
				]
			},
			{
				name:       "PricingAdjustment"
				domain:     "booking"
				module:     "entities"
				sourceType: "entities.#PricingAdjustment"
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
				name:       "InvoiceComponent"
				domain:     "booking"
				module:     "entities"
				sourceType: "entities.#InvoiceComponent"
				fields: [
					{name: "id", kind: "scalar", typeName: "Identifier", required: false},
					{name: "description", kind: "scalar", typeName: "string", required: true},
					{name: "quantity", kind: "scalar", typeName: "int", required: true},
					{name: "unit_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
					{name: "total_amount_cents", kind: "transport", typeName: "MoneyAmount", required: false},
				]
			},
			{
				name:       "BookingInvoice"
				domain:     "booking"
				module:     "entities"
				sourceType: "entities.#BookingInvoice"
				fields: [
					{name: "id", kind: "scalar", typeName: "Identifier", required: true},
					{name: "booking_id", kind: "scalar", typeName: "Identifier", required: false},
					{name: "invoice_number", kind: "scalar", typeName: "string", required: false},
					{name: "version", kind: "scalar", typeName: "int", required: false},
					{name: "status", kind: "scalar", typeName: "string", required: false},
					{name: "currency", kind: "enum", typeName: "CurrencyCode", required: true},
					{name: "issue_date", kind: "scalar", typeName: "DateOnly", required: false},
					{name: "due_date", kind: "scalar", typeName: "DateOnly", required: false},
					{name: "title", kind: "scalar", typeName: "string", required: false},
					{name: "components", kind: "entity", typeName: "InvoiceComponent", required: true, isArray: true},
					{name: "notes", kind: "scalar", typeName: "string", required: false},
					{name: "sent_to_recipient", kind: "scalar", typeName: "bool", required: false},
					{name: "sent_to_recipient_at", kind: "scalar", typeName: "Timestamp", required: false},
					{name: "total_amount_cents", kind: "transport", typeName: "MoneyAmount", required: false},
					{name: "due_amount_cents", kind: "transport", typeName: "MoneyAmount", required: false},
					{name: "created_at", kind: "scalar", typeName: "Timestamp", required: false},
					{name: "updated_at", kind: "scalar", typeName: "Timestamp", required: false},
					{name: "pdf_url", kind: "scalar", typeName: "string", required: false},
				]
			},
			{
				name:       "BookingPayment"
				domain:     "booking"
				module:     "entities"
				sourceType: "entities.#BookingPayment"
				fields: [
					{name: "id", kind: "scalar", typeName: "Identifier", required: true},
					{name: "label", kind: "scalar", typeName: "string", required: true},
					{name: "status", kind: "enum", typeName: "PaymentStatus", required: true},
					{name: "net_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
					{name: "tax_rate_basis_points", kind: "scalar", typeName: "int", required: true},
					{name: "due_date", kind: "scalar", typeName: "DateOnly", required: false},
					{name: "paid_at", kind: "scalar", typeName: "Timestamp", required: false},
					{name: "notes", kind: "scalar", typeName: "string", required: false},
					{name: "tax_amount_cents", kind: "transport", typeName: "MoneyAmount", required: false},
					{name: "gross_amount_cents", kind: "transport", typeName: "MoneyAmount", required: false},
					{name: "created_at", kind: "scalar", typeName: "Timestamp", required: false},
					{name: "updated_at", kind: "scalar", typeName: "Timestamp", required: false},
				]
			},
			{
				name:       "BookingPricingSummary"
				domain:     "booking"
				module:     "entities"
				sourceType: "entities.#BookingPricingSummary"
				fields: [
					{name: "agreed_net_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
					{name: "adjustments_delta_cents", kind: "transport", typeName: "MoneyAmount", required: true},
					{name: "adjusted_net_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
					{name: "scheduled_net_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
					{name: "unscheduled_net_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
					{name: "scheduled_tax_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
					{name: "scheduled_gross_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
					{name: "paid_gross_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
					{name: "outstanding_gross_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
					{name: "is_schedule_balanced", kind: "scalar", typeName: "bool", required: true},
				]
			},
			{
				name:       "BookingPricing"
				domain:     "booking"
				module:     "entities"
				sourceType: "entities.#BookingPricing"
				fields: [
					{name: "currency", kind: "enum", typeName: "CurrencyCode", required: true},
					{name: "agreed_net_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
					{name: "adjustments", kind: "entity", typeName: "PricingAdjustment", required: true, isArray: true},
					{name: "payments", kind: "entity", typeName: "BookingPayment", required: true, isArray: true},
					{name: "summary", kind: "entity", typeName: "BookingPricingSummary", required: true},
				]
			},
			{
				name:       "BookingOfferCategoryRule"
				domain:     "booking"
				module:     "entities"
				sourceType: "entities.#BookingOfferCategoryRule"
				fields: [
					{name: "category", kind: "enum", typeName: "OfferCategory", required: true},
					{name: "tax_rate_basis_points", kind: "scalar", typeName: "int", required: true},
				]
			},
			{
				name:       "BookingOfferComponent"
				domain:     "booking"
				module:     "entities"
				sourceType: "entities.#BookingOfferComponent"
				fields: [
					{name: "id", kind: "scalar", typeName: "Identifier", required: true},
					{name: "category", kind: "enum", typeName: "OfferCategory", required: true},
					{name: "label", kind: "scalar", typeName: "string", required: true},
					{name: "details", kind: "scalar", typeName: "string", required: false},
					{name: "quantity", kind: "scalar", typeName: "int", required: true},
					{name: "unit_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
					{name: "tax_rate_basis_points", kind: "scalar", typeName: "int", required: true},
					{name: "currency", kind: "enum", typeName: "CurrencyCode", required: true},
					{name: "line_net_amount_cents", kind: "transport", typeName: "MoneyAmount", required: false},
					{name: "line_tax_amount_cents", kind: "transport", typeName: "MoneyAmount", required: false},
					{name: "line_total_amount_cents", kind: "scalar", typeName: "int", required: false},
					{name: "notes", kind: "scalar", typeName: "string", required: false},
					{name: "sort_order", kind: "scalar", typeName: "int", required: false},
					{name: "created_at", kind: "scalar", typeName: "Timestamp", required: false},
					{name: "updated_at", kind: "scalar", typeName: "Timestamp", required: false},
				]
			},
			{
				name:       "BookingOfferTotals"
				domain:     "booking"
				module:     "entities"
				sourceType: "entities.#BookingOfferTotals"
				fields: [
					{name: "net_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
					{name: "tax_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
					{name: "gross_amount_cents", kind: "transport", typeName: "MoneyAmount", required: true},
					{name: "total_price_cents", kind: "transport", typeName: "MoneyAmount", required: true},
					{name: "items_count", kind: "scalar", typeName: "int", required: true},
				]
			},
			{
				name:       "BookingOffer"
				domain:     "booking"
				module:     "entities"
				sourceType: "entities.#BookingOffer"
				fields: [
					{name: "currency", kind: "enum", typeName: "CurrencyCode", required: true},
					{name: "category_rules", kind: "entity", typeName: "BookingOfferCategoryRule", required: true, isArray: true},
					{name: "components", kind: "entity", typeName: "BookingOfferComponent", required: true, isArray: true},
					{name: "totals", kind: "entity", typeName: "BookingOfferTotals", required: true},
					{name: "total_price_cents", kind: "scalar", typeName: "int", required: true},
				]
			},
			{
				name:       "BookingActivity"
				domain:     "booking"
				module:     "entities"
				sourceType: "entities.#BookingActivity"
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
				module:     "entities"
				sourceType: "entities.#BookingWebFormSubmission"
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
				module:     "entities"
				sourceType: "entities.#Booking"
				fields: [
					{name: "id", kind: "scalar", typeName: "Identifier", required: true},
					{name: "name", kind: "scalar", typeName: "string", required: false},
					{name: "booking_hash", kind: "scalar", typeName: "string", required: false},
					{name: "stage", kind: "enum", typeName: "BookingStage", required: true},
					{name: "atp_staff", kind: "scalar", typeName: "Identifier", required: false},
					{name: "service_level_agreement_due_at", kind: "scalar", typeName: "Timestamp", required: false},
					{name: "destinations", kind: "enum", typeName: "CountryCode", required: false, isArray: true},
					{name: "travel_styles", kind: "scalar", typeName: "string", required: false, isArray: true},
					{name: "travel_start_day", kind: "scalar", typeName: "DateOnly", required: false},
					{name: "travel_end_day", kind: "scalar", typeName: "DateOnly", required: false},
					{name: "number_of_travelers", kind: "scalar", typeName: "int", required: false},
					{name: "preferred_currency", kind: "enum", typeName: "CurrencyCode", required: false},
					{name: "notes", kind: "scalar", typeName: "string", required: false},
					{name: "persons", kind: "entity", typeName: "BookingPerson", required: false, isArray: true},
					{name: "web_form_submission", kind: "entity", typeName: "BookingWebFormSubmission", required: false},
					{name: "pricing", kind: "entity", typeName: "BookingPricing", required: true},
					{name: "offer", kind: "entity", typeName: "BookingOffer", required: true},
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
					{name: "stage", kind: "scalar", typeName: "string", required: false},
					{name: "atp_staff", kind: "scalar", typeName: "Identifier", required: false},
					{name: "search", kind: "scalar", typeName: "string", required: false},
				]
			},
			{
				name:       "BookingList"
				domain:     "api"
				module:     "api"
				sourceType: "api.#BookingList"
				fields: [
					{name: "items", kind: "entity", typeName: "Booking", required: true, isArray: true},
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
					{name: "destination", kind: "scalar", typeName: "string", required: false},
					{name: "style", kind: "scalar", typeName: "string", required: false},
					{name: "search", kind: "scalar", typeName: "string", required: false},
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
					{name: "available_destinations", kind: "scalar", typeName: "string", required: false, isArray: true},
					{name: "available_styles", kind: "scalar", typeName: "string", required: false, isArray: true},
				]
			},
			{
				name:       "BookingDetail"
				domain:     "api"
				module:     "api"
				sourceType: "api.#BookingDetail"
				fields: [
					{name: "booking", kind: "entity", typeName: "Booking", required: true},
				]
			},
			{
				name:       "TourOptions"
				domain:     "api"
				module:     "api"
				sourceType: "api.#TourOptions"
				fields: [
					{name: "destinations", kind: "scalar", typeName: "string", required: false, isArray: true},
					{name: "styles", kind: "scalar", typeName: "string", required: false, isArray: true},
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
				name:       "AtpStaffDirectoryEntry"
				domain:     "api"
				module:     "api"
				sourceType: "api.#AtpStaffDirectoryEntry"
				fields: [
					{name: "id", kind: "scalar", typeName: "Identifier", required: true},
					{name: "name", kind: "scalar", typeName: "string", required: true},
					{name: "active", kind: "scalar", typeName: "bool", required: false},
					{name: "usernames", kind: "scalar", typeName: "string", required: false, isArray: true},
					{name: "destinations", kind: "scalar", typeName: "string", required: false, isArray: true},
					{name: "languages", kind: "scalar", typeName: "string", required: false, isArray: true},
				]
			},
			{
				name:       "AtpStaffListResponse"
				domain:     "api"
				module:     "api"
				sourceType: "api.#AtpStaffListResponse"
				fields: [
					{name: "items", kind: "transport", typeName: "AtpStaffDirectoryEntry", required: true, isArray: true},
					{name: "total", kind: "scalar", typeName: "int", required: true},
				]
			},
			{
				name:       "AtpStaffResponse"
				domain:     "api"
				module:     "api"
				sourceType: "api.#AtpStaffResponse"
				fields: [
					{name: "atp_staff", kind: "transport", typeName: "AtpStaffDirectoryEntry", required: true},
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
					{name: "booking", kind: "entity", typeName: "Booking", required: true},
				]
			},
			{
				name:       "BookingInvoicesResponse"
				domain:     "api"
				module:     "api"
				sourceType: "api.#BookingInvoicesResponse"
				fields: [
					{name: "items", kind: "entity", typeName: "BookingInvoice", required: true, isArray: true},
					{name: "total", kind: "scalar", typeName: "int", required: true},
				]
			},
			{
				name:       "BookingInvoiceResponse"
				domain:     "api"
				module:     "api"
				sourceType: "api.#BookingInvoiceResponse"
				fields: [
					{name: "invoice", kind: "entity", typeName: "BookingInvoice", required: true},
					{name: "booking", kind: "entity", typeName: "Booking", required: true},
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
				name:       "OfferExchangeRatesResponse"
				domain:     "api"
				module:     "api"
				sourceType: "api.#OfferExchangeRatesResponse"
				fields: [
					{name: "from_currency", kind: "scalar", typeName: "string", required: true},
					{name: "to_currency", kind: "scalar", typeName: "string", required: true},
					{name: "exchange_rate", kind: "scalar", typeName: "float", required: true},
					{name: "total_price_cents", kind: "scalar", typeName: "int", required: true},
					{name: "converted_components", kind: "entity", typeName: "BookingOfferComponent", required: true, isArray: true},
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
					{name: "booking_hash", kind: "scalar", typeName: "string", required: false},
				]
			},
			{
				name:       "BookingNameUpdateRequest"
				domain:     "api"
				module:     "api"
				sourceType: "api.#BookingNameUpdateRequest"
				fields: [
					{name: "booking_hash", kind: "scalar", typeName: "string", required: false},
					{name: "name", kind: "scalar", typeName: "string", required: false},
					{name: "actor", kind: "scalar", typeName: "string", required: false},
				]
			},
			{
				name:       "BookingStageUpdateRequest"
				domain:     "api"
				module:     "api"
				sourceType: "api.#BookingStageUpdateRequest"
				fields: [
					{name: "booking_hash", kind: "scalar", typeName: "string", required: false},
					{name: "stage", kind: "enum", typeName: "BookingStage", required: true},
					{name: "actor", kind: "scalar", typeName: "string", required: false},
				]
			},
			{
				name:       "BookingOwnerUpdateRequest"
				domain:     "api"
				module:     "api"
				sourceType: "api.#BookingOwnerUpdateRequest"
				fields: [
					{name: "booking_hash", kind: "scalar", typeName: "string", required: false},
					{name: "atp_staff", kind: "scalar", typeName: "Identifier", required: false},
					{name: "actor", kind: "scalar", typeName: "string", required: false},
				]
			},
			{
				name:       "BookingPersonsUpdateRequest"
				domain:     "api"
				module:     "api"
				sourceType: "api.#BookingPersonsUpdateRequest"
				fields: [
					{name: "booking_hash", kind: "scalar", typeName: "string", required: false},
					{name: "persons", kind: "entity", typeName: "BookingPerson", required: true, isArray: true},
					{name: "actor", kind: "scalar", typeName: "string", required: false},
				]
			},
			{
				name:       "BookingNotesUpdateRequest"
				domain:     "api"
				module:     "api"
				sourceType: "api.#BookingNotesUpdateRequest"
				fields: [
					{name: "booking_hash", kind: "scalar", typeName: "string", required: false},
					{name: "notes", kind: "scalar", typeName: "string", required: false},
					{name: "actor", kind: "scalar", typeName: "string", required: false},
				]
			},
			{
				name:       "BookingPricingUpdateRequest"
				domain:     "api"
				module:     "api"
				sourceType: "api.#BookingPricingUpdateRequest"
				fields: [
					{name: "booking_hash", kind: "scalar", typeName: "string", required: false},
					{name: "pricing", kind: "entity", typeName: "BookingPricing", required: true},
					{name: "actor", kind: "scalar", typeName: "string", required: false},
				]
			},
			{
				name:       "BookingOfferUpdateRequest"
				domain:     "api"
				module:     "api"
				sourceType: "api.#BookingOfferUpdateRequest"
				fields: [
					{name: "booking_hash", kind: "scalar", typeName: "string", required: false},
					{name: "offer", kind: "entity", typeName: "BookingOffer", required: true},
					{name: "actor", kind: "scalar", typeName: "string", required: false},
				]
			},
			{
				name:       "OfferExchangeRateComponent"
				domain:     "api"
				module:     "api"
				sourceType: "api.#OfferExchangeRateComponent"
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
					{name: "components", kind: "transport", typeName: "OfferExchangeRateComponent", required: false, isArray: true},
				]
			},
			{
				name:       "BookingActivityCreateRequest"
				domain:     "api"
				module:     "api"
				sourceType: "api.#BookingActivityCreateRequest"
				fields: [
					{name: "booking_hash", kind: "scalar", typeName: "string", required: false},
					{name: "type", kind: "enum", typeName: "BookingActivityType", required: true},
					{name: "detail", kind: "scalar", typeName: "string", required: false},
					{name: "actor", kind: "scalar", typeName: "string", required: false},
				]
			},
			{
				name:       "BookingInvoiceUpsertRequest"
				domain:     "api"
				module:     "api"
				sourceType: "api.#BookingInvoiceUpsertRequest"
				fields: [
					{name: "booking_hash", kind: "scalar", typeName: "string", required: false},
					{name: "invoice_number", kind: "scalar", typeName: "string", required: false},
					{name: "currency", kind: "enum", typeName: "CurrencyCode", required: false},
					{name: "issue_date", kind: "scalar", typeName: "DateOnly", required: false},
					{name: "due_date", kind: "scalar", typeName: "DateOnly", required: false},
					{name: "title", kind: "scalar", typeName: "string", required: false},
					{name: "notes", kind: "scalar", typeName: "string", required: false},
					{name: "components", kind: "entity", typeName: "InvoiceComponent", required: false, isArray: true},
					{name: "due_amount_cents", kind: "transport", typeName: "MoneyAmount", required: false},
					{name: "sent_to_recipient", kind: "scalar", typeName: "bool", required: false},
				]
			},
			{
				name:       "AtpStaffCreateRequest"
				domain:     "api"
				module:     "api"
				sourceType: "api.#AtpStaffCreateRequest"
				fields: [
					{name: "name", kind: "scalar", typeName: "string", required: true},
					{name: "active", kind: "scalar", typeName: "bool", required: false},
					{name: "usernames", kind: "scalar", typeName: "string", required: true, isArray: true},
					{name: "destinations", kind: "scalar", typeName: "string", required: false, isArray: true},
					{name: "languages", kind: "scalar", typeName: "string", required: false, isArray: true},
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
					{name: "destinations", kind: "scalar", typeName: "string", required: false, isArray: true},
					{name: "styles", kind: "scalar", typeName: "string", required: false, isArray: true},
					{name: "travel_duration_days", kind: "scalar", typeName: "int", required: false},
					{name: "budget_lower_usd", kind: "scalar", typeName: "int", required: false},
					{name: "priority", kind: "scalar", typeName: "int", required: false},
					{name: "rating", kind: "scalar", typeName: "float", required: false},
					{name: "seasonality_start_month", kind: "enum", typeName: "MonthCode", required: false},
					{name: "seasonality_end_month", kind: "enum", typeName: "MonthCode", required: false},
					{name: "short_description", kind: "scalar", typeName: "string", required: false},
					{name: "highlights", kind: "scalar", typeName: "string", required: false, isArray: true},
					{name: "image", kind: "scalar", typeName: "string", required: false},
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
