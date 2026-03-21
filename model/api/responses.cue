package api

import (
	common "travelagency.local/model/common"
	entities "travelagency.local/model/entities"
	enums "travelagency.local/model/enums"
)

#KeycloakUserDirectoryEntry: {
	id:        common.#Identifier
	name:      string
	active?:   bool
	username?: string
}

#KeycloakUserListResponse: {
	items: [...#KeycloakUserDirectoryEntry]
	total: >=0 & int
}

#BookingDeleteResponse: {
	deleted:    bool
	booking_id: common.#Identifier
}

#BookingActivitiesResponse: {
	items: [...entities.#BookingActivity]
	activities: [...entities.#BookingActivity]
	total: >=0 & int
}

#BookingActivityResponse: {
	activity: entities.#BookingActivity
	booking:  #BookingReadModel
}

#BookingInvoicesResponse: {
	items: [...entities.#BookingInvoice]
	total: >=0 & int
}

#BookingInvoiceResponse: {
	invoice:    entities.#BookingInvoice
	booking:    #BookingReadModel
	unchanged?: bool
}

#BookingChatEvent: {
	id:               common.#Identifier
	channel:          string
	direction:        string
	event_type:       string
	external_status?: string
	text_preview:     string
	sender_display?:  string
	sender_contact?:  string
	sent_at?:         common.#Timestamp
	received_at?:     common.#Timestamp
	conversation_id:  common.#Identifier
	open_url?:        string
}

#BookingChatConversation: {
	id:                   common.#Identifier
	channel:              string
	external_contact_id?: string
	booking_id?:          common.#Identifier
	related_bookings?: [...{
		booking_id: common.#Identifier
		name?:      string
		stage?:     string
	}]
	last_event_at?:  common.#Timestamp
	latest_preview?: string
	open_url?:       string
}

#BookingChatResponse: {
	mode?: string
	items: [...#BookingChatEvent]
	total: >=0 & int
	conversations: [...#BookingChatConversation]
	conversation_total: >=0 & int
}

#TourOptions: {
	destinations?: [...string]
	styles?: [...string]
}

#BookingListFilters: {
	stage?:                     string
	assigned_keycloak_user_id?: common.#Identifier
	search?:                    string
}

#TourListFilters: {
	destination?: string
	style?:       string
	search?:      string
}

#TravelPlanSegmentSearchResult: {
	source_booking_id:    common.#Identifier
	source_booking_name?: string
	source_booking_code?: string
	day_number?:          >0 & int
	segment_id:           common.#Identifier
	segment_kind?:        enums.#TravelPlanSegmentKind
	title:                string
	details?:             string
	location?:            string
	overnight_location?:  string
	thumbnail_url?:       common.#Url | string
	image_count?:         >=0 & int
	supplier_name?:       string
	updated_at?:          common.#Timestamp
}

#TravelPlanSegmentSearchResponse: {
	items: [...#TravelPlanSegmentSearchResult]
	total: >=0 & int
}

#OfferExchangeRatesResponse: {
	from_currency:     string
	to_currency:       string
	exchange_rate:     number
	total_price_cents: int
	converted_components: [...entities.#BookingOfferComponent]
	warning?: string
}

#TranslationEntriesResponse: {
	source_lang: enums.#LanguageCode
	target_lang: enums.#LanguageCode
	entries: [...#TranslationEntry]
}

#BookingGeneratedOfferGmailDraftResponse: {
	draft_id:           common.#Identifier
	gmail_draft_url:    common.#Url | string
	recipient_email:    common.#Email
	generated_offer_id: common.#Identifier
	activity_logged:    bool
	warning?:           string
}

#TranslationStatusSummary: {
	lang:               enums.#LanguageCode
	source_lang:        enums.#LanguageCode
	status:             "source" | "empty" | "missing" | "stale" | "partial" | "machine_translated" | "reviewed"
	origin?:            "manual" | "machine"
	updated_at?:        common.#Timestamp
	stale:              bool
	total_fields:       >=0 & int
	translated_fields:  >=0 & int
	missing_fields:     >=0 & int
	has_source_content: bool
	has_target_content: bool
	source_hash?:       string & !=""
}

#GeneratedOfferAcceptancePublicSummary: {
	accepted_at:            common.#Timestamp
	method:                 enums.#OfferAcceptanceMethod
	accepted_amount_cents?: >=0 & int
	accepted_currency?:     enums.#CurrencyCode
}

#PublicGeneratedOfferDepositAcceptanceRuleView: {
	payment_term_label:    string & !=""
	required_amount_cents: >=0 & int
	currency:              enums.#CurrencyCode
}

