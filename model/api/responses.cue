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
	realm_roles?: [...string]
	client_roles?: [...string]
}

#KeycloakUserListResponse: {
	items: [...#KeycloakUserDirectoryEntry]
	total: >=0 & int
}

#KeycloakUserStaffProfileEntry: {
	id:        common.#Identifier
	name:      string
	active?:   bool
	username?: string
	realm_roles?: [...string]
	client_roles?: [...string]
	staff_profile: entities.#AtpStaffProfile
}

#KeycloakUserStaffProfileEntryResponse: {
	user: #KeycloakUserStaffProfileEntry
}

#KeycloakUserStaffProfileListResponse: {
	items: [...#KeycloakUserStaffProfileEntry]
	total: >=0 & int
}

#PublicAtpStaffTeamResponse: {
	items: [...entities.#AtpStaffProfile]
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

#CatalogOption: {
	code:  string & !=""
	label: string & !=""
}

#TourOptions: {
	destinations?: [...#CatalogOption]
	styles?: [...#CatalogOption]
}

#BookingListFilters: {
	stage?:                     string
	assigned_keycloak_user_id?: common.#Identifier
	search?:                    string
}

#TourListFilters: {
	destination?: enums.#CountryCode
	style?:       enums.#TourStyleCode
	search?:      string
}

#TravelPlanServiceSearchResult: {
	source_booking_id:    common.#Identifier
	source_booking_name?: string
	source_booking_code?: string
	day_number?:          >0 & int
	service_id:              common.#Identifier
	service_kind?:           enums.#TravelPlanServiceKind
	title?:               string
	details?:             string
	location?:            string
	overnight_location?:  string
	thumbnail_url?:       common.#Url | string
	image_count?:         >=0 & int
	supplier_name?:       string
	updated_at?:          common.#Timestamp
}

#TravelPlanServiceSearchResponse: {
	items: [...#TravelPlanServiceSearchResult]
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

#GeneratedOfferBookingConfirmationPublicSummary: {
	accepted_at:            common.#Timestamp
	method:                 enums.#BookingConfirmationMethod
	accepted_amount_cents?: >=0 & int
	accepted_currency?:     enums.#CurrencyCode
}

#PublicGeneratedOfferDepositBookingConfirmationRuleView: {
	payment_term_label:    string & !=""
	required_amount_cents: >=0 & int
	currency:              enums.#CurrencyCode
}

#PublicGeneratedOfferBookingConfirmationRouteView: {
	mode:                       enums.#GeneratedOfferBookingConfirmationRouteMode
	status:                     enums.#GeneratedOfferBookingConfirmationRouteStatus
	expires_at?:                common.#Timestamp
	customer_message_snapshot?: string
	deposit_rule?:              #PublicGeneratedOfferDepositBookingConfirmationRuleView
}

#BookingOfferPaymentTermLineReadModel: entities.#BookingOfferPaymentTermLine & {
	resolved_amount_cents: >=0 & int
}

#BookingOfferPaymentTermsReadModel: {
	currency: enums.#CurrencyCode
	lines: [...#BookingOfferPaymentTermLineReadModel]
	notes?:                       string
	basis_total_amount_cents:     >=0 & int
	scheduled_total_amount_cents: >=0 & int
}

#BookingOfferVisibleTripPriceReadModel: {
	label?: string
	amount_cents:           common.#MoneyAmount
	currency:               enums.#CurrencyCode
	line_net_amount_cents:  common.#MoneyAmount
	line_tax_amount_cents:  common.#MoneyAmount
	line_gross_amount_cents: common.#MoneyAmount
}

#BookingOfferVisibleDayPriceReadModel: {
	day_number?: >0 & int
	label?: string
	amount_cents:           common.#MoneyAmount
	currency:               enums.#CurrencyCode
	line_net_amount_cents:  common.#MoneyAmount
	line_tax_amount_cents:  common.#MoneyAmount
	line_gross_amount_cents: common.#MoneyAmount
}

