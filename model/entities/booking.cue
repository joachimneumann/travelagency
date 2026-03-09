package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#SourceAttribution: {
	pageUrl?:        common.#Url | string
	ipAddress?:      string
	ipCountryGuess?: string
	referrer?:       common.#Url | string
	utmSource?:      string
	utmMedium?:      string
	utmCampaign?:    string
}

#BookingWebFormSubmission: {
	destinations?: [...enums.#CountryCode]
	travel_style?: [...string]
	booking_name?:            string
	travel_month?:             string
	number_of_travelers?:      >=0 & <=common.#MaxTravelers & int
	preferred_currency?:       enums.#CurrencyCode
	travel_duration_days_min?: >=0 & int
	travel_duration_days_max?: >=0 & int
	name?:                     string
	email?:                    common.#Email
	phone_number?:             string
	budget_lower_USD?:         >=0 & int
	budget_upper_USD?:         >=0 & int
	preferred_language?:       enums.#LanguageCode
	notes?:                    string
	submittedAt?:              common.#Timestamp
}

#BookingPayment: {
	id:         common.#Identifier
	label:      string & !=""
	status:     enums.#PaymentStatus
	netAmount:  common.#NonNegativeMoneyAmount
	taxRate:    >=0 & number
	dueDate?:   common.#DateOnly
	paidAt?:    common.#Timestamp
	notes?:     string
	createdAt?: common.#Timestamp
	updatedAt?: common.#Timestamp
}

#BookingPricingSummary: {
	agreedNetAmount:        common.#NonNegativeMoneyAmount
	adjustedNetAmount:      common.#MoneyAmount
	scheduledNetAmount:     common.#NonNegativeMoneyAmount
	unscheduledNetAmount:   common.#MoneyAmount
	scheduledTaxAmount:     common.#MoneyAmount
	scheduledGrossAmount:   common.#MoneyAmount
	paidGrossAmount:        common.#MoneyAmount
	outstandingGrossAmount: common.#MoneyAmount
	isScheduleBalanced:     bool
}

#BookingPricing: {
	currency:        enums.#CurrencyCode
	agreedNetAmount: common.#NonNegativeMoneyAmount
	adjustments: [...#PricingAdjustment]
	payments: [...#BookingPayment]
	summary: #BookingPricingSummary
}

#BookingActivityType: enums.#BookingActivityType

#BookingActivity: {
	id:        common.#Identifier
	bookingId: common.#Identifier
	type:      #BookingActivityType
	actor:     string & !=""
	detail:    string & !=""
	createdAt: common.#Timestamp
}

#BookingInvoice: #Invoice

#Booking: {
	id:                          common.#Identifier
	name?:                       string
	booking_hash?:               string
	stage:                       enums.#BookingStage
	atp_staff?:                  common.#Identifier
	serviceLevelAgreementDueAt?: common.#Timestamp
	destinations?: [...enums.#CountryCode]
	travel_styles?: [...string]
	travel_start_day?:    common.#DateOnly
	travel_end_day?:      common.#DateOnly
	number_of_travelers?: >=0 & <=common.#MaxTravelers & int
	preferredCurrency?:   enums.#CurrencyCode
	notes?:               string
	persons?: [...#BookingPerson]
	web_form_submission?: #BookingWebFormSubmission
	pricing:              #BookingPricing
	offer:                #BookingOffer
	source?:              #SourceAttribution
	createdAt:            common.#Timestamp
	updatedAt:            common.#Timestamp
}
