package api

import (
	common "travelagency.local/model/common"
	entities "travelagency.local/model/entities"
	enums "travelagency.local/model/enums"
)

#KeycloakUserDirectoryEntry: {
	id:        common.#Identifier
	name:      string
	active?:   bool
	username?: string
}

#KeycloakUserListResponse: {
	items: [...#KeycloakUserDirectoryEntry]
	total: >=0 & int
}

#BookingDeleteResponse: {
	deleted:    bool
	booking_id: common.#Identifier
}

#BookingActivitiesResponse: {
	items: [...entities.#BookingActivity]
	activities: [...entities.#BookingActivity]
	total: >=0 & int
}

#BookingActivityResponse: {
	activity: entities.#BookingActivity
	booking:  entities.#Booking
}

#BookingInvoicesResponse: {
	items: [...entities.#BookingInvoice]
	total: >=0 & int
}

#BookingInvoiceResponse: {
	invoice:    entities.#BookingInvoice
	booking:    entities.#Booking
	unchanged?: bool
}

#BookingChatEvent: {
	id:               common.#Identifier
	channel:          string
	direction:        string
	event_type:       string
	external_status?: string
	text_preview:     string
	sender_display?:  string
	sender_contact?:  string
	sent_at?:         common.#Timestamp
	received_at?:     common.#Timestamp
	conversation_id:  common.#Identifier
	open_url?:        string
}

#BookingChatConversation: {
	id:                   common.#Identifier
	channel:              string
	external_contact_id?: string
	booking_id?:          common.#Identifier
	related_bookings?: [...{
		booking_id: common.#Identifier
		name?:      string
		stage?:     string
	}]
	last_event_at?:  common.#Timestamp
	latest_preview?: string
	open_url?:       string
}

#BookingChatResponse: {
	mode?: string
	items: [...#BookingChatEvent]
	total: >=0 & int
	conversations: [...#BookingChatConversation]
	conversation_total: >=0 & int
}

#TourOptions: {
	destinations?: [...string]
	styles?: [...string]
}

#BookingListFilters: {
	stage?:                     string
	assigned_keycloak_user_id?: common.#Identifier
	search?:                    string
}

#TourListFilters: {
	destination?: string
	style?:       string
	search?:      string
}

#OfferExchangeRatesResponse: {
	from_currency:     string
	to_currency:       string
	exchange_rate:     number
	total_price_cents: int
	converted_components: [...entities.#BookingOfferComponent]
	warning?: string
}

#TranslationEntriesResponse: {
	source_lang: enums.#LanguageCode
	target_lang: enums.#LanguageCode
	entries: [...#TranslationEntry]
}

#BookingGeneratedOfferGmailDraftResponse: {
	draft_id:           common.#Identifier
	gmail_draft_url:    common.#Url | string
	recipient_email:    common.#Email
	generated_offer_id: common.#Identifier
	activity_logged:    bool
	warning?:           string
}

#PublicGeneratedOfferAccessResponse: {
	booking_id:                    common.#Identifier
	generated_offer_id:            common.#Identifier
	booking_name?:                 string
	lang:                          enums.#LanguageCode
	currency:                      enums.#CurrencyCode
	total_price_cents:             int
	comment?:                      string
	created_at:                    common.#Timestamp
	pdf_url?:                      common.#Url | string
	public_acceptance_expires_at?: common.#Timestamp
	accepted:                      bool
	acceptance?:                   entities.#GeneratedOfferAcceptance
}

#PublicGeneratedOfferAcceptResponse: {
	booking_id:           common.#Identifier
	generated_offer_id:   common.#Identifier
	accepted:             bool
	status:               "ACCEPTED" | "OTP_REQUIRED"
	acceptance?:          entities.#GeneratedOfferAcceptance
	otp_channel?:         enums.#OfferAcceptanceOtpChannel
	otp_sent_to?:         string
	otp_expires_at?:      common.#Timestamp
	retry_after_seconds?: >=0 & int
}

#SupplierListResponse: {
	items: [...entities.#Supplier]
	total: >=0 & int
}

#SupplierResponse: {
	supplier: entities.#Supplier
}

#TourResponse: {
	tour: entities.#Tour
}

#AuthenticatedUser: {
	sub?:                string
	name?:               string
	given_name?:         string
	family_name?:        string
	email?:              common.#Email
	preferred_username?: string
	roles?: [...string]
}

#AuthMeResponse: {
	authenticated: bool
	user?:         #AuthenticatedUser
}
