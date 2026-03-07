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
	destination?:       [...string]
	style?:             [...string]
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
	booking_hash?: string
	pricing:       entities.#BookingPricing
}

#BookingOfferUpdateRequest: {
	booking_hash?: string
	offer:         entities.#BookingOffer
}

#BookingClientUpdateRequest: {
	booking_hash?:   string
	client_type:     entities.#ClientType
	customer_client_id?: string
	group_name?:     string
}

#BookingGroupMemberCreateRequest: {
	booking_hash?:       string
	name:               string
	email?:             common.#Email
	phone_number?:      string
	preferred_language?: enums.#LanguageCode
	member_roles?:      [...entities.#TravelGroupMemberRole]
	is_traveling?:      bool
	member_notes?:      string
}

#CustomerUpdateRequest: {
	customer_hash?:            string
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
	customer_hash?:   string
	photo_upload?: #EvidenceUpload
	photo?:        #EvidenceUpload
}

#CustomerConsentCreateRequest: {
	customer_hash?:     string
	consent_type:   enums.#CustomerConsentType
	status:         enums.#CustomerConsentStatus
	captured_via?:  string
	captured_at?:   common.#Timestamp
	evidence_ref?:  string
	evidence_upload?: #EvidenceUpload
}

#TravelGroupUpdateRequest: {
	travel_group_hash?: string
	group_name?:        string
	preferred_language?: enums.#LanguageCode
	preferred_currency?: enums.#CurrencyCode
	timezone?:          enums.#TimezoneCode
	notes?:             string
}

#TravelGroupCreateRequest: {
	group_name:          string
	preferred_language?: enums.#LanguageCode
	preferred_currency?: enums.#CurrencyCode
	timezone?:           enums.#TimezoneCode
	notes?:              string
}
