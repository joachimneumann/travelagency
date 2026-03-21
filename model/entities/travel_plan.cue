package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#BookingTravelPlanSegmentImageSourceAttribution: {
	source_name?:  string
	source_url?:   common.#Url | string
	photographer?: string
	license?:      string
}

#BookingTravelPlanSegmentImageFocalPoint: {
	x: >=0 & <=1 & number
	y: >=0 & <=1 & number
}

#BookingTravelPlanSegmentImage: {
	id:                   common.#Identifier
	storage_path:         string & !=""
	caption?:             string
	alt_text?:            string
	sort_order:           >=0 & int
	is_primary?:          bool
	is_customer_visible?: bool
	width_px?:            >0 & int
	height_px?:           >0 & int
	source_attribution?:  #BookingTravelPlanSegmentImageSourceAttribution
	focal_point?:         #BookingTravelPlanSegmentImageFocalPoint
	created_at?:          common.#Timestamp
}

#BookingTravelPlanSegmentCopiedFrom: {
	source_type:             "booking_segment"
	source_booking_id:       common.#Identifier
	source_day_id?:          common.#Identifier
	source_segment_id:       common.#Identifier
	copied_at:               common.#Timestamp
	copied_by_atp_staff_id?: common.#Identifier
}

#BookingTravelPlanSegment: {
	id:                        common.#Identifier
	timing_kind:               *"label" | enums.#TravelPlanTimingKind
	time_label?:               string
	time_point?:               string
	kind:                      enums.#TravelPlanSegmentKind
	title:                     string
	details?:                  string
	location?:                 string
	supplier_id?:              common.#Identifier
	start_time?:               string
	end_time?:                 string
	financial_coverage_status: *"not_covered" | enums.#TravelPlanFinancialCoverageStatus
	financial_note?:           string
	images?: [...#BookingTravelPlanSegmentImage]
	copied_from?: #BookingTravelPlanSegmentCopiedFrom
}

#BookingTravelPlanOfferComponentLink: {
	id:                     common.#Identifier
	travel_plan_segment_id: common.#Identifier
	offer_component_id:     common.#Identifier
	coverage_type:          *"full" | enums.#TravelPlanOfferCoverageType
}

#BookingTravelPlanDay: {
	id:                  common.#Identifier
	day_number:          >0 & int
	date?:               common.#DateOnly
	title:               string
	overnight_location?: string
	segments?: [...#BookingTravelPlanSegment]
	notes?: string
}

#BookingTravelPlan: {
	days?: [...#BookingTravelPlanDay]
	offer_component_links?: [...#BookingTravelPlanOfferComponentLink]
}
