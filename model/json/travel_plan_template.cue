package json

import (
	common "travelagency.local/model/common"
	databaseModel "travelagency.local/model/database"
	enums "travelagency.local/model/enums"
)

#TravelPlanTemplate: {
	id:          common.#Identifier
	title:       string & !=""
	destinations: [...enums.#CountryCode] | []
	travel_plan: databaseModel.#BookingTravelPlan
}
