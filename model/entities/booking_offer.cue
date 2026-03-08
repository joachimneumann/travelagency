package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#BookingOfferCategoryRule: {
	category: enums.#OfferCategory
	taxRate:  >=0 & <=100 & number
}

#BookingOfferComponent: {
	id:                    common.#Identifier
	category:              enums.#OfferCategory
	label:                 string & !=""
	details?:              string
	quantity:              >0 & int
	unitNet:               common.#NonNegativeMoneyAmount
	taxRate:               >=0 & <=100 & number
	currency:              enums.#CurrencyCode
	lineTotalAmountCents?: int
	notes?:                string
	sortOrder?:            int
	createdAt?:            common.#Timestamp
	updatedAt?:            common.#Timestamp
}

#BookingOfferTotals: {
	netAmount:       common.#MoneyAmount
	taxAmount:       common.#MoneyAmount
	grossAmount:     common.#MoneyAmount
	componentsCount: >=0 & int
}

#BookingOffer: {
	currency:        enums.#CurrencyCode
	categoryRules:   [...#BookingOfferCategoryRule]
	components:      [...#BookingOfferComponent]
	totals:          #BookingOfferTotals
	totalPriceCents: int
}
