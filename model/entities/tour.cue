package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#TourPriceFrom: {
	currency: enums.#CurrencyCode
	minor:    >=0 & int
}

#Tour: {
	id:     common.#Identifier
	title?: string
	destinationCountries: [...string]
	styles: [...string]
	durationDays?:     >=0 & int
	priceFrom?:        #TourPriceFrom
	priority?:         int
	rating?:           int
	seasonality?:      string
	shortDescription?: string
	highlights?: [...string]
	image?:     string
	createdAt?: common.#Timestamp
	updatedAt?: common.#Timestamp
}
