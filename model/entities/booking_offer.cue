package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#BookingOfferCategoryRule: {
	category:               enums.#OfferCategory
	tax_rate_basis_points:  >=0 & <=100000 & int
}

#BookingOfferComponent: {
	id:                      common.#Identifier
	category:                enums.#OfferCategory
	label:                   string & !=""
	details?:                string
	quantity:                >0 & int
	unit_amount_cents:       common.#NonNegativeMoneyAmount
	tax_rate_basis_points:   >=0 & <=100000 & int
	currency:                enums.#CurrencyCode
	line_net_amount_cents?:  common.#MoneyAmount
	line_tax_amount_cents?:  common.#MoneyAmount
	line_total_amount_cents?: int
	notes?:                  string
	sort_order?:             int
	created_at?:             common.#Timestamp
	updated_at?:             common.#Timestamp
}

#BookingOfferTotals: {
	net_amount_cents:   common.#MoneyAmount
	tax_amount_cents:   common.#MoneyAmount
	gross_amount_cents: common.#MoneyAmount
	total_price_cents:  common.#MoneyAmount
	items_count:        >=0 & int
}

#BookingOffer: {
	currency:          enums.#CurrencyCode
	status?:           "DRAFT" | "APPROVED" | "OFFER_SENT"
	category_rules:    [...#BookingOfferCategoryRule]
	components:        [...#BookingOfferComponent]
	totals:            #BookingOfferTotals
	total_price_cents: int
}
