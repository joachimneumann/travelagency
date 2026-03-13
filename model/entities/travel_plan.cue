package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#BookingTravelPlanSegment: {
	id:         common.#Identifier
	time_label?: string
	kind:       enums.#TravelPlanSegmentKind
	title:      string
	details?:   string
	location?:  string
	supplier_id?: common.#Identifier
	start_time?:  string
	end_time?:    string
}

#BookingTravelPlanDay: {
	id:                 common.#Identifier
	day_number:         >0 & int
	date?:              common.#DateOnly
	title:              string
	overnight_location?: string
	segments?:          [...#BookingTravelPlanSegment]
	notes?:             string
}

#BookingTravelPlan: {
	title?:   string
	summary?: string
	days?:    [...#BookingTravelPlanDay]
}
