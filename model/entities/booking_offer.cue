package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#BookingOfferCategoryRule: {
	category:              enums.#OfferCategory
	tax_rate_basis_points: >=0 & <=100000 & int
}

#BookingOfferTripPriceInternal: {
	label?:                   string
	amount_cents:             common.#NonNegativeMoneyAmount
	tax_rate_basis_points:    >=0 & <=100000 & int
	currency:                 enums.#CurrencyCode
	notes?:                   string
	line_net_amount_cents?:   common.#MoneyAmount
	line_tax_amount_cents?:   common.#MoneyAmount
	line_gross_amount_cents?: common.#MoneyAmount
	line_total_amount_cents?: int
}

#BookingOfferDayPriceInternal: {
	id?:                      common.#Identifier
	day_number:               >0 & int
	label?:                   string
	amount_cents:             common.#NonNegativeMoneyAmount
	tax_rate_basis_points:    >=0 & <=100000 & int
	currency:                 enums.#CurrencyCode
	notes?:                   string
	sort_order?:              int
	line_net_amount_cents?:   common.#MoneyAmount
	line_tax_amount_cents?:   common.#MoneyAmount
	line_gross_amount_cents?: common.#MoneyAmount
	line_total_amount_cents?: int
}

#BookingOfferAdditionalItem: {
	id:                       common.#Identifier
	label:                    string & !=""
	details?:                 string
	day_number?:              >0 & int
	quantity:                 >0 & int
	unit_amount_cents:        common.#NonNegativeMoneyAmount
	unit_tax_amount_cents?:   common.#MoneyAmount
	unit_total_amount_cents?: common.#MoneyAmount
	tax_rate_basis_points:    >=0 & <=100000 & int
	currency:                 enums.#CurrencyCode
	category?:                enums.#OfferCategory
	line_net_amount_cents?:   common.#MoneyAmount
	line_tax_amount_cents?:   common.#MoneyAmount
	line_gross_amount_cents?: common.#MoneyAmount
	line_total_amount_cents?: int
	notes?:                   string
	sort_order?:              int
	created_at?:              common.#Timestamp
	updated_at?:              common.#Timestamp
}

#BookingOfferDiscount: {
	reason:                   string & !=""
	amount_cents:             common.#NonNegativeMoneyAmount
	currency:                 enums.#CurrencyCode
	line_net_amount_cents?:   common.#MoneyAmount
	line_tax_amount_cents?:   common.#MoneyAmount
	line_gross_amount_cents?: common.#MoneyAmount
}

#BookingOfferTaxBucket: {
	tax_rate_basis_points: >=0 & <=100000 & int
	net_amount_cents:      common.#MoneyAmount
	tax_amount_cents:      common.#MoneyAmount
	gross_amount_cents:    common.#MoneyAmount
	items_count:           >=0 & int
}

#BookingOfferTotals: {
	net_amount_cents:   common.#MoneyAmount
	tax_amount_cents:   common.#MoneyAmount
	gross_amount_cents: common.#MoneyAmount
	total_price_cents:  common.#MoneyAmount
	items_count:        >=0 & int
}

#BookingOfferQuotationSummary: {
	tax_included:              bool
	subtotal_net_amount_cents: common.#MoneyAmount
	total_tax_amount_cents:    common.#MoneyAmount
	grand_total_amount_cents:  common.#MoneyAmount
	tax_breakdown: [...#BookingOfferTaxBucket]
}

#BookingOfferPaymentDueRule: {
	type: enums.#OfferPaymentDueType

	if type == "FIXED_DATE" {
		fixed_date: common.#DateOnly
	}

	if type == "DAYS_AFTER_ACCEPTANCE" || type == "DAYS_BEFORE_TRIP_START" || type == "DAYS_AFTER_TRIP_START" || type == "DAYS_AFTER_TRIP_END" {
		days: >=0 & int
	}
}

#BookingOfferPaymentAmountSpec: {
	mode: enums.#OfferPaymentAmountMode

	if mode == "FIXED_AMOUNT" {
		fixed_amount_cents: >=0 & int
	}

	if mode == "PERCENTAGE_OF_OFFER_TOTAL" {
		percentage_basis_points: >0 & <=10000 & int
	}
}

#BookingOfferPaymentTermLine: {
	id:           common.#Identifier
	kind:         enums.#OfferPaymentTermKind
	label:        string & !=""
	sequence:     >=1 & int
	amount_spec:  #BookingOfferPaymentAmountSpec
	due_rule:     #BookingOfferPaymentDueRule
	description?: string

	if kind == "FINAL_BALANCE" {
		amount_spec: {
			mode: "REMAINING_BALANCE"
		}
	}

	if kind == "DEPOSIT" || kind == "INSTALLMENT" {
		amount_spec: {
			mode: "FIXED_AMOUNT" | "PERCENTAGE_OF_OFFER_TOTAL"
		}
	}
}

