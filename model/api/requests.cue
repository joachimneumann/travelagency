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
	phone_number?:      string
	preferred_language?: enums.#LanguageCode
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

#CustomerUpdateRequest: {
	name?:                  string
	photo_ref?:             string
	title?:                 string
	first_name?:            string
	last_name?:             string
	date_of_birth?:         common.#DateOnly
	nationality?:           enums.#CountryCode
	address_line_1?:        string
	address_line_2?:        string
	address_city?:          string
	address_state_region?:  string
	address_postal_code?:   string
	address_country_code?:  enums.#CountryCode
	organization_name?:     string
	organization_address?:  string
	organization_phone_number?: string
	organization_webpage?:  string
	organization_email?:    common.#Email
	tax_id?:                string
	phone_number?:          string
	email?:                 common.#Email
	preferred_language?:    enums.#LanguageCode
	preferred_currency?:    enums.#CurrencyCode
	timezone?:              enums.#TimezoneCode
	notes?:                 string
}

#EvidenceUpload: {
	filename:    string & != ""
	mime_type?:  string
	data_base64: string & != ""
}

#CustomerPhotoUploadRequest: {
	photo_upload?: #EvidenceUpload
	photo?:        #EvidenceUpload
}

#CustomerConsentCreateRequest: {
	consent_type:   enums.#CustomerConsentType
	status:         enums.#CustomerConsentStatus
	captured_via?:  string
	captured_at?:   common.#Timestamp
	evidence_ref?:  string
	evidence_upload?: #EvidenceUpload
}
