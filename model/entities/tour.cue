package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#Tour: {
	id:     common.#Identifier
	title?: string
	destinations: [...string]
	styles: [...string]
	travel_duration_days?:    >=0 & int
	budget_lower_USD?:        >=0 & int
	priority?:                int
	rating?:                  >=0 & number
	seasonality_start_month?: enums.#MonthCode
	seasonality_end_month?:   enums.#MonthCode
	shortDescription?:        string
	highlights?: [...string]
	image?:     string
	createdAt?: common.#Timestamp
	updatedAt?: common.#Timestamp
}
