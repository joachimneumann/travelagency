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
	booking_hash?: string
}

#BookingNameUpdateRequest: {
	booking_hash?: string
	name?:         string
	actor?:        string
}

#BookingStageUpdateRequest: {
	booking_hash?: string
	stage:         enums.#BookingStage
	actor?:        string
}

#BookingOwnerUpdateRequest: {
	booking_hash?: string
	atp_staff?:    common.#Identifier
	actor?:        string
}

#BookingPersonsUpdateRequest: {
	booking_hash?: string
	persons:       [...entities.#BookingPerson]
	actor?:        string
}

#BookingNotesUpdateRequest: {
	booking_hash?: string
	notes?:        string
	actor?:        string
}

#BookingPricingUpdateRequest: {
	booking_hash?: string
	pricing:       entities.#BookingPricing
	actor?:        string
}

#BookingOfferUpdateRequest: {
	booking_hash?: string
	offer:         entities.#BookingOffer
	actor?:        string
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
	booking_hash?: string
	type:          entities.#BookingActivityType
	detail?:       string
	actor?:        string
}

#BookingInvoiceUpsertRequest: {
	booking_hash?:       string
	invoice_number?:     string
	currency?:           enums.#CurrencyCode
	issue_date?:         common.#DateOnly
	due_date?:           common.#DateOnly
	title?:              string
	notes?:              string
	components?:         [...entities.#InvoiceComponent]
	due_amount_cents?:   common.#NonNegativeMoneyAmount
	sent_to_recipient?:  bool
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
