package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#PricingAdjustment: {
	id:           common.#Identifier
	type:         enums.#PricingAdjustmentType
	label:        string & !=""
	amount_cents: common.#MoneyAmount
	note?:        string
	created_at?:  common.#Timestamp
	updated_at?:  common.#Timestamp
}

#InvoiceComponent: {
	id?:                common.#Identifier
	description:        string & !=""
	quantity:           >0 & int
	unit_amount_cents:  common.#NonNegativeMoneyAmount
	total_amount_cents?: common.#NonNegativeMoneyAmount
}

#Invoice: {
	id:                    common.#Identifier
	booking_id?:           common.#Identifier
	invoice_number?:       string
	version?:              >=1 & int
	status?:               string & !=""
	currency:              enums.#CurrencyCode
	issue_date?:           common.#DateOnly
	due_date?:             common.#DateOnly
	title?:                string
	components:            [...#InvoiceComponent]
	notes?:                string
	sent_to_recipient?:    bool
	sent_to_recipient_at?: common.#Timestamp
	total_amount_cents?:   common.#NonNegativeMoneyAmount
	due_amount_cents?:     common.#NonNegativeMoneyAmount
	created_at?:           common.#Timestamp
	updated_at?:           common.#Timestamp
	pdf_url?:              string
}
