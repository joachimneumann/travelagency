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

#BookingActivityType: enums.#BookingActivityType

#BookingActivity: {
	id:         common.#Identifier
	booking_id: common.#Identifier
	type:       #BookingActivityType
	actor:      string & !=""
	detail:     string & !=""
	created_at: common.#Timestamp
}

#BookingPaymentDocument: #PaymentDocument

#BookingPdfPersonalizationScoped: {
	subtitle?:                 string
	subtitle_i18n?:            [string]: string
	include_subtitle?:         bool
	welcome?:                  string
	welcome_i18n?:             [string]: string
	include_welcome?:          bool
	children_policy?:          string
	children_policy_i18n?:     [string]: string
	include_children_policy?:  bool
	whats_not_included?:       string
	whats_not_included_i18n?:  [string]: string
	include_whats_not_included?: bool
	closing?:                  string
	closing_i18n?:             [string]: string
	include_closing?:          bool
	include_cancellation_policy?: bool
	include_who_is_traveling?: bool
}

#BookingPdfPersonalization: {
	travel_plan?:                    #BookingPdfPersonalizationScoped
	offer?:                          #BookingPdfPersonalizationScoped
	payment_confirmation_deposit?:   #BookingPdfPersonalizationScoped
	payment_request_deposit?:        #BookingPdfPersonalizationScoped
	payment_request_installment?:    #BookingPdfPersonalizationScoped
	payment_confirmation_installment?: #BookingPdfPersonalizationScoped
	payment_request_final?:          #BookingPdfPersonalizationScoped
	payment_confirmation_final?:     #BookingPdfPersonalizationScoped
}

#BaseBooking: {
	name?:                           string
	travel_styles?:                  [...string]
	travel_plan?:                    #BookingTravelPlan
}

#BaseBookingWithPersons: #BaseBooking & {
	persons?: [...#BookingPerson]
}

#Booking: #BaseBookingWithPersons & {
	id:                              common.#Identifier
	image?:                          string
	core_revision?:                  >=0 & int
	notes_revision?:                 >=0 & int
	persons_revision?:               >=0 & int
	travel_plan_revision?:           >=0 & int
	offer_revision?:                 >=0 & int
	payment_documents_revision?:     >=0 & int
	deposit_received_at?:            common.#Timestamp
	deposit_confirmed_by_atp_staff_id?: common.#Identifier
	assigned_keycloak_user_id?:      common.#Identifier
	source_channel?:                 enums.#BookingSourceChannel
	referral_kind?:                  enums.#BookingReferralKind
	referral_label?:                 string
	referral_staff_user_id?:         common.#Identifier
	pdf_personalization?: #BookingPdfPersonalization
	travel_start_day?:            common.#DateOnly
	travel_end_day?:              common.#DateOnly
	number_of_travelers?:         >=0 & <=common.#MaxTravelers & int
	preferred_currency?:          enums.#CurrencyCode
	customer_language?:           enums.#LanguageCode
	accepted_deposit_amount_cents?: common.#NonNegativeMoneyAmount
	accepted_deposit_currency?:     enums.#CurrencyCode
	accepted_deposit_reference?:    string
	accepted_offer_snapshot?:       #BookingOffer
	accepted_payment_terms_snapshot?: #BookingOfferPaymentTerms
	accepted_travel_plan_snapshot?: #BookingTravelPlan
	accepted_offer_artifact_ref?:   common.#Identifier
	accepted_travel_plan_artifact_ref?: common.#Identifier
	notes?:                       string
	web_form_submission?: #BookingWebFormSubmission
	offer:                #BookingOffer
	generated_offers?: [...#GeneratedBookingOffer]
	created_at: common.#Timestamp
	updated_at: common.#Timestamp
}