#BookingOfferVisiblePricingReadModel: {
	detail_level:     enums.#OfferDetailLevel
	derivable:        bool
	trip_price?:      #BookingOfferVisibleTripPriceReadModel
	days:             [...#BookingOfferVisibleDayPriceReadModel]
	components:       [...entities.#BookingOfferComponent]
	additional_items: [...entities.#BookingOfferAdditionalItem]
}

#BookingOfferReadModel: {
	currency: enums.#CurrencyCode
	status?:  "DRAFT" | "APPROVED" | "OFFER_SENT"
	offer_detail_level_internal: enums.#OfferDetailLevel
	offer_detail_level_visible:  enums.#OfferDetailLevel
	category_rules: [...entities.#BookingOfferCategoryRule]
	components: [...entities.#BookingOfferComponent]
	trip_price_internal?: entities.#BookingOfferTripPriceInternal
	days_internal?: [...entities.#BookingOfferDayPriceInternal]
	additional_items?: [...entities.#BookingOfferAdditionalItem]
	discount?:          entities.#BookingOfferDiscount
	totals:             entities.#BookingOfferTotals
	quotation_summary?: entities.#BookingOfferQuotationSummary
	payment_terms?:     #BookingOfferPaymentTermsReadModel
	visible_pricing:    #BookingOfferVisiblePricingReadModel
	total_price_cents:  int
}

#BookingAcceptedRecordReadModel: {
	available:                        bool
	deposit_received_at?:             common.#Timestamp
	deposit_confirmed_by_atp_staff_id?: common.#Identifier
	deposit_confirmed_by_label?:      string
	accepted_deposit_amount_cents?:   >=0 & int
	accepted_deposit_currency?:       enums.#CurrencyCode
	accepted_deposit_reference?:      string
	offer?:                           #BookingOfferReadModel
	payment_terms?:                   #BookingOfferPaymentTermsReadModel
	travel_plan?:                     entities.#BookingTravelPlan
	offer_artifact_ref?:              common.#Identifier
	travel_plan_artifact_ref?:        common.#Identifier
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
	payment_terms?:                #BookingOfferPaymentTermsReadModel
	offer:                         #BookingOfferReadModel
	travel_plan?:                  entities.#BookingTravelPlan
	pdf_url:                       string & !=""
	booking_confirmation_route?:             entities.#GeneratedOfferBookingConfirmationRoute
	public_booking_confirmation_token?:      string & !=""
	public_booking_confirmation_expires_at?: common.#Timestamp
	booking_confirmation?:                   entities.#GeneratedOfferBookingConfirmation
}

#BookingTravelPlanPdfReadModel: {
	id:               common.#Identifier
	filename:         string & !=""
	page_count:       >0 & int
	created_at:       common.#Timestamp
	sent_to_customer: bool
	pdf_url:          string & !=""
}

#TravelPlanPdfArtifactCreateResponse: {
	artifact: #BookingTravelPlanPdfReadModel
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
	deposit_received_at?:            common.#Timestamp
	deposit_confirmed_by_atp_staff_id?: common.#Identifier
	deposit_receipt_draft_received_at?: common.#Timestamp
	deposit_receipt_draft_confirmed_by_atp_staff_id?: common.#Identifier
	deposit_receipt_draft_reference?: string
	milestones?:                     entities.#BookingMilestones
	last_action?:                    enums.#BookingMilestoneAction
	last_action_at?:                 common.#Timestamp
	assigned_keycloak_user_id?:      common.#Identifier
	source_channel?:                 enums.#BookingSourceChannel
	referral_kind?:                  enums.#BookingReferralKind
	referral_label?:                 string
	referral_staff_user_id?:         common.#Identifier
	assigned_keycloak_user_label?:   string
	assigned_atp_staff?:             entities.#AtpStaffProfile
	service_level_agreement_due_at?: common.#Timestamp
	destinations?: [...enums.#CountryCode]
	travel_styles?: [...string]
	travel_start_day?:            common.#DateOnly
	travel_end_day?:              common.#DateOnly
	number_of_travelers?:         >=0 & int
	preferred_currency?:          enums.#CurrencyCode
	customer_language?:           enums.#LanguageCode
	confirmed_generated_offer_id?: common.#Identifier
	accepted_record?:             #BookingAcceptedRecordReadModel
	notes?:                       string
	persons?: [...entities.#BookingPerson]
	travel_plan?:         entities.#BookingTravelPlan
	web_form_submission?: entities.#BookingWebFormSubmission
	pricing:              entities.#BookingPricing
	offer:                #BookingOfferReadModel
	generated_offers?: [...#GeneratedBookingOfferReadModel]
	travel_plan_pdfs?: [...#BookingTravelPlanPdfReadModel]
	travel_plan_translation_status: #TranslationStatusSummary
	offer_translation_status:       #TranslationStatusSummary
	generated_offer_email_enabled:  bool
	translation_enabled:            bool
	created_at:                     common.#Timestamp
	updated_at:                     common.#Timestamp
}

#BookingPersonTravelerDetailsLinkResponse: {
	booking_id:                  common.#Identifier
	person_id:                   common.#Identifier
	traveler_details_token:      string & !=""
	traveler_details_expires_at: common.#Timestamp
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
	payment_terms?:                #BookingOfferPaymentTermsReadModel
	booking_confirmation_route?:             #PublicGeneratedOfferBookingConfirmationRouteView
	public_booking_confirmation_expires_at?: common.#Timestamp
	confirmed:                     bool
	booking_confirmation?:                   #GeneratedOfferBookingConfirmationPublicSummary
}

#PublicGeneratedOfferAcceptResponse: {
	booking_id:           common.#Identifier
	generated_offer_id:   common.#Identifier
	confirmed:            bool
	status:               "CONFIRMED"
	booking_confirmation_route?:    #PublicGeneratedOfferBookingConfirmationRouteView
	booking_confirmation?:          #GeneratedOfferBookingConfirmationPublicSummary
}

#PublicTravelerDetailsAccessResponse: {
	booking_id:                          common.#Identifier
	person_id:                           common.#Identifier
	traveler_number?:                    >=1 & int
	booking_name?:                       string
	customer_language?:                  enums.#LanguageCode
	persons_revision:                    >=0 & int
	public_traveler_details_expires_at?: common.#Timestamp
	privacy_notice?:                     string
	person:                              entities.#BookingPerson
}

#PublicTravelerDetailsUpdateResponse: {
	booking_id:                          common.#Identifier
	person_id:                           common.#Identifier
	traveler_number?:                    >=1 & int
	booking_name?:                       string
	customer_language?:                  enums.#LanguageCode
	persons_revision:                    >=0 & int
	public_traveler_details_expires_at?: common.#Timestamp
	privacy_notice?:                     string
	person:                              entities.#BookingPerson
	saved_at:                            common.#Timestamp
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

#TourDeleteResponse: {
	deleted: bool
	tour_id: common.#Identifier
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
