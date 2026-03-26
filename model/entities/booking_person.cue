package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#BookingPersonAddress: {
	line_1?:       string
	line_2?:       string
	city?:         string
	state_region?: string
	postal_code?:  string
	country_code?: enums.#CountryCode
}

#BookingPersonConsent: {
	id:            common.#Identifier
	consent_type:  enums.#PersonConsentType
	status:        enums.#PersonConsentStatus
	captured_via?: string
	captured_at:   common.#Timestamp
	evidence_ref?: string
	updated_at:    common.#Timestamp
}

#BookingPersonDocument: {
	id:                    common.#Identifier
	document_type:         enums.#PersonDocumentType
	holder_name?:          string
	document_number?:      string
	document_picture_ref?: string
	issuing_country?:      enums.#CountryCode
	issued_on?:            common.#DateOnly
	no_expiration_date?:   bool
	expires_on?:           common.#DateOnly
	created_at:            common.#Timestamp
	updated_at:            common.#Timestamp
}

#BookingPerson: {
	id:   common.#Identifier
	name: string

	photo_ref?: string
	emails?: [...common.#Email]
	phone_numbers?: [...string]
	preferred_language?: enums.#LanguageCode
	food_preferences?:  [...string]
	allergies?:         [...string]
	hotel_room_smoker?: *false | bool
	hotel_room_sharing_ok?: *true | bool
	date_of_birth?:      common.#DateOnly
	nationality?:        enums.#CountryCode
	address?:            #BookingPersonAddress
	roles?: [...enums.#BookingPersonRole]
	consents?: [...#BookingPersonConsent]
	documents?: [...#BookingPersonDocument]
	notes?: string
}
