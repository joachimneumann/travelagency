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
	import_batch_id?:        common.#Identifier
}

#BookingTravelPlanDayCopiedFrom: {
	source_type:             "booking_travel_plan_day"
	source_booking_id:       common.#Identifier
	source_day_id:           common.#Identifier
	copied_at:               common.#Timestamp
	copied_by_atp_staff_id?: common.#Identifier
	import_batch_id?:        common.#Identifier
}

#BookingTravelPlanService: {
	id:              common.#Identifier
	timing_kind:     *"label" | enums.#TravelPlanTimingKind
	time_label?:     string
	time_point?:     string
	kind:            enums.#TravelPlanServiceKind
	title?:          string
	details?:        string
	image_subtitle?: string
	location?:       string
	supplier_id?:    common.#Identifier
	start_time?:     string
	end_time?:       string
	image?:          #BookingTravelPlanServiceImage
	copied_from?:    #BookingTravelPlanServiceCopiedFrom
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
	date_string?:        string
	title:               string
	overnight_location?: string
	services?: [...#BookingTravelPlanService]
	notes?:       string
	copied_from?: #BookingTravelPlanDayCopiedFrom
}

#BookingTravelPlan: {
	days?: [...#BookingTravelPlanDay]
	attachments?: [...#BookingTravelPlanAttachment]
}
