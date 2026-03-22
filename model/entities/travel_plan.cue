package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#BookingTravelPlanItemImageSourceAttribution: {
	source_name?:  string
	source_url?:   common.#Url | string
	photographer?: string
	license?:      string
}

#BookingTravelPlanItemImageFocalPoint: {
	x: >=0 & <=1 & number
	y: >=0 & <=1 & number
}

#BookingTravelPlanItemImage: {
	id:                   common.#Identifier
	storage_path:         string & !=""
	caption?:             string
	alt_text?:            string
	sort_order:           >=0 & int
	is_primary?:          bool
	is_customer_visible?: bool
	width_px?:            >0 & int
	height_px?:           >0 & int
	source_attribution?:  #BookingTravelPlanItemImageSourceAttribution
	focal_point?:         #BookingTravelPlanItemImageFocalPoint
	created_at?:          common.#Timestamp
}

#BookingTravelPlanItemCopiedFrom: {
	source_type:             "booking_travel_plan_item"
	source_booking_id:       common.#Identifier
	source_day_id?:          common.#Identifier
	source_item_id:       common.#Identifier
	copied_at:               common.#Timestamp
	copied_by_atp_staff_id?: common.#Identifier
}

#BookingTravelPlanItem: {
	id:                        common.#Identifier
	timing_kind:               *"label" | enums.#TravelPlanTimingKind
	time_label?:               string
	time_point?:               string
	kind:                      enums.#TravelPlanItemKind
	title:                     string
	details?:                  string
	location?:                 string
	supplier_id?:              common.#Identifier
	start_time?:               string
	end_time?:                 string
	financial_coverage_status: *"not_covered" | enums.#TravelPlanFinancialCoverageStatus
	financial_note?:           string
	images?: [...#BookingTravelPlanItemImage]
	copied_from?: #BookingTravelPlanItemCopiedFrom
}

#BookingTravelPlanOfferComponentLink: {
	id:                     common.#Identifier
	travel_plan_item_id: common.#Identifier
	offer_component_id:     common.#Identifier
	coverage_type:          *"full" | enums.#TravelPlanOfferCoverageType
}

#BookingTravelPlanDay: {
	id:                  common.#Identifier
	day_number:          >0 & int
	date?:               common.#DateOnly
	title:               string
	overnight_location?: string
	items?: [...#BookingTravelPlanItem]
	notes?: string
}

#BookingTravelPlan: {
	days?: [...#BookingTravelPlanDay]
	offer_component_links?: [...#BookingTravelPlanOfferComponentLink]
}
