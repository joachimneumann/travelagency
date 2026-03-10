package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#BookingWebFormSubmission: {
	destinations?: [...enums.#CountryCode]
	travel_style?: [...string]
	booking_name?:             string
	tour_id?:                  common.#Identifier | string
	page_url?:                 common.#Url | string
	ip_address?:               string
	ip_country_guess?:         string
	referrer?:                 common.#Url | string
	utm_source?:               string
	utm_medium?:               string
	utm_campaign?:             string
	travel_month?:             string
	number_of_travelers?:      >=0 & <=common.#MaxTravelers & int
	preferred_currency?:       enums.#CurrencyCode
	travel_duration_days_min?: >=0 & int
	travel_duration_days_max?: >=0 & int
	name?:                     string
	email?:                    common.#Email
	phone_number?:             string
	budget_lower_usd?:         >=0 & int
	budget_upper_usd?:         >=0 & int
	preferred_language?:       enums.#LanguageCode
	notes?:                    string
	submitted_at?:             common.#Timestamp
}

#BookingPayment: {
	id:                    common.#Identifier
	label:                 string & !=""
	status:                enums.#PaymentStatus
	net_amount_cents:      common.#NonNegativeMoneyAmount
	tax_rate_basis_points: >=0 & int
	due_date?:             common.#DateOnly
	paid_at?:              common.#Timestamp
	notes?:                string
	tax_amount_cents?:     common.#MoneyAmount
	gross_amount_cents?:   common.#MoneyAmount
	created_at?:           common.#Timestamp
	updated_at?:           common.#Timestamp
}

#BookingPricingSummary: {
	agreed_net_amount_cents:      common.#NonNegativeMoneyAmount
	adjustments_delta_cents:      common.#MoneyAmount
	adjusted_net_amount_cents:    common.#MoneyAmount
	scheduled_net_amount_cents:   common.#NonNegativeMoneyAmount
	unscheduled_net_amount_cents: common.#MoneyAmount
	scheduled_tax_amount_cents:   common.#MoneyAmount
	scheduled_gross_amount_cents: common.#MoneyAmount
	paid_gross_amount_cents:      common.#MoneyAmount
	outstanding_gross_amount_cents: common.#MoneyAmount
	is_schedule_balanced:         bool
}

#BookingPricing: {
	currency:                enums.#CurrencyCode
	agreed_net_amount_cents: common.#NonNegativeMoneyAmount
	adjustments:             [...#PricingAdjustment]
	payments:                [...#BookingPayment]
	summary:                 #BookingPricingSummary
}

#BookingActivityType: enums.#BookingActivityType

#BookingActivity: {
	id:         common.#Identifier
	booking_id: common.#Identifier
	type:       #BookingActivityType
	actor:      string & !=""
	detail:     string & !=""
	created_at: common.#Timestamp
}

#BookingInvoice: #Invoice

#Booking: {
	id:                             common.#Identifier
	name?:                          string
	booking_hash?:                  string
	stage:                          enums.#BookingStage
	atp_staff?:                     common.#Identifier
	service_level_agreement_due_at?: common.#Timestamp
	destinations?:                  [...enums.#CountryCode]
	travel_styles?:                 [...string]
	travel_start_day?:              common.#DateOnly
	travel_end_day?:                common.#DateOnly
	number_of_travelers?:           >=0 & <=common.#MaxTravelers & int
	preferred_currency?:            enums.#CurrencyCode
	notes?:                         string
	persons?:                       [...#BookingPerson]
	web_form_submission?:           #BookingWebFormSubmission
	pricing:                        #BookingPricing
	offer:                          #BookingOffer
	created_at:                     common.#Timestamp
	updated_at:                     common.#Timestamp
}
