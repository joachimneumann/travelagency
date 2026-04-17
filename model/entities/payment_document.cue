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

#PaymentDocumentComponent: {
	id?:                 common.#Identifier
	description:         string & !=""
	quantity:            >0 & int
	unit_amount_cents:   common.#NonNegativeMoneyAmount
	total_amount_cents?: common.#NonNegativeMoneyAmount
}

#PaymentDocument: {
	id:                               common.#Identifier
	booking_id?:                      common.#Identifier
	document_number?:                 string
	version?:                         >=1 & int
	status?:                          string & !=""
	document_kind?:                   string & !=""
	payment_id?:                      common.#Identifier
	payment_term_line_id?:            common.#Identifier
	payment_kind?:                    string & !=""
	payment_label?:                   string
	currency:                         enums.#CurrencyCode
	issue_date?:                      common.#DateOnly
	title?:                           string
	subtitle?:                        string
	intro?:                           string
	components:                       [...#PaymentDocumentComponent]
	notes?:                           string
	closing?:                         string
	payment_received_at?:             common.#Timestamp
	payment_confirmed_by_atp_staff_id?: common.#Identifier
	payment_confirmed_by_label?:      string
	payment_reference?:               string
	total_amount_cents?:              common.#NonNegativeMoneyAmount
	due_amount_cents?:                common.#NonNegativeMoneyAmount
	created_at?:                      common.#Timestamp
	updated_at?:                      common.#Timestamp
	pdf_url?:                         string
}
