package api

import (
	common "travelagency.local/model/common"
	databaseModel "travelagency.local/model/database"
	enums "travelagency.local/model/enums"
	jsonModel "travelagency.local/model/json"
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
	staff_profile: jsonModel.#AtpStaffProfile
}

#KeycloakUserStaffProfileEntryResponse: {
	user: #KeycloakUserStaffProfileEntry
}

#KeycloakUserStaffProfileListResponse: {
	items: [...#KeycloakUserStaffProfileEntry]
	total: >=0 & int
}

#PublicAtpStaffTeamResponse: {
	items: [...jsonModel.#AtpStaffProfile]
	total: >=0 & int
}

#CountryPracticalInfoListResponse: {
	items: [...jsonModel.#CountryPracticalInfo]
	total: >=0 & int
}

#BookingDeleteResponse: {
	deleted:    bool
	booking_id: common.#Identifier
}

#BookingActivitiesResponse: {
	items: [...databaseModel.#BookingActivity]
	activities: [...databaseModel.#BookingActivity]
	total: >=0 & int
}

#BookingActivityResponse: {
	activity: databaseModel.#BookingActivity
	booking:  #BookingReadModel
}

#BookingPaymentDocumentsResponse: {
	items: [...databaseModel.#BookingPaymentDocument]
	total: >=0 & int
}

#BookingPaymentDocumentResponse: {
	document: databaseModel.#BookingPaymentDocument
	booking:  #BookingReadModel
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
	service_id:           common.#Identifier
	service_kind?:        enums.#TravelPlanServiceKind
	title?:               string
	details?:             string
	location?:            string
	overnight_location?:  string
	thumbnail_url?:       common.#Url | string
	image_count?:         >=0 & int
	updated_at?:          common.#Timestamp
}

#TravelPlanServiceSearchResponse: {
	items: [...#TravelPlanServiceSearchResult]
	total: >=0 & int
}

#TravelPlanDaySearchResult: {
	source_booking_id:    common.#Identifier
	source_booking_name?: string
	source_booking_code?: string
	day_id:               common.#Identifier
	day_number?:          >0 & int
	title?:               string
	overnight_location?:  string
	notes?:               string
	thumbnail_url?:       common.#Url | string
	service_count?:       >=0 & int
	image_count?:         >=0 & int
	updated_at?:          common.#Timestamp
}

#TravelPlanDaySearchResponse: {
	items: [...#TravelPlanDaySearchResult]
	total: >=0 & int
}

#TravelPlanSearchResult: {
	source_booking_id:    common.#Identifier
	source_booking_name?: string
	source_booking_code?: string
	day_count:            >=0 & int
	service_count:        >=0 & int
	first_date?:          common.#DateOnly
	last_date?:           common.#DateOnly
	title_preview?:       string
	overnight_preview?:   string
	thumbnail_url?:       common.#Url | string
	updated_at?:          common.#Timestamp
}

#TravelPlanSearchResponse: {
	items: [...#TravelPlanSearchResult]
	total: >=0 & int
}

#TravelPlanTemplateReadModel: {
	id:           common.#Identifier
	title:        string
	destinations: [...enums.#CountryCode] | []
	travel_plan:  databaseModel.#BookingTravelPlan
}

#TravelPlanTemplateListResponse: {
	items: [...#TravelPlanTemplateReadModel]
	total: >=0 & int
}

#TravelPlanTemplateResponse: {
	template: #TravelPlanTemplateReadModel
}

#OfferExchangeRatesResponse: {
	from_currency:     string
	to_currency:       string
	exchange_rate:     number
	total_price_cents: int
	converted_lines: [...databaseModel.#BookingOfferAdditionalItem]
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

#BookingOfferPaymentTermLineReadModel: databaseModel.#BookingOfferPaymentTermLine & {
	resolved_amount_cents: >=0 & int
}

#BookingOfferPaymentTermsReadModel: {
	currency: enums.#CurrencyCode
	lines: [...#BookingOfferPaymentTermLineReadModel]
	basis_total_amount_cents:     >=0 & int
	scheduled_total_amount_cents: >=0 & int
}

#BookingOfferVisibleTripPriceReadModel: {
	label?:                  string
	amount_cents:            common.#MoneyAmount
	currency:                enums.#CurrencyCode
	line_net_amount_cents:   common.#MoneyAmount
	line_tax_amount_cents:   common.#MoneyAmount
	line_gross_amount_cents: common.#MoneyAmount
}

#BookingOfferVisibleDayPriceReadModel: {
	day_number?:             >0 & int
	label?:                  string
	amount_cents:            common.#MoneyAmount
	currency:                enums.#CurrencyCode
	line_net_amount_cents:   common.#MoneyAmount
	line_tax_amount_cents:   common.#MoneyAmount
	line_gross_amount_cents: common.#MoneyAmount
}

