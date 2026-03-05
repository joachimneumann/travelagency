package entities

import common "travelagency.local/model/common"

#Customer: {
	id:                    common.#Identifier
	display_name:          string
	first_name?:           string
	last_name?:            string
	date_of_birth?:        common.#DateOnly
	nationality?:          string
	organization_name?:    string
	organization_address?: string
	organization_phone_number?: string
	organization_webpage?:  string
	organization_email?:    common.#Email
	tax_id?:               string
	phone_number?:         string
	email?:                common.#Email
	address_line_1?:       string
	address_line_2?:       string
	address_city?:         string
	address_state_region?:  string
	address_postal_code?:   string
	address_country_code?:  string
	preferred_language?:    string
	preferred_currency?:    string
	timezone?:             string
	tags?:                 [...string]
	notes?:                string
	can_receive_marketing:  bool | *false
	created_at:            common.#Timestamp
	updated_at:            common.#Timestamp
	archived_at?:          common.#Timestamp
}

#CustomerConsent: {
	id:             common.#Identifier
	customer_id:     common.#Identifier
	consent_type:   "privacy_policy" | "marketing_email" | "marketing_whatsapp" | "profiling"
	status:         "granted" | "withdrawn" | "unknown"
	captured_via?:  string
	captured_at:    common.#Timestamp
	evidence_ref?:  string
	updated_at:     common.#Timestamp
}

#CustomerDocument: {
	id:                    common.#Identifier
	customer_id:           common.#Identifier
	document_type:         "passport" | "national_id" | "visa" | "other"
	document_number?:      string
	document_picture_ref?: string
	issuing_country?:      string
	expires_on?:           common.#DateOnly
	created_at:            common.#Timestamp
	updated_at:            common.#Timestamp
}

#TravelGroup: {
	id:         common.#Identifier
	booking_id: common.#Identifier
	name?:      string
	group_type: "family" | "friends" | "corporate" | "school" | "other"
	notes?:     string
	created_at: common.#Timestamp
	updated_at: common.#Timestamp
}

#TravelGroupMember: {
	id:               common.#Identifier
	travel_group_id:  common.#Identifier
	customer_id:      common.#Identifier
	is_traveling?:    bool
	member_roles:     [...("TravelGroupContact" | "decision_maker" | "payer" | "assistant" | "other")]
	notes?:           string
	created_at:       common.#Timestamp
	updated_at:       common.#Timestamp
}
