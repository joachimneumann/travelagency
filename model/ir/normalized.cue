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
	domain:     "currency" | "user" | "booking" | "aux" | "api"
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
		roles: [for role in enumModel.ATPUserRoleCatalog {{code: role}}]
		stages: [for stage in enumModel.BookingStageCatalog {{code: stage}}]
		paymentStatuses: [for status in enumModel.PaymentStatusCatalog {{code: status}}]
	}

	types: [
		{
			name:       "ATPUser"
			domain:     "user"
			module:     "entities"
			sourceType: "entities.#ATPUser"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "preferredUsername", kind: "scalar", typeName: "string", required: true},
				{name: "displayName", kind: "scalar", typeName: "string", required: false},
				{name: "email", kind: "scalar", typeName: "Email", required: false},
				{name: "roles", kind: "enum", typeName: "ATPUserRole", required: true, isArray: true},
				{name: "staffId", kind: "scalar", typeName: "Identifier", required: false},
			]
		},
		{
			name:       "Customer"
			domain:     "user"
			module:     "entities"
			sourceType: "entities.#Customer"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "name", kind: "scalar", typeName: "string", required: false},
				{name: "email", kind: "scalar", typeName: "Email", required: false},
				{name: "phone", kind: "scalar", typeName: "string", required: false},
				{name: "language", kind: "scalar", typeName: "string", required: false},
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
			name:       "Booking"
			domain:     "booking"
			module:     "entities"
			sourceType: "entities.#Booking"
			fields: [
				{name: "id", kind: "scalar", typeName: "Identifier", required: true},
				{name: "bookingHash", kind: "scalar", typeName: "string", required: false},
				{name: "customerId", kind: "scalar", typeName: "Identifier", required: true},
				{name: "stage", kind: "enum", typeName: "BookingStage", required: true},
				{name: "staff", kind: "scalar", typeName: "Identifier", required: false},
				{name: "staffName", kind: "scalar", typeName: "string", required: false},
				{name: "destination", kind: "scalar", typeName: "string", required: false},
				{name: "style", kind: "scalar", typeName: "string", required: false},
				{name: "travelMonth", kind: "scalar", typeName: "string", required: false},
				{name: "travelers", kind: "scalar", typeName: "int", required: false},
				{name: "duration", kind: "scalar", typeName: "string", required: false},
				{name: "budget", kind: "scalar", typeName: "string", required: false},
				{name: "preferredCurrency", kind: "enum", typeName: "CurrencyCode", required: false},
				{name: "notes", kind: "scalar", typeName: "string", required: false},
				{name: "pricing", kind: "valueObject", typeName: "BookingPricing", required: true},
				{name: "source", kind: "valueObject", typeName: "SourceAttribution", required: false},
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
