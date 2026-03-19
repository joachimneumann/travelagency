package api

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
	entities "travelagency.local/model/entities"
)

#TravelerConstraints: {
	min: common.#MinTravelers
	max: common.#MaxTravelers
}

#WebsiteBookingFormBase: {
	destinations?: [...string]
	travel_style?: [...string]
	travel_month?:             string
	number_of_travelers?:      >=common.#MinTravelers & <=common.#MaxTravelers & int
	preferred_currency:        enums.#CurrencyCode
	travel_duration_days_min?: >=0 & int
	travel_duration_days_max?: >=0 & int
	name:                      string
	email?:                    common.#Email
	phone_number?:             string & !=""
	budget_lower_usd?:         >=0 & int
	budget_upper_usd?:         >=0 & int
	preferred_language:        enums.#LanguageCode
	notes?:                    string
}

#WebsiteBookingForm:
	#WebsiteBookingFormBase & {
		email: common.#Email
	} | #WebsiteBookingFormBase & {
		phone_number: string & !=""
	}

#PublicBookingCreateRequest: #WebsiteBookingForm & {
	booking_name?:    string
	tour_id?:         string
	page_url?:        common.#Url | string
	referrer?:        common.#Url | string
	utm_source?:      string
	utm_medium?:      string
	utm_campaign?:    string
	idempotency_key?: string
}

#BookingDeleteRequest: {
	expected_core_revision?: >=0 & int
}

#BookingNameUpdateRequest: {
	expected_core_revision?: >=0 & int
	name?:                   string
	actor?:                  string
}

#BookingCustomerLanguageUpdateRequest: {
	expected_core_revision?: >=0 & int
	customer_language:       enums.#LanguageCode
	actor?:                  string
}

#BookingImageUploadRequest: #EvidenceUpload & {
	expected_core_revision?: >=0 & int
	actor?:                  string
}

#BookingStageUpdateRequest: {
	expected_core_revision?: >=0 & int
	stage:                   enums.#BookingStage
	actor?:                  string
}

#BookingOwnerUpdateRequest: {
	expected_core_revision?:    >=0 & int
	assigned_keycloak_user_id?: common.#Identifier
	actor?:                     string
}

#BookingPersonCreateRequest: {
	expected_persons_revision?: >=0 & int
	person:                     entities.#BookingPerson
	actor?:                     string
}

#BookingPersonUpdateRequest: {
	expected_persons_revision?: >=0 & int
	person:                     entities.#BookingPerson
	actor?:                     string
}

#BookingPersonDeleteRequest: {
	expected_persons_revision?: >=0 & int
	actor?:                     string
}

#BookingPersonPhotoUploadRequest: #EvidenceUpload & {
	expected_persons_revision?: >=0 & int
	actor?:                     string
}

#BookingNotesUpdateRequest: {
	expected_notes_revision?: >=0 & int
	notes?:                   string
	actor?:                   string
}

#TranslationEntriesRequest: {
	source_lang: enums.#LanguageCode
	target_lang: enums.#LanguageCode
	actor?:      string
	entries: [...#TranslationEntry]
}

#BookingTravelPlanUpdateRequest: {
	expected_travel_plan_revision?: >=0 & int
	travel_plan:                    entities.#BookingTravelPlan
	actor?:                         string
}

#BookingTravelPlanTranslateRequest: {
	expected_travel_plan_revision?: >=0 & int
	lang:                           enums.#LanguageCode
	actor?:                         string
}

#BookingPricingUpdateRequest: {
	expected_pricing_revision?: >=0 & int
	pricing:                    entities.#BookingPricing
	actor?:                     string
}

#BookingOfferUpdateRequest: {
	expected_offer_revision?: >=0 & int
	offer:                    entities.#BookingOffer
	actor?:                   string
}

#BookingOfferTranslateRequest: {
	expected_offer_revision?: >=0 & int
	lang:                     enums.#LanguageCode
	actor?:                   string
}

#BookingGenerateOfferRequest: {
	expected_offer_revision?: >=0 & int
	comment?:                 string
	actor?:                   string
}

#BookingGeneratedOfferUpdateRequest: {
	expected_offer_revision?: >=0 & int
	comment?:                 string
	actor?:                   string
}

#BookingGeneratedOfferDeleteRequest: {
	expected_offer_revision?: >=0 & int
	actor?:                   string
}

#BookingGeneratedOfferGmailDraftRequest: {
	actor?: string
}

#SupplierCreateRequest: {
	name:             string
	contact?:         string
	emergency_phone?: string
	email?:           common.#Email
	country?:         enums.#CountryCode
	category:         enums.#SupplierCategory
}

#SupplierUpdateRequest: {
	name?:            string
	contact?:         string
	emergency_phone?: string
	email?:           common.#Email
	country?:         enums.#CountryCode
	category?:        enums.#SupplierCategory
}

#OfferExchangeRateComponent: {
	id?:                    common.#Identifier
	category:               enums.#OfferCategory
	quantity:               >0 & int
	unit_amount_cents:      common.#NonNegativeMoneyAmount
	tax_rate_basis_points?: >=0 & <=100000 & int
}

#OfferExchangeRatesRequest: {
	from_currency: enums.#CurrencyCode
	to_currency:   enums.#CurrencyCode
	components?: [...#OfferExchangeRateComponent]
}

#BookingActivityCreateRequest: {
	expected_core_revision?: >=0 & int
	type:                    entities.#BookingActivityType
	detail?:                 string
	actor?:                  string
}

#BookingInvoiceUpsertRequest: {
	expected_invoices_revision?: >=0 & int
	invoice_number?:             string
	currency?:                   enums.#CurrencyCode
	issue_date?:                 common.#DateOnly
	due_date?:                   common.#DateOnly
	title?:                      string
	notes?:                      string
	components?: [...entities.#InvoiceComponent]
	due_amount_cents?:  common.#NonNegativeMoneyAmount
	sent_to_recipient?: bool
}

#BookingInvoiceTranslateRequest: {
	expected_invoices_revision?: >=0 & int
	lang:                        enums.#LanguageCode
	actor?:                      string
}

#TourUpsertRequest: {
	id?:    common.#Identifier
	title?: string
	destinations?: [...string]
	styles?: [...string]
	travel_duration_days?:    >=0 & int
	budget_lower_usd?:        >=0 & int
	priority?:                int
	rating?:                  >=0 & number
	seasonality_start_month?: enums.#MonthCode
	seasonality_end_month?:   enums.#MonthCode
	short_description?:       string
	highlights?: [...string] | string
	image?: string
}

#TourTranslateFieldsRequest: #TranslationEntriesRequest

#EvidenceUpload: {
	filename:    string & !=""
	mime_type?:  string
	data_base64: string & !=""
}