#BookingOfferVisiblePricingReadModel: {
	detail_level: enums.#OfferDetailLevel
	derivable:    bool
	trip_price?:  #BookingOfferVisibleTripPriceReadModel
	days: [...#BookingOfferVisibleDayPriceReadModel]
	additional_items: [...databaseModel.#BookingOfferAdditionalItem]
}

#BookingOfferReadModel: {
	currency:                    enums.#CurrencyCode
	status?:                     "DRAFT" | "APPROVED" | "OFFER_SENT"
	offer_detail_level_internal: enums.#OfferDetailLevel
	offer_detail_level_visible:  enums.#OfferDetailLevel
	category_rules: [...databaseModel.#BookingOfferCategoryRule]
	trip_price_internal?: databaseModel.#BookingOfferTripPriceInternal
	days_internal?: [...databaseModel.#BookingOfferDayPriceInternal]
	additional_items?: [...databaseModel.#BookingOfferAdditionalItem]
	discounts?:         [...databaseModel.#BookingOfferDiscount]
	totals:             databaseModel.#BookingOfferTotals
	quotation_summary?: databaseModel.#BookingOfferQuotationSummary
	payment_terms?:     #BookingOfferPaymentTermsReadModel
	visible_pricing:    #BookingOfferVisiblePricingReadModel
	total_price_cents:  int
}

#BookingAcceptedRecordReadModel: {
	available:                          bool
	deposit_received_at?:               common.#Timestamp
	deposit_confirmed_by_atp_staff_id?: common.#Identifier
	deposit_confirmed_by_label?:        string
	accepted_deposit_amount_cents?:     >=0 & int
	accepted_deposit_currency?:         enums.#CurrencyCode
	accepted_deposit_reference?:        string
	offer?:                             #BookingOfferReadModel
	payment_terms?:                     #BookingOfferPaymentTermsReadModel
	travel_plan?:                       databaseModel.#BookingTravelPlan
	offer_artifact_ref?:                common.#Identifier
	travel_plan_artifact_ref?:          common.#Identifier
}

#GeneratedBookingOfferReadModel: {
	id:                                      common.#Identifier
	booking_id:                              common.#Identifier
	version:                                 >=1 & int
	filename:                                string & !=""
	lang:                                    enums.#LanguageCode
	comment?:                                string
	created_at:                              common.#Timestamp
	created_by?:                             string
	currency:                                enums.#CurrencyCode
	total_price_cents:                       int
	payment_terms?:                          #BookingOfferPaymentTermsReadModel
	offer:                                   #BookingOfferReadModel
	travel_plan?:                            databaseModel.#BookingTravelPlan
	pdf_url:                                 string & !=""
}

#BookingTravelPlanPdfReadModel: {
	id:               common.#Identifier
	filename:         string & !=""
	page_count:       >0 & int
	created_at:       common.#Timestamp
	sent_to_customer: bool
	comment?:         string
	pdf_url:          string & !=""
}

#TravelPlanPdfArtifactCreateResponse: {
	artifact: #BookingTravelPlanPdfReadModel
}

#BookingReadModel: {
	id:                                               common.#Identifier
	name?:                                            string
	image?:                                           string
	core_revision?:                                   >=0 & int
	notes_revision?:                                  >=0 & int
	persons_revision?:                                >=0 & int
	travel_plan_revision?:                            >=0 & int
	offer_revision?:                                  >=0 & int
	payment_documents_revision?:                      >=0 & int
	deposit_received_at?:                             common.#Timestamp
	deposit_confirmed_by_atp_staff_id?:               common.#Identifier
	assigned_keycloak_user_id?:                       common.#Identifier
	source_channel?:                                  enums.#BookingSourceChannel
	referral_kind?:                                   enums.#BookingReferralKind
	referral_label?:                                  string
	referral_staff_user_id?:                          common.#Identifier
	assigned_keycloak_user_label?:                    string
	assigned_atp_staff?:                              jsonModel.#AtpStaffProfile
	travel_styles?: [...string]
	pdf_personalization?:          databaseModel.#BookingPdfPersonalization
	travel_start_day?:             common.#DateOnly
	travel_end_day?:               common.#DateOnly
	number_of_travelers?:          >=0 & int
	preferred_currency?:           enums.#CurrencyCode
	customer_language?:            enums.#LanguageCode
	accepted_record?:              #BookingAcceptedRecordReadModel
	notes?:                        string
	persons?: [...databaseModel.#BookingPerson]
	travel_plan?:         databaseModel.#BookingTravelPlan
	web_form_submission?: databaseModel.#BookingWebFormSubmission
	offer:                #BookingOfferReadModel
	generated_offers?: [...#GeneratedBookingOfferReadModel]
	travel_plan_pdfs?: [...#BookingTravelPlanPdfReadModel]
	travel_plan_translation_status: #TranslationStatusSummary
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

#PublicTravelerDetailsAccessResponse: {
	booking_id:                          common.#Identifier
	person_id:                           common.#Identifier
	traveler_number?:                    >=1 & int
	booking_name?:                       string
	customer_language?:                  enums.#LanguageCode
	persons_revision:                    >=0 & int
	public_traveler_details_expires_at?: common.#Timestamp
	privacy_notice?:                     string
	person:                              databaseModel.#BookingPerson
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
	person:                              databaseModel.#BookingPerson
	saved_at:                            common.#Timestamp
}

#TourResponse: {
	tour: jsonModel.#Tour
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
