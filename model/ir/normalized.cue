package ir

import (
	apiModel "travelagency.local/model/api"
	enumModel "travelagency.local/model/enums"
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

	catalogs: {
		currencies: [
			for currency in enumModel.CurrencyCatalog {
				{
					code:          currency.code
					symbol:        currency.displaySymbol
					decimalPlaces: currency.decimalPlaces
				}
			},
		]
		roles: [for role in enumModel.ATPStaffRoleCatalog {{code: role}}]
		stages: [for stage in enumModel.BookingStageCatalog {{code: stage}}]
		paymentStatuses: [for status in enumModel.PaymentStatusCatalog {{code: status}}]
		pricingAdjustmentTypes: [for adjustmentType in enumModel.PricingAdjustmentTypeCatalog {{code: adjustmentType}}]
		offerCategories: [for category in enumModel.OfferCategoryCatalog {{code: category}}]
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
				name:       "Customer"
				domain:     "aux"
				module:     "entities"
				sourceType: "entities.#Customer"
				fields: [
					{name: "id", kind: "scalar", typeName: "Identifier", required: true},
					{name: "display_name", kind: "scalar", typeName: "string", required: true},
				{name: "first_name", kind: "scalar", typeName: "string", required: false},
				{name: "last_name", kind: "scalar", typeName: "string", required: false},
				{name: "date_of_birth", kind: "scalar", typeName: "DateOnly", required: false},
				{name: "nationality", kind: "scalar", typeName: "string", required: false},
				{name: "organization_name", kind: "scalar", typeName: "string", required: false},
				{name: "organization_address", kind: "scalar", typeName: "string", required: false},
				{name: "organization_phone_number", kind: "scalar", typeName: "string", required: false},
				{name: "organization_webpage", kind: "scalar", typeName: "string", required: false},
				{name: "organization_email", kind: "scalar", typeName: "Email", required: false},
				{name: "tax_id", kind: "scalar", typeName: "string", required: false},
				{name: "phone_number", kind: "scalar", typeName: "string", required: false},
				{name: "email", kind: "scalar", typeName: "Email", required: false},
				{name: "address_line_1", kind: "scalar", typeName: "string", required: false},
				{name: "address_line_2", kind: "scalar", typeName: "string", required: false},
				{name: "address_city", kind: "scalar", typeName: "string", required: false},
				{name: "address_state_region", kind: "scalar", typeName: "string", required: false},
				{name: "address_postal_code", kind: "scalar", typeName: "string", required: false},
				{name: "address_country_code", kind: "scalar", typeName: "string", required: false},
				{name: "preferred_language", kind: "scalar", typeName: "string", required: false},
				{name: "preferred_currency", kind: "scalar", typeName: "string", required: false},
				{name: "timezone", kind: "scalar", typeName: "string", required: false},
				{name: "tags", kind: "scalar", typeName: "string", required: false, isArray: true},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
				{name: "can_receive_marketing", kind: "scalar", typeName: "bool", required: true},
				{name: "created_at", kind: "scalar", typeName: "Timestamp", required: true},
				{name: "updated_at", kind: "scalar", typeName: "Timestamp", required: true},
				{name: "archived_at", kind: "scalar", typeName: "Timestamp", required: false},
			]
		},
		{
			name:       "CustomerConsent"
			domain:     "aux"
			module:     "entities"
			sourceType: "entities.#CustomerConsent"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "customer_id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "consent_type", kind: "scalar", typeName: "string", required: true},
				{name: "status", kind: "scalar", typeName: "string", required: true},
				{name: "captured_via", kind: "scalar", typeName: "string", required: false},
				{name: "captured_at", kind: "scalar", typeName: "Timestamp", required: true},
				{name: "evidence_ref", kind: "scalar", typeName: "string", required: false},
				{name: "updated_at", kind: "scalar", typeName: "Timestamp", required: true},
			]
		},
		{
			name:       "CustomerDocument"
			domain:     "aux"
			module:     "entities"
			sourceType: "entities.#CustomerDocument"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "customer_id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "document_type", kind: "scalar", typeName: "string", required: true},
				{name: "document_number", kind: "scalar", typeName: "string", required: false},
				{name: "document_picture_ref", kind: "scalar", typeName: "string", required: false},
				{name: "issuing_country", kind: "scalar", typeName: "string", required: false},
				{name: "expires_on", kind: "scalar", typeName: "DateOnly", required: false},
				{name: "created_at", kind: "scalar", typeName: "Timestamp", required: true},
				{name: "updated_at", kind: "scalar", typeName: "Timestamp", required: true},
			]
		},
		{
			name:       "TravelGroup"
			domain:     "aux"
			module:     "entities"
			sourceType: "entities.#TravelGroup"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "booking_id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "name", kind: "scalar", typeName: "string", required: false},
				{name: "group_type", kind: "scalar", typeName: "string", required: true},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
				{name: "created_at", kind: "scalar", typeName: "Timestamp", required: true},
				{name: "updated_at", kind: "scalar", typeName: "Timestamp", required: true},
			]
		},
		{
			name:       "TravelGroupMember"
			domain:     "aux"
			module:     "entities"
			sourceType: "entities.#TravelGroupMember"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "travel_group_id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "customer_id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "is_traveling", kind: "scalar", typeName: "bool", required: false},
				{name: "member_roles", kind: "scalar", typeName: "string", required: true, isArray: true},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
				{name: "created_at", kind: "scalar", typeName: "Timestamp", required: true},
				{name: "updated_at", kind: "scalar", typeName: "Timestamp", required: true},
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
				{name: "destinationCountries", kind: "scalar", typeName: "string", required: true, isArray: true},
				{name: "styles", kind: "scalar", typeName: "string", required: true, isArray: true},
				{name: "durationDays", kind: "scalar", typeName: "int", required: false},
				{name: "priceFrom", kind: "valueObject", typeName: "TourPriceFrom", required: false},
			]
		},
		{
			name:       "TourPriceFrom"
			domain:     "aux"
			module:     "entities"
			sourceType: "entities.#TourPriceFrom"
			fields: [
				{name: "currency", kind: "enum", typeName: "CurrencyCode", required: true},
				{name: "minor", kind: "scalar", typeName: "int", required: true},
			]
		},
		{
			name:       "Booking"
			domain:     "booking"
			module:     "entities"
			sourceType: "entities.#Booking"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "bookingHash", kind: "scalar", typeName: "string", required: false},
				{name: "customerId", kind: "scalar", typeName: "Identifier", required: true},
				{name: "stage", kind: "enum", typeName: "BookingStage", required: true},
				{name: "atp_staff", kind: "scalar", typeName: "Identifier", required: false},
				{name: "atpStaffName", kind: "scalar", typeName: "string", required: false},
				{name: "destination", kind: "scalar", typeName: "string", required: false},
				{name: "style", kind: "scalar", typeName: "string", required: false},
				{name: "travelMonth", kind: "scalar", typeName: "string", required: false},
				{name: "travelers", kind: "scalar", typeName: "int", required: false},
				{name: "duration", kind: "scalar", typeName: "string", required: false},
				{name: "budget", kind: "scalar", typeName: "string", required: false},
				{name: "preferredCurrency", kind: "enum", typeName: "CurrencyCode", required: false},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
				{name: "pricing", kind: "valueObject", typeName: "BookingPricing", required: true},
				{name: "offer", kind: "valueObject", typeName: "BookingOffer", required: true},
				{name: "source", kind: "valueObject", typeName: "SourceAttribution", required: false},
				{name: "createdAt", kind: "scalar", typeName: "Timestamp", required: true},
				{name: "updatedAt", kind: "scalar", typeName: "Timestamp", required: true},
			]
		},
		{
			name:       "BookingOfferCategoryRule"
			domain:     "booking"
			module:     "entities"
			sourceType: "entities.#BookingOfferCategoryRule"
			fields: [
				{name: "category", kind: "enum", typeName: "OfferCategory", required: true},
				{name: "taxRateBasisPoints", kind: "scalar", typeName: "int", required: true},
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
				{name: "unitAmountCents", kind: "scalar", typeName: "int", required: true},
				{name: "taxRateBasisPoints", kind: "scalar", typeName: "int", required: true},
				{name: "lineTotalAmountCents", kind: "scalar", typeName: "int", required: false},
				{name: "currency", kind: "enum", typeName: "CurrencyCode", required: true},
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
				{name: "netAmountCents", kind: "scalar", typeName: "int", required: true},
				{name: "taxAmountCents", kind: "scalar", typeName: "int", required: true},
				{name: "grossAmountCents", kind: "scalar", typeName: "int", required: true},
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
				{name: "categoryRules", kind: "valueObject", typeName: "BookingOfferCategoryRule", required: true, isArray: true},
				{name: "components", kind: "valueObject", typeName: "BookingOfferComponent", required: true, isArray: true},
				{name: "totals", kind: "valueObject", typeName: "BookingOfferTotals", required: true},
				{name: "totalPriceCents", kind: "scalar", typeName: "int", required: true},
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
			name:       "CustomerList"
			domain:     "api"
			module:     "api"
			sourceType: "api.#CustomerList"
			fields: [
				{name: "items", kind: "entity", typeName: "Customer", required: true, isArray: true},
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
				{name: "customer", kind: "entity", typeName: "Customer", required: false},
			]
		},
		{
			name:       "CustomerDetail"
			domain:     "api"
			module:     "api"
			sourceType: "api.#CustomerDetail"
			fields: [
				{name: "customer", kind: "entity", typeName: "Customer", required: true},
				{name: "bookings", kind: "entity", typeName: "Booking", required: true, isArray: true},
				{name: "consents", kind: "entity", typeName: "CustomerConsent", required: true, isArray: true},
				{name: "documents", kind: "entity", typeName: "CustomerDocument", required: true, isArray: true},
				{name: "travelGroups", kind: "entity", typeName: "TravelGroup", required: true, isArray: true},
				{name: "travelGroupMembers", kind: "entity", typeName: "TravelGroupMember", required: true, isArray: true},
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
				{name: "items", kind: "valueObject", typeName: "BookingActivity", required: true, isArray: true},
				{name: "activities", kind: "valueObject", typeName: "BookingActivity", required: true, isArray: true},
				{name: "total", kind: "scalar", typeName: "int", required: true},
			]
		},
		{
			name:       "BookingInvoicesResponse"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingInvoicesResponse"
			fields: [
				{name: "items", kind: "valueObject", typeName: "BookingInvoice", required: true, isArray: true},
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
				{name: "customerId", kind: "scalar", typeName: "Identifier", required: false},
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
			name:       "PublicBookingCreateRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#PublicBookingCreateRequest"
			fields: [
				{name: "destination", kind: "scalar", typeName: "string", required: false},
				{name: "style", kind: "scalar", typeName: "string", required: false},
				{name: "travelMonth", kind: "scalar", typeName: "string", required: false},
				{name: "travelers", kind: "scalar", typeName: "int", required: false},
				{name: "duration", kind: "scalar", typeName: "string", required: false},
				{name: "budget", kind: "scalar", typeName: "string", required: false},
				{name: "preferredCurrency", kind: "enum", typeName: "CurrencyCode", required: false},
				{name: "name", kind: "scalar", typeName: "string", required: false},
				{name: "email", kind: "scalar", typeName: "Email", required: false},
				{name: "phone", kind: "scalar", typeName: "string", required: false},
				{name: "language", kind: "scalar", typeName: "string", required: false},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
				{name: "pageUrl", kind: "scalar", typeName: "string", required: false},
				{name: "referrer", kind: "scalar", typeName: "string", required: false},
				{name: "utmSource", kind: "scalar", typeName: "string", required: false},
				{name: "utmMedium", kind: "scalar", typeName: "string", required: false},
				{name: "utmCampaign", kind: "scalar", typeName: "string", required: false},
				{name: "idempotencyKey", kind: "scalar", typeName: "string", required: false},
			]
		},
		{
			name:       "BookingPricingUpdateRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingPricingUpdateRequest"
			fields: [
				{name: "bookingHash", kind: "scalar", typeName: "string", required: false},
				{name: "pricing", kind: "valueObject", typeName: "BookingPricing", required: true},
			]
		},
		{
			name:       "BookingOfferUpdateRequest"
			domain:     "api"
			module:     "api"
			sourceType: "api.#BookingOfferUpdateRequest"
			fields: [
				{name: "bookingHash", kind: "scalar", typeName: "string", required: false},
				{name: "offer", kind: "valueObject", typeName: "BookingOffer", required: true},
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
