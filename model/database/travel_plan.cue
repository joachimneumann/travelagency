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
	time_label_i18n?: [string]: string
	time_point?:     string
	kind:            enums.#TravelPlanServiceKind
	title?:          string
	title_i18n?:     [string]: string
	details?:        string
	details_i18n?:   [string]: string
	image_subtitle?: string
	image_subtitle_i18n?: [string]: string
	start_time?:     string
	end_time?:       string
	image?:          #TravelPlanServiceImage
	...
}

#TravelPlanBoundaryKind: enums.#TravelPlanBoundaryKind

#TravelPlanBoundaryPresentation: {
	attach_to: enums.#TravelPlanBoundaryPlacementKind
	position:  "start" | "end"
}

#TravelPlanBoundaryService: #TravelPlanService & {
	boundary_kind:   #TravelPlanBoundaryKind
	kind:            *"transport" | enums.#TravelPlanServiceKind
	enabled?:        *true | bool
	airport_code?:   string
	from_label?:     string
	to_label?:       string
	presentation?:   #TravelPlanBoundaryPresentation
}

#TravelPlanBoundaryLogistics: #MarketingTourTravelPlanBoundaryLogistics

#MarketingTourTravelPlanBoundaryService: #TravelPlanBoundaryService

#MarketingTourTravelPlanBoundaryLogistics: {
	arrival?:   #MarketingTourTravelPlanBoundaryService
	departure?: #MarketingTourTravelPlanBoundaryService
}

#BookingTravelPlanBoundaryService: #TravelPlanBoundaryService

#BookingTravelPlanBoundaryLogistics: {
	arrival?:   #BookingTravelPlanBoundaryService
	departure?: #BookingTravelPlanBoundaryService
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

#TravelPlanDayBase: {
	id:                  common.#Identifier
	day_number:          >0 & int
	title?:              string
	title_i18n?:         [string]: string
	primary_location_id?: common.#Identifier
	secondary_location_id?: common.#Identifier
	experience_highlight_ids?: [...common.#Identifier]
	notes?: string
	notes_i18n?: [string]: string
	...
}

#MarketingTourTravelPlanDay: #TravelPlanDayBase & {
	services?: [...#TravelPlanService]
}

#TravelPlanDay: #MarketingTourTravelPlanDay

#TravelPlanDestinationPlaceSelection: {
	place_id: common.#Identifier
}

#TravelPlanDestinationRegionSelection: {
	region_id: common.#Identifier
	places?: [...#TravelPlanDestinationPlaceSelection]
}

#TravelPlanDestinationScopeEntry: {
	destination: enums.#CountryCode
	regions?: [...#TravelPlanDestinationRegionSelection]
	places?: [...#TravelPlanDestinationPlaceSelection]
}

#BookingTravelPlanDay: #TravelPlanDayBase & {
	date?: common.#DateOnly
	services?: [...#BookingTravelPlanService]
}

#TravelPlanCommon: {
	tour_card_image_ids?: [...common.#Identifier]
	one_pager_hero_image_id?: common.#Identifier
	one_pager_image_ids?: [...common.#Identifier]
	...
}

#TravelPlan: #TravelPlanCommon & {
	boundary_logistics?: #TravelPlanBoundaryLogistics
	days?: [...#TravelPlanDay]
}

#MarketingTourTravelPlan: #TravelPlanCommon & {
	boundary_logistics?: #MarketingTourTravelPlanBoundaryLogistics
	days?: [...#MarketingTourTravelPlanDay]
}

#BookingTravelPlan: #TravelPlanCommon & {
	boundary_logistics?: #BookingTravelPlanBoundaryLogistics
	days?: [...#BookingTravelPlanDay]
	attachments?: [...#BookingTravelPlanAttachment]
}
