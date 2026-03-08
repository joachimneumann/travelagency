package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#PricingAdjustment: {
	id:         common.#Identifier
	type:       enums.#PricingAdjustmentType
	label:      string & !=""
	netAmount:  common.#MoneyAmount
	notes?:     string
	createdAt?: common.#Timestamp
	updatedAt?: common.#Timestamp
}

#InvoiceComponent: {
	id?:          common.#Identifier
	label:        string & !=""
	description?: string
	quantity:     >0 & int
	unitNet:      common.#MoneyAmount
	taxRate:      >=0 & number
}

#Invoice: {
	id:             common.#Identifier
	invoiceNumber?: string
	currency:       enums.#CurrencyCode
	issueDate?:     common.#DateOnly
	dueDate?:       common.#DateOnly
	components: [...#InvoiceComponent]
	notes?:          string
	sentToCustomer?: bool
	createdAt?:      common.#Timestamp
	updatedAt?:      common.#Timestamp
}
