package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#BookingTravelPlanSegment: {
	id:                        common.#Identifier
	time_label?:               string
	kind:                      enums.#TravelPlanSegmentKind
	title:                     string
	details?:                  string
	location?:                 string
	supplier_id?:              common.#Identifier
	start_time?:               string
	end_time?:                 string
	financial_coverage_status: *"not_covered" | enums.#TravelPlanFinancialCoverageStatus
	financial_note?:           string
}

#BookingTravelPlanOfferComponentLink: {
	id:                     common.#Identifier
	travel_plan_segment_id: common.#Identifier
	offer_component_id:     common.#Identifier
	coverage_type:          *"full" | enums.#TravelPlanOfferCoverageType
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
	title?:                 string
	summary?:               string
	days?:                  [...#BookingTravelPlanDay]
	offer_component_links?: [...#BookingTravelPlanOfferComponentLink]
}
