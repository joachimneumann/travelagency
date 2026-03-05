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

#PublicBookingCreateRequest: {
	destination?:       string
	style?:             string
	travelMonth?:       string
	travelers?:         >=common.#MinTravelers & <=common.#MaxTravelers & int
	duration?:          string
	budget?:            string
	preferredCurrency?: enums.#CurrencyCode
	name?:              string
	email?:             common.#Email
	phone?:             string
	language?:          string
	notes?:             string
	pageUrl?:           common.#Url | string
	referrer?:          common.#Url | string
	utmSource?:         string
	utmMedium?:         string
	utmCampaign?:       string
	idempotencyKey?:    string
}

#BookingPricingUpdateRequest: {
	bookingHash?: string
	pricing:      entities.#BookingPricing
}

#BookingOfferUpdateRequest: {
	bookingHash?: string
	offer:        entities.#BookingOffer
}
