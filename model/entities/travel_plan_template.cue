package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#TravelPlanTemplate: {
	id:          common.#Identifier
	title:       string & !=""
	destinations: [...enums.#CountryCode] | []
	travel_plan: #BookingTravelPlan
}
