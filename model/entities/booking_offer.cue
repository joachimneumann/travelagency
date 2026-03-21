package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#BookingOfferCategoryRule: {
	category:              enums.#OfferCategory
	tax_rate_basis_points: >=0 & <=100000 & int
}

#BookingOfferComponent: {
	id:                       common.#Identifier
	category:                 enums.#OfferCategory
	label:                    string & !=""
	details?:                 string
	quantity:                 >0 & int
	unit_amount_cents:        common.#NonNegativeMoneyAmount
	unit_tax_amount_cents?:   common.#MoneyAmount
	unit_total_amount_cents?: common.#MoneyAmount
	tax_rate_basis_points:    >=0 & <=100000 & int
	currency:                 enums.#CurrencyCode
	line_net_amount_cents?:   common.#MoneyAmount
	line_tax_amount_cents?:   common.#MoneyAmount
	line_gross_amount_cents?: common.#MoneyAmount
	line_total_amount_cents?: int
	notes?:                   string
	sort_order?:              int
	created_at?:              common.#Timestamp
	updated_at?:              common.#Timestamp
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
	category_rules: [...#BookingOfferCategoryRule]
	components: [...#BookingOfferComponent]
	totals:             #BookingOfferTotals
	quotation_summary?: #BookingOfferQuotationSummary
	payment_terms?:     #BookingOfferPaymentTerms
	total_price_cents:  int
}

#GeneratedOfferDepositAcceptanceRule: {
	payment_term_line_id:  common.#Identifier
	payment_term_label:    string & !=""
	required_amount_cents: >=0 & int
	currency:              enums.#CurrencyCode
	aggregation_mode:      "SUM_LINKED_PAID_PAYMENTS"
}

#GeneratedOfferAcceptanceRoute: {
	mode:                       enums.#GeneratedOfferAcceptanceRouteMode
	status:                     enums.#GeneratedOfferAcceptanceRouteStatus
	selected_at:                common.#Timestamp
	selected_by_atp_staff_id:   common.#Identifier
	expires_at?:                common.#Timestamp
	customer_message_snapshot?: string

	if mode == "DEPOSIT_PAYMENT" {
		deposit_rule: #GeneratedOfferDepositAcceptanceRule
	}
}

#GeneratedOfferAcceptance: {
	id:                             common.#Identifier
	accepted_at:                    common.#Timestamp
	accepted_by_name?:              string & !=""
	accepted_by_email?:             common.#Email
	accepted_by_phone?:             string
	accepted_by_person_id?:         common.#Identifier
	language:                       enums.#LanguageCode
	method:                         enums.#OfferAcceptanceMethod
	statement_snapshot:             string & !=""
	terms_version?:                 string & !=""
	terms_snapshot:                 string & !=""
	offer_currency:                 enums.#CurrencyCode
	offer_total_price_cents:        int
	offer_pdf_sha256:               string & =~"^[a-f0-9]{64}$"
	offer_snapshot_sha256:          string & =~"^[a-f0-9]{64}$"
	ip_address?:                    string
	user_agent?:                    string
	otp_channel?:                   enums.#OfferAcceptanceOtpChannel
	otp_verified_at?:               common.#Timestamp
	deposit_payment_id?:            common.#Identifier
	accepted_payment_term_line_id?: common.#Identifier
	accepted_payment_ids?: [...common.#Identifier]
	accepted_amount_cents?: >=0 & int
	accepted_currency?:     enums.#CurrencyCode

	if method == "PORTAL_CLICK" || method == "PORTAL_CLICK_OTP" || method == "ESIGN" {
		accepted_by_name: string & !=""
	}

	if method == "PORTAL_CLICK_OTP" {
		otp_channel:     enums.#OfferAcceptanceOtpChannel
		otp_verified_at: common.#Timestamp
	}

	if method == "DEPOSIT_PAYMENT" {
		accepted_payment_term_line_id: common.#Identifier
		accepted_payment_ids: [...common.#Identifier]
		accepted_amount_cents: >=0 & int
		accepted_currency:     enums.#CurrencyCode
	}
}

#GeneratedBookingOffer: {
	id:                           common.#Identifier
	booking_id:                   common.#Identifier
	version:                      >=1 & int
	filename:                     string & !=""
	lang:                         enums.#LanguageCode
	comment?:                     string
	created_at:                   common.#Timestamp
	created_by?:                  string
	currency:                     enums.#CurrencyCode
	total_price_cents:            int
	offer:                        #BookingOffer
	travel_plan?:                 #BookingTravelPlan
	pdf_frozen_at?:               common.#Timestamp
	pdf_sha256?:                  string & =~"^[a-f0-9]{64}$"
	acceptance_route?:            #GeneratedOfferAcceptanceRoute
	acceptance_token_nonce?:      string & !=""
	acceptance_token_created_at?: common.#Timestamp
	acceptance_token_expires_at?: common.#Timestamp
	acceptance_token_revoked_at?: common.#Timestamp
	acceptance?:                  #GeneratedOfferAcceptance
}
