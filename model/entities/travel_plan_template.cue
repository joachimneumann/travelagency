package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#TravelPlanTemplate: {
	id:                       common.#Identifier
	title:                    string & !=""
	description?:             string
	status:                   *"draft" | enums.#TravelPlanTemplateStatus
	source_booking_id?:       common.#Identifier
	created_by_atp_staff_id?: common.#Identifier
	travel_plan:              #BookingTravelPlan
	created_at?:              common.#Timestamp
	updated_at?:              common.#Timestamp
}