#BookingOfferPaymentTerms: {
	currency: enums.#CurrencyCode
	lines: [...#BookingOfferPaymentTermLine]
	notes?: string
}

#BookingOffer: {
	currency: enums.#CurrencyCode
	status?:  "DRAFT" | "APPROVED" | "OFFER_SENT"
	// Internal detail level is canonical and limited to trip/day pricing.
	offer_detail_level_internal: enums.#OfferDetailLevel
	offer_detail_level_visible:  enums.#OfferDetailLevel
	category_rules: [...#BookingOfferCategoryRule]
	// Trip price is active only when offer_detail_level_internal == "trip".
	trip_price_internal?: #BookingOfferTripPriceInternal
	// Day prices are active only when offer_detail_level_internal == "day".
	days_internal?: [...#BookingOfferDayPriceInternal]
	// Additional items and discount survive internal detail level transitions.
	additional_items?: [...#BookingOfferAdditionalItem]
	discount?:          #BookingOfferDiscount
	totals:             #BookingOfferTotals
	quotation_summary?: #BookingOfferQuotationSummary
	payment_terms?:     #BookingOfferPaymentTerms
	total_price_cents:  int
}

#GeneratedOfferDepositBookingConfirmationRule: {
	payment_term_line_id:  common.#Identifier
	payment_term_label:    string & !=""
	required_amount_cents: >=0 & int
	currency:              enums.#CurrencyCode
	aggregation_mode:      "SUM_LINKED_PAID_PAYMENTS"
}

#GeneratedOfferCustomerConfirmationFlow: {
	mode:                       enums.#GeneratedOfferCustomerConfirmationFlowMode
	status:                     enums.#GeneratedOfferCustomerConfirmationFlowStatus
	selected_at:                common.#Timestamp
	selected_by_atp_staff_id:   common.#Identifier
	expires_at?:                common.#Timestamp
	customer_message_snapshot?: string

	if mode == "DEPOSIT_PAYMENT" {
		deposit_rule: #GeneratedOfferDepositBookingConfirmationRule
	}
}

#GeneratedOfferBookingConfirmation: {
	id:                                common.#Identifier
	accepted_at:                       common.#Timestamp
	accepted_by_name?:                 string & !=""
	accepted_by_email?:                common.#Email
	accepted_by_phone?:                string
	accepted_by_person_id?:            common.#Identifier
	language:                          enums.#LanguageCode
	method:                            enums.#BookingConfirmationMethod
	statement_snapshot:                string & !=""
	terms_version?:                    string & !=""
	terms_snapshot:                    string & !=""
	offer_currency:                    enums.#CurrencyCode
	offer_total_price_cents:           int
	offer_pdf_sha256:                  string & =~"^[a-f0-9]{64}$"
	offer_snapshot_sha256:             string & =~"^[a-f0-9]{64}$"
	ip_address?:                       string
	user_agent?:                       string
	management_approver_atp_staff_id?: common.#Identifier
	deposit_payment_id?:               common.#Identifier
	accepted_payment_term_line_id?:    common.#Identifier
	accepted_payment_ids?: [...common.#Identifier]
	accepted_amount_cents?: >=0 & int
	accepted_currency?:     enums.#CurrencyCode

	if method == "MANAGEMENT" {
		accepted_by_name:                 string & !=""
		management_approver_atp_staff_id: common.#Identifier
	}

	if method == "DEPOSIT_PAYMENT" {
		accepted_payment_term_line_id: common.#Identifier
		accepted_payment_ids: [...common.#Identifier]
		accepted_amount_cents: >=0 & int
		accepted_currency:     enums.#CurrencyCode
	}
}

#GeneratedBookingOffer: {
	id:                                     common.#Identifier
	booking_id:                             common.#Identifier
	version:                                >=1 & int
	filename:                               string & !=""
	lang:                                   enums.#LanguageCode
	comment?:                               string
	created_at:                             common.#Timestamp
	created_by?:                            string
	currency:                               enums.#CurrencyCode
	total_price_cents:                      int
	offer:                                  #BookingOffer
	travel_plan?:                           #BookingTravelPlan
	management_approver_atp_staff_id?:      common.#Identifier
	management_approver_label?:             string
	pdf_frozen_at?:                         common.#Timestamp
	pdf_sha256?:                            string & =~"^[a-f0-9]{64}$"
	customer_confirmation_flow?:            #GeneratedOfferCustomerConfirmationFlow
	booking_confirmation_token_nonce?:      string & !=""
	booking_confirmation_token_created_at?: common.#Timestamp
	booking_confirmation_token_expires_at?: common.#Timestamp
	booking_confirmation_token_revoked_at?: common.#Timestamp
	booking_confirmation?:                  #GeneratedOfferBookingConfirmation
}
