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
	priority?: int
	seasonality_start_month?: enums.#MonthCode
	seasonality_end_month?:   enums.#MonthCode
	short_description?:       string
	image?:      string
	created_at?: common.#Timestamp
	updated_at?: common.#Timestamp
}
