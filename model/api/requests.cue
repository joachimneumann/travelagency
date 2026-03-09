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
	budget_lower_USD?:         >=0 & int
	budget_upper_USD?:         >=0 & int
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
	booking_name?:   string
	tourId?:         string
	tourTitle?:      string
	pageUrl?:        common.#Url | string
	referrer?:       common.#Url | string
	utm_source?:     string
	utm_medium?:     string
	utm_campaign?:   string
	idempotencyKey?: string
}

#BookingPricingUpdateRequest: {
	booking_hash?: string
	pricing:       entities.#BookingPricing
}

#BookingOfferUpdateRequest: {
	booking_hash?: string
	offer:         entities.#BookingOffer
}

#EvidenceUpload: {
	filename:    string & !=""
	mime_type?:  string
	data_base64: string & !=""
}
