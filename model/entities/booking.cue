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
	id:                 common.#Identifier
	booking_hash?:      string
	client_id?:         common.#Identifier
	client_type?:       enums.#ClientType
	client_display_name?: string
	client_primary_phone_number?: string
	client_primary_email?: common.#Email
	stage:              enums.#BookingStage
	atpStaff?:          common.#Identifier
	atpStaffName?:      string
	ownerId?:           common.#Identifier
	ownerName?:         string
	slaDueAt?:          common.#Timestamp
	destination?:       [...string]
	style?:             [...string]
	travelMonth?:       string
	travelers?:         >=common.#MinTravelers & <=common.#MaxTravelers & int
	duration?:          string
	budget?:            string
	preferredCurrency?: enums.#CurrencyCode
	notes?:             string
	pricing:            #BookingPricing
	offer:              #BookingOffer
	source?:            #SourceAttribution
	idempotencyKey?:    string
	createdAt:          common.#Timestamp
	updatedAt:          common.#Timestamp
}
