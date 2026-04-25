package json

import (
	common "travelagency.local/model/common"
	databaseModel "travelagency.local/model/database"
	enums "travelagency.local/model/enums"
)

#Tour: {
	id:     common.#Identifier
	title?: string
	title_i18n?: [string]: string
	destinations: [...enums.#CountryCode]
	styles: [...enums.#TourStyleCode]
	priority?:                int
	seasonality_start_month?: enums.#MonthCode
	seasonality_end_month?:   enums.#MonthCode
	short_description?:       string
	short_description_i18n?: [string]: string
	pictures?: [...string]
	image?:       string
	travel_plan?: databaseModel.#TravelPlan
	created_at?:  common.#Timestamp
	updated_at?:  common.#Timestamp
}
