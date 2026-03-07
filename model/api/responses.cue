package api

import (
	common "travelagency.local/model/common"
	entities "travelagency.local/model/entities"
)

#AtpStaffDirectoryEntry: {
	id:      common.#Identifier
	name:    string
	active?: bool
	usernames?: [...string]
	destinations?: [...string]
	languages?: [...string]
}

#AtpStaffListResponse: {
	items: [...#AtpStaffDirectoryEntry]
	total: >=0 & int
}

#BookingActivitiesResponse: {
	items: [...entities.#BookingActivity]
	activities: [...entities.#BookingActivity]
	total: >=0 & int
}

#BookingInvoicesResponse: {
	items: [...entities.#BookingInvoice]
	total: >=0 & int
}

#BookingChatEvent: {
	id:             common.#Identifier
	channel:        string
	direction:      string
	eventType:      string
	externalStatus?: string
	textPreview:    string
	senderDisplay?: string
	senderContact?: string
	sentAt?:        common.#Timestamp
	receivedAt?:    common.#Timestamp
	conversationId: common.#Identifier
	openUrl?:       string
}

#BookingChatConversation: {
	id:                common.#Identifier
	channel:           string
	externalContactId?: string
	customerId?:       common.#Identifier
	bookingId?:        common.#Identifier
	lastEventAt?:      common.#Timestamp
	latestPreview?:    string
	openUrl?:          string
}

#BookingChatResponse: {
	mode?:              string
	items:              [...#BookingChatEvent]
	total:              >=0 & int
	conversations:      [...#BookingChatConversation]
	conversationTotal:  >=0 & int
}

#TourOptions: {
	destinations?: [...string]
	styles?: [...string]
}

#AuthMeResponse: {
	authenticated: bool
	principal?:    entities.#ATPStaff
}

#CustomerUpdateResponse: {
	customer: entities.#Customer
}

#CustomerPhotoUploadResponse: {
	customer: entities.#Customer
}

#CustomerConsentCreateResponse: {
	consent: entities.#CustomerConsent
}
