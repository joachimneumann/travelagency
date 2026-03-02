package api

import (
	common "travelagency.local/model/common"
	entities "travelagency.local/model/entities"
)

#StaffDirectoryEntry: {
	id:      common.#Identifier
	name:    string
	active?: bool
	usernames?: [...string]
	destinations?: [...string]
	languages?: [...string]
}

#StaffListResponse: {
	items: [...#StaffDirectoryEntry]
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
	principal?:    entities.#ATPUser
}
