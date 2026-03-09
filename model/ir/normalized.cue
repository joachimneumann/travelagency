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
		CustomerConsentType: {catalog: "customerConsentTypes"}
		CustomerConsentStatus: {catalog: "customerConsentStatuses"}
		CustomerDocumentType: {catalog: "customerDocumentTypes"}
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
				{name: "preferredUsername", kind: "scalar", typeName: "string", required: true},
				{name: "displayName", kind: "scalar", typeName: "string", required: false},
				{name: "email", kind: "scalar", typeName: "Email", required: false},
				{name: "roles", kind: "enum", typeName: "ATPStaffRole", required: true, isArray: true},
				{name: "atpStaffId", kind: "scalar", typeName: "Identifier", required: false},
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
				{name: "budget_lower_USD", kind: "scalar", typeName: "int", required: false},
				{name: "priority", kind: "scalar", typeName: "int", required: false},
				{name: "rating", kind: "scalar", typeName: "float", required: false},
				{name: "seasonality_start_month", kind: "enum", typeName: "MonthCode", required: false},
				{name: "seasonality_end_month", kind: "enum", typeName: "MonthCode", required: false},
				{name: "shortDescription", kind: "scalar", typeName: "string", required: false},
				{name: "highlights", kind: "scalar", typeName: "string", required: false, isArray: true},
				{name: "image", kind: "scalar", typeName: "string", required: false},
				{name: "createdAt", kind: "scalar", typeName: "Timestamp", required: false},
				{name: "updatedAt", kind: "scalar", typeName: "Timestamp", required: false},
			]
		},
		{
			name:       "SourceAttribution"
			domain:     "booking"
			module:     "entities"
			sourceType: "entities.#SourceAttribution"
			fields: [
				{name: "pageUrl", kind: "scalar", typeName: "string", required: false},
				{name: "ipAddress", kind: "scalar", typeName: "string", required: false},
				{name: "ipCountryGuess", kind: "scalar", typeName: "string", required: false},
				{name: "referrer", kind: "scalar", typeName: "string", required: false},
				{name: "utmSource", kind: "scalar", typeName: "string", required: false},
				{name: "utmMedium", kind: "scalar", typeName: "string", required: false},
				{name: "utmCampaign", kind: "scalar", typeName: "string", required: false},
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
				{name: "consent_type", kind: "enum", typeName: "CustomerConsentType", required: true},
				{name: "status", kind: "enum", typeName: "CustomerConsentStatus", required: true},
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
				{name: "document_type", kind: "enum", typeName: "CustomerDocumentType", required: true},
				{name: "document_number", kind: "scalar", typeName: "string", required: false},
				{name: "document_picture_ref", kind: "scalar", typeName: "string", required: false},
				{name: "issuing_country", kind: "enum", typeName: "CountryCode", required: false},
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
				{name: "netAmount", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
				{name: "createdAt", kind: "scalar", typeName: "Timestamp", required: false},
				{name: "updatedAt", kind: "scalar", typeName: "Timestamp", required: false},
			]
		},
		{
			name:       "InvoiceComponent"
			domain:     "booking"
			module:     "entities"
			sourceType: "entities.#InvoiceComponent"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: false},
				{name: "label", kind: "scalar", typeName: "string", required: true},
				{name: "description", kind: "scalar", typeName: "string", required: false},
				{name: "quantity", kind: "scalar", typeName: "int", required: true},
				{name: "unitNet", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "taxRate", kind: "scalar", typeName: "float", required: true},
			]
		},
		{
			name:       "BookingInvoice"
			domain:     "booking"
			module:     "entities"
			sourceType: "entities.#BookingInvoice"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "invoiceNumber", kind: "scalar", typeName: "string", required: false},
				{name: "currency", kind: "enum", typeName: "CurrencyCode", required: true},
				{name: "issueDate", kind: "scalar", typeName: "DateOnly", required: false},
				{name: "dueDate", kind: "scalar", typeName: "DateOnly", required: false},
				{name: "components", kind: "entity", typeName: "InvoiceComponent", required: true, isArray: true},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
				{name: "sentToCustomer", kind: "scalar", typeName: "bool", required: false},
				{name: "createdAt", kind: "scalar", typeName: "Timestamp", required: false},
				{name: "updatedAt", kind: "scalar", typeName: "Timestamp", required: false},
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
				{name: "netAmount", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "taxRate", kind: "scalar", typeName: "float", required: true},
				{name: "dueDate", kind: "scalar", typeName: "DateOnly", required: false},
				{name: "paidAt", kind: "scalar", typeName: "Timestamp", required: false},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
				{name: "createdAt", kind: "scalar", typeName: "Timestamp", required: false},
				{name: "updatedAt", kind: "scalar", typeName: "Timestamp", required: false},
			]
		},
		{
			name:       "BookingPricingSummary"
			domain:     "booking"
			module:     "entities"
			sourceType: "entities.#BookingPricingSummary"
			fields: [
				{name: "agreedNetAmount", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "adjustedNetAmount", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "scheduledNetAmount", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "unscheduledNetAmount", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "scheduledTaxAmount", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "scheduledGrossAmount", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "paidGrossAmount", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "outstandingGrossAmount", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "isScheduleBalanced", kind: "scalar", typeName: "bool", required: true},
			]
		},
		{
			name:       "BookingPricing"
			domain:     "booking"
			module:     "entities"
			sourceType: "entities.#BookingPricing"
			fields: [
				{name: "currency", kind: "enum", typeName: "CurrencyCode", required: true},
				{name: "agreedNetAmount", kind: "transport", typeName: "MoneyAmount", required: true},
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
				{name: "taxRate", kind: "scalar", typeName: "float", required: true},
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
				{name: "unitNet", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "taxRate", kind: "scalar", typeName: "float", required: true},
				{name: "currency", kind: "enum", typeName: "CurrencyCode", required: true},
				{name: "lineTotalAmountCents", kind: "scalar", typeName: "int", required: false},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
				{name: "sortOrder", kind: "scalar", typeName: "int", required: false},
				{name: "createdAt", kind: "scalar", typeName: "Timestamp", required: false},
				{name: "updatedAt", kind: "scalar", typeName: "Timestamp", required: false},
			]
		},
		{
			name:       "BookingOfferTotals"
			domain:     "booking"
			module:     "entities"
			sourceType: "entities.#BookingOfferTotals"
			fields: [
				{name: "netAmount", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "taxAmount", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "grossAmount", kind: "transport", typeName: "MoneyAmount", required: true},
				{name: "componentsCount", kind: "scalar", typeName: "int", required: true},
			]
		},
		{
			name:       "BookingOffer"
			domain:     "booking"
			module:     "entities"
			sourceType: "entities.#BookingOffer"
			fields: [
				{name: "currency", kind: "enum", typeName: "CurrencyCode", required: true},
				{name: "categoryRules", kind: "entity", typeName: "BookingOfferCategoryRule", required: true, isArray: true},
				{name: "components", kind: "entity", typeName: "BookingOfferComponent", required: true, isArray: true},
				{name: "totals", kind: "entity", typeName: "BookingOfferTotals", required: true},
				{name: "totalPriceCents", kind: "scalar", typeName: "int", required: true},
			]
		},
		{
			name:       "BookingActivity"
			domain:     "booking"
			module:     "entities"
			sourceType: "entities.#BookingActivity"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "bookingId", kind: "scalar", typeName: "Identifier", required: true},
				{name: "type", kind: "enum", typeName: "BookingActivityType", required: true},
				{name: "actor", kind: "scalar", typeName: "string", required: true},
				{name: "detail", kind: "scalar", typeName: "string", required: true},
				{name: "createdAt", kind: "scalar", typeName: "Timestamp", required: true},
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
				{name: "travel_month", kind: "scalar", typeName: "string", required: false},
				{name: "number_of_travelers", kind: "scalar", typeName: "int", required: false},
				{name: "preferred_currency", kind: "enum", typeName: "CurrencyCode", required: false},
				{name: "travel_duration_days_min", kind: "scalar", typeName: "int", required: false},
				{name: "travel_duration_days_max", kind: "scalar", typeName: "int", required: false},
				{name: "name", kind: "scalar", typeName: "string", required: false},
				{name: "email", kind: "scalar", typeName: "Email", required: false},
				{name: "phone_number", kind: "scalar", typeName: "string", required: false},
				{name: "budget_lower_USD", kind: "scalar", typeName: "int", required: false},
				{name: "budget_upper_USD", kind: "scalar", typeName: "int", required: false},
				{name: "preferred_language", kind: "enum", typeName: "LanguageCode", required: false},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
				{name: "submittedAt", kind: "scalar", typeName: "Timestamp", required: false},
			]
		},
		{
			name:       "Booking"
			domain:     "booking"
			module:     "entities"
			sourceType: "entities.#Booking"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "booking_hash", kind: "scalar", typeName: "string", required: false},
				{name: "stage", kind: "enum", typeName: "BookingStage", required: true},
				{name: "atp_staff", kind: "scalar", typeName: "Identifier", required: false},
				{name: "serviceLevelAgreementDueAt", kind: "scalar", typeName: "Timestamp", required: false},
				{name: "destinations", kind: "enum", typeName: "CountryCode", required: false, isArray: true},
				{name: "travel_styles", kind: "scalar", typeName: "string", required: false, isArray: true},
				{name: "travel_start_day", kind: "scalar", typeName: "DateOnly", required: false},
				{name: "travel_end_day", kind: "scalar", typeName: "DateOnly", required: false},
				{name: "number_of_travelers", kind: "scalar", typeName: "int", required: false},
				{name: "preferredCurrency", kind: "enum", typeName: "CurrencyCode", required: false},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
				{name: "persons", kind: "entity", typeName: "BookingPerson", required: false, isArray: true},
				{name: "web_form_submission", kind: "entity", typeName: "BookingWebFormSubmission", required: false},
				{name: "pricing", kind: "entity", typeName: "BookingPricing", required: true},
				{name: "offer", kind: "entity", typeName: "BookingOffer", required: true},
				{name: "source", kind: "entity", typeName: "SourceAttribution", required: false},
				{name: "createdAt", kind: "scalar", typeName: "Timestamp", required: true},
				{name: "updatedAt", kind: "scalar", typeName: "Timestamp", required: true},
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
			name:       "BookingChatEvent"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingChatEvent"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "channel", kind: "scalar", typeName: "string", required: true},
				{name: "direction", kind: "scalar", typeName: "string", required: true},
				{name: "eventType", kind: "scalar", typeName: "string", required: true},
				{name: "externalStatus", kind: "scalar", typeName: "string", required: false},
				{name: "textPreview", kind: "scalar", typeName: "string", required: true},
				{name: "senderDisplay", kind: "scalar", typeName: "string", required: false},
				{name: "senderContact", kind: "scalar", typeName: "string", required: false},
				{name: "sentAt", kind: "scalar", typeName: "Timestamp", required: false},
				{name: "receivedAt", kind: "scalar", typeName: "Timestamp", required: false},
				{name: "conversationId", kind: "scalar", typeName: "Identifier", required: true},
				{name: "openUrl", kind: "scalar", typeName: "string", required: false},
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
				{name: "externalContactId", kind: "scalar", typeName: "string", required: false},
				{name: "clientId", kind: "scalar", typeName: "Identifier", required: false},
				{name: "bookingId", kind: "scalar", typeName: "Identifier", required: false},
				{name: "lastEventAt", kind: "scalar", typeName: "Timestamp", required: false},
				{name: "latestPreview", kind: "scalar", typeName: "string", required: false},
				{name: "openUrl", kind: "scalar", typeName: "string", required: false},
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
				{name: "conversationTotal", kind: "scalar", typeName: "int", required: true},
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
				{name: "customers", kind: "scalar", typeName: "bool", required: true},
				{name: "tours", kind: "scalar", typeName: "bool", required: true},
			]
		},
		{
			name:       "MobileAppVersionGate"
			domain:     "api"
			module:     "api"
			sourceType: "api.#MobileAppVersionGate"
			fields: [
				{name: "minSupportedVersion", kind: "scalar", typeName: "string", required: true},
				{name: "latestVersion", kind: "scalar", typeName: "string", required: true},
				{name: "forceUpdate", kind: "scalar", typeName: "bool", required: true},
			]
		},
		{
			name:       "APIContractVersion"
			domain:     "api"
			module:     "api"
			sourceType: "api.#APIContractVersion"
			fields: [
				{name: "contractVersion", kind: "scalar", typeName: "string", required: true},
			]
		},
		{
			name:       "Pagination"
			domain:     "api"
			module:     "api"
			sourceType: "api.#Pagination"
			fields: [
				{name: "page", kind: "scalar", typeName: "int", required: true},
				{name: "pageSize", kind: "scalar", typeName: "int", required: true},
				{name: "totalItems", kind: "scalar", typeName: "int", required: true},
			]
		},
		{
			name:       "PaginatedRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#PaginatedRequest"
			fields: [
				{name: "page", kind: "scalar", typeName: "int", required: false},
				{name: "pageSize", kind: "scalar", typeName: "int", required: false},
				{name: "sort", kind: "scalar", typeName: "string", required: false},
				{name: "query", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "AuthMeResponse"
			domain:     "api"
			module:     "api"
			sourceType: "api.#AuthMeResponse"
			fields: [
				{name: "authenticated", kind: "scalar", typeName: "bool", required: true},
				{name: "principal", kind: "entity", typeName: "ATPStaff", required: false},
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
				{name: "budget_lower_USD", kind: "scalar", typeName: "int", required: false},
				{name: "budget_upper_USD", kind: "scalar", typeName: "int", required: false},
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
				{name: "budget_lower_USD", kind: "scalar", typeName: "int", required: false},
				{name: "budget_upper_USD", kind: "scalar", typeName: "int", required: false},
				{name: "preferred_language", kind: "enum", typeName: "LanguageCode", required: true},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
				{name: "pageUrl", kind: "scalar", typeName: "string", required: false},
				{name: "referrer", kind: "scalar", typeName: "string", required: false},
				{name: "utm_source", kind: "scalar", typeName: "string", required: false},
				{name: "utm_medium", kind: "scalar", typeName: "string", required: false},
				{name: "utm_campaign", kind: "scalar", typeName: "string", required: false},
				{name: "idempotencyKey", kind: "scalar", typeName: "string", required: false},
				{name: "tourId", kind: "scalar", typeName: "string", required: false},
				{name: "tourTitle", kind: "scalar", typeName: "string", required: false},
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
			]
		},
	]

	api: {
		endpoints: apiModel.#Endpoints
	}
}
