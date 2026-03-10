package api

import (
	common "travelagency.local/model/common"
	entities "travelagency.local/model/entities"
)

#AtpStaffDirectoryEntry: {
	id:           common.#Identifier
	name:         string
	active?:      bool
	usernames?:   [...string]
	destinations?: [...string]
	languages?:   [...string]
}

#AtpStaffListResponse: {
	items: [...#AtpStaffDirectoryEntry]
	total: >=0 & int
}

#AtpStaffResponse: {
	atp_staff: #AtpStaffDirectoryEntry
}

#BookingDeleteResponse: {
	deleted:    bool
	booking_id: common.#Identifier
}

#BookingActivitiesResponse: {
	items:      [...entities.#BookingActivity]
	activities: [...entities.#BookingActivity]
	total:      >=0 & int
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
	invoice: entities.#BookingInvoice
	booking: entities.#Booking
}

#BookingChatEvent: {
	id:              common.#Identifier
	channel:         string
	direction:       string
	event_type:      string
	external_status?: string
	text_preview:    string
	sender_display?: string
	sender_contact?: string
	sent_at?:        common.#Timestamp
	received_at?:    common.#Timestamp
	conversation_id: common.#Identifier
	open_url?:       string
}

#BookingChatConversation: {
	id:                  common.#Identifier
	channel:             string
	external_contact_id?: string
	booking_id?:         common.#Identifier
	last_event_at?:      common.#Timestamp
	latest_preview?:     string
	open_url?:           string
}

#BookingChatResponse: {
	mode?:              string
	items:              [...#BookingChatEvent]
	total:              >=0 & int
	conversations:      [...#BookingChatConversation]
	conversation_total: >=0 & int
}

#TourOptions: {
	destinations?: [...string]
	styles?:       [...string]
}

#BookingListFilters: {
	stage?:     string
	atp_staff?: common.#Identifier
	search?:    string
}

#TourListFilters: {
	destination?: string
	style?:       string
	search?:      string
}

#OfferExchangeRatesResponse: {
	from_currency:        string
	to_currency:          string
	exchange_rate:        number
	total_price_cents:    int
	converted_components: [...entities.#BookingOfferComponent]
	warning?:             string
}

#TourResponse: {
	tour: entities.#Tour
}

#AuthenticatedUser: {
	sub?:                string
	email?:              common.#Email
	preferred_username?: string
	roles?:              [...string]
}

#AuthMeResponse: {
	authenticated: bool
	user?:         #AuthenticatedUser
}
