package database

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#TravelPlanServiceImageSourceAttribution: {
	source_name?:  string
	source_url?:   common.#Url | string
	photographer?: string
	license?:      string
}

#TravelPlanServiceImageFocalPoint: {
	x: >=0 & <=1 & number
	y: >=0 & <=1 & number
}

#TravelPlanServiceImage: {
	id:                   common.#Identifier
	storage_path:         string & !=""
	caption?:             string
	caption_i18n?:        [string]: string
	alt_text?:            string
	alt_text_i18n?:       [string]: string
	sort_order:           >=0 & int
	is_primary?:          bool
	is_customer_visible?: bool
	include_in_travel_tour_card?: bool
	width_px?:            >0 & int
	height_px?:           >0 & int
	source_attribution?:  #TravelPlanServiceImageSourceAttribution
	focal_point?:         #TravelPlanServiceImageFocalPoint
	created_at?:          common.#Timestamp
}

#BookingTravelPlanServiceImageSourceAttribution: #TravelPlanServiceImageSourceAttribution

#BookingTravelPlanServiceImageFocalPoint: #TravelPlanServiceImageFocalPoint

#BookingTravelPlanServiceImage: #TravelPlanServiceImage

#TravelPlanService: {
	id:              common.#Identifier
	timing_kind:     *"label" | enums.#TravelPlanTimingKind
	time_label?:     string
	time_point?:     string
	kind:            enums.#TravelPlanServiceKind
	title?:          string
	details?:        string
	details_i18n?:   [string]: string
	image_subtitle?: string
	image_subtitle_i18n?: [string]: string
	location?:       string
	start_time?:     string
	end_time?:       string
	image?:          #TravelPlanServiceImage
	...
}

#BookingTravelPlanService: #TravelPlanService

#BookingTravelPlanAttachment: {
	id:           common.#Identifier
	filename:     string & !=""
	storage_path: string & !=""
	page_count:   >0 & int
	sort_order:   >=0 & int
	created_at?:  common.#Timestamp
}

#TravelPlanDay: {
	id:                  common.#Identifier
	day_number:          >0 & int
	title?:              string
	overnight_location?: string
	services?: [...#TravelPlanService]
	notes?: string
	...
}

#TravelPlanDestinationPlaceSelection: {
	place_id: common.#Identifier
}

#TravelPlanDestinationAreaSelection: {
	area_id: common.#Identifier
	places?: [...#TravelPlanDestinationPlaceSelection]
}

#TravelPlanDestinationScopeEntry: {
	destination: enums.#CountryCode
	areas?: [...#TravelPlanDestinationAreaSelection]
}

#BookingTravelPlanDay: #TravelPlanDay & {
	date?:        common.#DateOnly
	date_string?: string
	services?: [...#BookingTravelPlanService]
}

#TravelPlan: {
	destination_scope?: [...#TravelPlanDestinationScopeEntry]
	destinations?: [...enums.#CountryCode]
	days?: [...#TravelPlanDay]
	...
}

#BookingTravelPlan: #TravelPlan & {
	days?: [...#BookingTravelPlanDay]
	attachments?: [...#BookingTravelPlanAttachment]
}
