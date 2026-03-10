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
	destinations?:              [...string]
	travel_style?:              [...string]
	travel_month?:              string
	number_of_travelers?:       >=common.#MinTravelers & <=common.#MaxTravelers & int
	preferred_currency:         enums.#CurrencyCode
	travel_duration_days_min?:  >=0 & int
	travel_duration_days_max?:  >=0 & int
	name:                       string
	email?:                     common.#Email
	phone_number?:              string & !=""
	budget_lower_usd?:          >=0 & int
	budget_upper_usd?:          >=0 & int
	preferred_language:         enums.#LanguageCode
	notes?:                     string
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

#BookingStageUpdateRequest: {
	expected_core_revision?: >=0 & int
	stage:                   enums.#BookingStage
	actor?:                  string
}

#BookingOwnerUpdateRequest: {
	expected_core_revision?: >=0 & int
	atp_staff?:              common.#Identifier
	actor?:                  string
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
	components?:   [...#OfferExchangeRateComponent]
}

#BookingActivityCreateRequest: {
	expected_core_revision?: >=0 & int
	type:                    entities.#BookingActivityType
	detail?:                 string
	actor?:                  string
}

#BookingInvoiceUpsertRequest: {
	expected_invoices_revision?: >=0 & int
	invoice_number?:            string
	currency?:                  enums.#CurrencyCode
	issue_date?:                common.#DateOnly
	due_date?:                  common.#DateOnly
	title?:                     string
	notes?:                     string
	components?:                [...entities.#InvoiceComponent]
	due_amount_cents?:          common.#NonNegativeMoneyAmount
	sent_to_recipient?:         bool
}

#AtpStaffCreateRequest: {
	name:         string
	active?:      bool
	usernames:    [...string] | string
	destinations?: [...string]
	languages?:   [...string]
}

#TourUpsertRequest: {
	id?:                     common.#Identifier
	title?:                  string
	destinations?:           [...string]
	styles?:                 [...string]
	travel_duration_days?:   >=0 & int
	budget_lower_usd?:       >=0 & int
	priority?:               int
	rating?:                 >=0 & number
	seasonality_start_month?: enums.#MonthCode
	seasonality_end_month?:   enums.#MonthCode
	short_description?:      string
	highlights?:             [...string] | string
	image?:                  string
}

#EvidenceUpload: {
	filename:    string & !=""
	mime_type?:  string
	data_base64: string & !=""
}
