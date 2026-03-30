package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#BookingTravelPlanServiceImageSourceAttribution: {
	source_name?:  string
	source_url?:   common.#Url | string
	photographer?: string
	license?:      string
}

#BookingTravelPlanServiceImageFocalPoint: {
	x: >=0 & <=1 & number
	y: >=0 & <=1 & number
}

#BookingTravelPlanServiceImage: {
	id:                   common.#Identifier
	storage_path:         string & !=""
	caption?:             string
	alt_text?:            string
	sort_order:           >=0 & int
	is_primary?:          bool
	is_customer_visible?: bool
	width_px?:            >0 & int
	height_px?:           >0 & int
	source_attribution?:  #BookingTravelPlanServiceImageSourceAttribution
	focal_point?:         #BookingTravelPlanServiceImageFocalPoint
	created_at?:          common.#Timestamp
}

#BookingTravelPlanServiceCopiedFrom: {
	source_type:             "booking_travel_plan_service"
	source_booking_id:       common.#Identifier
	source_day_id?:          common.#Identifier
	source_service_id:       common.#Identifier
	copied_at:               common.#Timestamp
	copied_by_atp_staff_id?: common.#Identifier
}

#BookingTravelPlanService: {
	id:                        common.#Identifier
	timing_kind:               *"label" | enums.#TravelPlanTimingKind
	time_label?:               string
	time_point?:               string
	kind:                      enums.#TravelPlanServiceKind
	duration_days?:            >=1 & <=100 & int
	title?:                    string
	details?:                  string
	location?:                 string
	supplier_id?:              common.#Identifier
	start_time?:               string
	end_time?:                 string
	financial_coverage_needed?: *true | bool
	financial_coverage_status: *"not_covered" | enums.#TravelPlanFinancialCoverageStatus
	financial_note?:           string
	image?:                    #BookingTravelPlanServiceImage
	copied_from?: #BookingTravelPlanServiceCopiedFrom
}

#BookingTravelPlanOfferComponentLink: {
	id:                     common.#Identifier
	travel_plan_service_id: common.#Identifier
	offer_component_id:     common.#Identifier
	coverage_type:          *"full" | enums.#TravelPlanOfferCoverageType
}

#BookingTravelPlanAttachment: {
	id:           common.#Identifier
	filename:     string & !=""
	storage_path: string & !=""
	page_count:   >0 & int
	sort_order:   >=0 & int
	created_at?:  common.#Timestamp
}

#BookingTravelPlanDay: {
	id:                  common.#Identifier
	day_number:          >0 & int
	date?:               common.#DateOnly
	title:               string
	overnight_location?: string
	services?: [...#BookingTravelPlanService]
	notes?: string
}

#BookingTravelPlan: {
	days?: [...#BookingTravelPlanDay]
	offer_component_links?: [...#BookingTravelPlanOfferComponentLink]
	attachments?: [...#BookingTravelPlanAttachment]
}