#PublicGeneratedOfferAcceptanceRouteView: {
	mode:                       enums.#GeneratedOfferAcceptanceRouteMode
	status:                     enums.#GeneratedOfferAcceptanceRouteStatus
	expires_at?:                common.#Timestamp
	customer_message_snapshot?: string
	deposit_rule?:              #PublicGeneratedOfferDepositAcceptanceRuleView
}

#GeneratedBookingOfferReadModel: {
	id:                            common.#Identifier
	booking_id:                    common.#Identifier
	version:                       >=1 & int
	filename:                      string & !=""
	lang:                          enums.#LanguageCode
	comment?:                      string
	created_at:                    common.#Timestamp
	created_by?:                   string
	currency:                      enums.#CurrencyCode
	total_price_cents:             int
	payment_terms?:                entities.#BookingOfferPaymentTerms
	offer:                         entities.#BookingOffer
	travel_plan?:                  entities.#BookingTravelPlan
	pdf_url:                       string & !=""
	acceptance_route?:             entities.#GeneratedOfferAcceptanceRoute
	public_acceptance_token?:      string & !=""
	public_acceptance_expires_at?: common.#Timestamp
	acceptance?:                   entities.#GeneratedOfferAcceptance
}

#BookingReadModel: {
	id:                              common.#Identifier
	name?:                           string
	image?:                          string
	core_revision?:                  >=0 & int
	notes_revision?:                 >=0 & int
	persons_revision?:               >=0 & int
	travel_plan_revision?:           >=0 & int
	pricing_revision?:               >=0 & int
	offer_revision?:                 >=0 & int
	invoices_revision?:              >=0 & int
	stage:                           enums.#BookingStage
	assigned_keycloak_user_id?:      common.#Identifier
	service_level_agreement_due_at?: common.#Timestamp
	destinations?: [...enums.#CountryCode]
	travel_styles?: [...string]
	travel_start_day?:            common.#DateOnly
	travel_end_day?:              common.#DateOnly
	number_of_travelers?:         >=0 & int
	preferred_currency?:          enums.#CurrencyCode
	customer_language?:           enums.#LanguageCode
	accepted_generated_offer_id?: common.#Identifier
	notes?:                       string
	persons?: [...entities.#BookingPerson]
	travel_plan?:         entities.#BookingTravelPlan
	web_form_submission?: entities.#BookingWebFormSubmission
	pricing:              entities.#BookingPricing
	offer:                entities.#BookingOffer
	generated_offers?: [...#GeneratedBookingOfferReadModel]
	travel_plan_translation_status: #TranslationStatusSummary
	offer_translation_status:       #TranslationStatusSummary
	generated_offer_email_enabled:  bool
	translation_enabled:            bool
	created_at:                     common.#Timestamp
	updated_at:                     common.#Timestamp
}

#PublicGeneratedOfferAccessResponse: {
	booking_id:                    common.#Identifier
	generated_offer_id:            common.#Identifier
	booking_name?:                 string
	lang:                          enums.#LanguageCode
	currency:                      enums.#CurrencyCode
	total_price_cents:             int
	comment?:                      string
	created_at:                    common.#Timestamp
	pdf_url?:                      string & !=""
	payment_terms?:                entities.#BookingOfferPaymentTerms
	acceptance_route?:             #PublicGeneratedOfferAcceptanceRouteView
	public_acceptance_expires_at?: common.#Timestamp
	accepted:                      bool
	acceptance?:                   #GeneratedOfferAcceptancePublicSummary
}

#PublicGeneratedOfferAcceptResponse: {
	booking_id:           common.#Identifier
	generated_offer_id:   common.#Identifier
	accepted:             bool
	status:               "ACCEPTED" | "OTP_REQUIRED"
	acceptance_route?:    #PublicGeneratedOfferAcceptanceRouteView
	acceptance?:          #GeneratedOfferAcceptancePublicSummary
	otp_channel?:         enums.#OfferAcceptanceOtpChannel
	otp_sent_to?:         string
	otp_expires_at?:      common.#Timestamp
	retry_after_seconds?: >=0 & int
}

#SupplierListResponse: {
	items: [...entities.#Supplier]
	total: >=0 & int
}

#SupplierResponse: {
	supplier: entities.#Supplier
}

#TourResponse: {
	tour: entities.#Tour
}

#AuthenticatedUser: {
	sub?:                string
	name?:               string
	given_name?:         string
	family_name?:        string
	email?:              common.#Email
	preferred_username?: string
	roles?: [...string]
}

#AuthMeResponse: {
	authenticated: bool
	user?:         #AuthenticatedUser
}
