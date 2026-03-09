package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#Customer: {
	client_id:    common.#Identifier
	customer_hash?: string

	name:          string
	photo_ref?:    string
	title?:        string
	first_name?:   string
	last_name?:    string
	date_of_birth?: common.#DateOnly
	nationality?:  enums.#CountryCode

	address_line_1?:       string
	address_line_2?:       string
	address_city?:         string
	address_state_region?: string
	address_postal_code?:  string
	address_country_code?: enums.#CountryCode

	organization_name?:         string
	organization_address?:      string
	organization_phone_number?: string
	organization_webpage?:      string
	organization_email?:        common.#Email
	tax_id?:                    string

	phone_number?:       string
	email?:              common.#Email
	preferred_language?: enums.#LanguageCode
	preferred_currency?: enums.#CurrencyCode
	timezone?:           enums.#TimezoneCode
	notes?:              string

	created_at:  common.#Timestamp
	updated_at:  common.#Timestamp
	archived_at?: common.#Timestamp
}

#CustomerConsent: {
	id:               common.#Identifier
	customer_client_id: common.#Identifier
	consent_type:     enums.#CustomerConsentType
	status:           enums.#CustomerConsentStatus
	captured_via?:    string
	captured_at:      common.#Timestamp
	evidence_ref?:    string
	updated_at:       common.#Timestamp
}

#CustomerDocument: {
	id:                   common.#Identifier
	customer_client_id:     common.#Identifier
	document_type:        enums.#CustomerDocumentType
	document_number?:     string
	document_picture_ref?: string
	issuing_country?:     enums.#CountryCode
	expires_on?:          common.#DateOnly
	created_at:           common.#Timestamp
	updated_at:           common.#Timestamp
}

#TravelGroupMember: {
	id:               common.#Identifier
	travel_group_id:  common.#Identifier
	customer_client_id: common.#Identifier
	is_traveling?:    bool
	member_roles:     [...enums.#TravelGroupMemberRole]
	notes?:           string
	created_at:       common.#Timestamp
	updated_at:       common.#Timestamp
}
