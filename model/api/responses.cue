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

#TourOptions: {
	destinations?: [...string]
	styles?: [...string]
}

#AuthMeResponse: {
	authenticated: bool
	principal?:    entities.#ATPStaff
}
