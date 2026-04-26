package api

import (
	common "travelagency.local/model/common"
	databaseModel "travelagency.local/model/database"
	enums "travelagency.local/model/enums"
	jsonModel "travelagency.local/model/json"
)

#TravelerConstraints: {
	min: common.#MinTravelers
	max: common.#MaxTravelers
}

#WebsiteBookingFormBase: {
	destinations?: [...string]
	travel_style?: [...string]
	travel_month?:             string
	number_of_travelers?:      >=common.#MinTravelers & <=common.#MaxTravelers & int
	preferred_currency:        enums.#CurrencyCode
	travel_duration_days_min?: >=0 & int
	travel_duration_days_max?: >=0 & int
	name:                      string
	email?:                    common.#Email
	phone_number?:             string & !=""
	budget_lower_usd?:         >=0 & int
	budget_upper_usd?:         >=0 & int
	preferred_language:        enums.#LanguageCode
	notes?:                    string
}

#WebsiteBookingForm:
	#WebsiteBookingFormBase & {
		email: common.#Email
	} | #WebsiteBookingFormBase & {
		phone_number: string & !=""
	}

#PublicBookingCreateRequest: #WebsiteBookingForm & {
	booking_name?:    string
	tour_id?:         string
	page_url?:        common.#Url | string
	referrer?:        common.#Url | string
	utm_source?:      string
	utm_medium?:      string
	utm_campaign?:    string
	idempotency_key?: string
}

#BookingCreateRequest: {
	name:               string
	preferred_language: enums.#LanguageCode
	preferred_currency: enums.#CurrencyCode
	destinations?: [...enums.#CountryCode]
	travel_styles?: [...string]
	primary_contact_name?:         string
	primary_contact_email?:        common.#Email
	primary_contact_phone_number?: string & !=""
	number_of_travelers?:          >=common.#MinTravelers & <=common.#MaxTravelers & int
	actor?:                        string
}

#BookingDeleteRequest: {
	expected_core_revision?: >=0 & int
}

#BookingNameUpdateRequest: {
	expected_core_revision?: >=0 & int
	name?:                   string
	actor?:                  string
}

#BookingCustomerLanguageUpdateRequest: {
	expected_core_revision?: >=0 & int
	customer_language:       enums.#LanguageCode
	actor?:                  string
}

#BookingSourceUpdateRequest: {
	expected_core_revision?: >=0 & int
	source_channel:          enums.#BookingSourceChannel
	referral_kind:           enums.#BookingReferralKind
	referral_label?:         string
	referral_staff_user_id?: common.#Identifier
	destinations?: [...enums.#CountryCode]
	travel_styles?: [...string]
	pdf_personalization?: databaseModel.#BookingPdfPersonalization
	actor?:               string
}

#BookingImageUploadRequest: #EvidenceUpload & {
	expected_core_revision?: >=0 & int
	actor?:                  string
}

#BookingOwnerUpdateRequest: {
	expected_core_revision?:    >=0 & int
	assigned_keycloak_user_id?: common.#Identifier
	actor?:                     string
}

#BookingCloneRequest: {
	expected_core_revision?: >=0 & int
	name:                    string
	include_travelers?:      bool
	actor?:                  string
}

#BookingPersonCreateRequest: {
	expected_persons_revision?: >=0 & int
	person:                     databaseModel.#BookingPerson
	actor?:                     string
}

#BookingPersonUpdateRequest: {
	expected_persons_revision?: >=0 & int
	person:                     databaseModel.#BookingPerson
	actor?:                     string
}

#BookingPersonDeleteRequest: {
	expected_persons_revision?: >=0 & int
	actor?:                     string
}

#BookingPersonPhotoUploadRequest: #EvidenceUpload & {
	expected_persons_revision?: >=0 & int
	actor?:                     string
}

#BookingNotesUpdateRequest: {
	expected_notes_revision?: >=0 & int
	notes?:                   string
	actor?:                   string
}

#TranslationEntriesRequest: {
	source_lang: enums.#LanguageCode
	target_lang: enums.#LanguageCode
	actor?:      string
	entries: [...#TranslationEntry]
}

#BookingTravelPlanUpdateRequest: {
	expected_travel_plan_revision?: >=0 & int
	travel_plan:                    databaseModel.#BookingTravelPlan
	actor?:                         string
}

#BookingTravelPlanTranslateRequest: {
	expected_travel_plan_revision?: >=0 & int
	source_lang:                    enums.#LanguageCode
	target_lang:                    enums.#LanguageCode
	actor?:                         string
}

#TravelPlanDaySearchRequest: {
	q?:           string
	destination?: string
	country?:     enums.#CountryCode
	style?:       string
	limit?:       >=0 & int
	offset?:      >=0 & int
}

#TravelPlanServiceSearchRequest: {
	q?:            string
	destination?:  string
	country?:      enums.#CountryCode
	style?:        string
	service_kind?: enums.#TravelPlanServiceKind
	limit?:        >=0 & int
	offset?:       >=0 & int
}

#TravelPlanDayImportRequest: {
	expected_travel_plan_revision?:       >=0 & int
	source_booking_id:                    common.#Identifier
	source_day_id:                        common.#Identifier
	include_images:                       *true | bool
	include_customer_visible_images_only: *false | bool
	include_notes:                        *true | bool
	include_translations:                 *true | bool
	actor?:                               string
}

#TravelPlanServiceImportRequest: {
	expected_travel_plan_revision?:       >=0 & int
	source_booking_id:                    common.#Identifier
	source_service_id:                    common.#Identifier
	insert_after_service_id?:             common.#Identifier
	include_images:                       *true | bool
	include_customer_visible_images_only: *false | bool
	include_notes:                        *true | bool
	include_translations:                 *true | bool
	actor?:                               string
}

#TravelPlanSearchRequest: {
	q?:           string
	destination?: string
	country?:     enums.#CountryCode
	style?:       string
	limit?:       >=0 & int
	offset?:      >=0 & int
}

#TravelPlanImportRequest: {
	expected_travel_plan_revision?:       >=0 & int
	source_booking_id:                    common.#Identifier
	include_images:                       *true | bool
	include_customer_visible_images_only: *false | bool
	include_notes:                        *true | bool
	include_translations:                 *true | bool
	actor?:                               string
}

#StandardTourUpsertRequest: {
	title?: string
	destinations?: [...enums.#CountryCode]
	travel_plan?: databaseModel.#BookingTravelPlan
	actor?:       string
}

#BookingStandardTourApplyRequest: {
	expected_travel_plan_revision?: >=0 & int
	actor?:                         string
}

#BookingTourApplyRequest: {
	expected_travel_plan_revision?: >=0 & int
	actor?:                         string
}

#TourTravelPlanUpdateRequest: {
	travel_plan: databaseModel.#TravelPlan
	expected_updated_at?: common.#Timestamp
	actor?:              string
}

#TravelPlanServiceImageUploadRequest: #EvidenceUpload & {
	expected_travel_plan_revision?: >=0 & int
	actor?:                         string
}

#TravelPlanServiceImageDeleteRequest: {
	expected_travel_plan_revision?: >=0 & int
	actor?:                         string
}

#TravelPlanAttachmentUploadRequest: #EvidenceUpload & {
	expected_travel_plan_revision?: >=0 & int
	actor?:                         string
}

#TravelPlanAttachmentDeleteRequest: {
	expected_travel_plan_revision?: >=0 & int
	actor?:                         string
}

#TravelPlanPdfArtifactCreateRequest: {
	expected_travel_plan_revision?: >=0 & int
	lang?:                          enums.#LanguageCode
	filename_suffix?:               string
	comment?:                       string
	actor?:                         string
}

#TravelPlanPdfArtifactUpdateRequest: {
	expected_travel_plan_revision?: >=0 & int
	sent_to_customer?:              bool
	comment?:                       string
	actor?:                         string
}

#TravelPlanPdfArtifactDeleteRequest: {
	expected_travel_plan_revision?: >=0 & int
	actor?:                         string
}

#BookingOfferUpdateRequest: {
	expected_offer_revision?: >=0 & int
	offer:                    databaseModel.#BookingOffer
	actor?:                   string
}

#BookingGenerateOfferRequest: {
	expected_offer_revision?: >=0 & int
	comment?:                 string
	actor?:                   string
}

#BookingGeneratedOfferUpdateRequest: {
	expected_offer_revision?: >=0 & int
	comment?:                 string
	actor?:                   string
}

#BookingGeneratedOfferDeleteRequest: {
	expected_offer_revision?: >=0 & int
	actor?:                   string
}

#BookingGeneratedOfferGmailDraftRequest: {
	actor?: string
}

#PublicTravelerDetailsUpdateRequest: {
	person: databaseModel.#BookingPerson
}

#CountryPracticalInfoUpdateRequest: {
	items: [...jsonModel.#CountryPracticalInfo]
}

#AtpStaffProfileUpdateRequest: {
	languages: [...enums.#LanguageCode]
	destinations?: [...enums.#CountryCode]
	name?:     string
	position?: string
	position_i18n?: [...jsonModel.#AtpStaffLocalizedTextEntry]
	friendly_short_name?:      string
	team_order?:               int | null
	appears_in_team_web_page?: bool
	description?:              string
	description_i18n?: [...jsonModel.#AtpStaffLocalizedTextEntry]
	short_description?: string
	short_description_i18n?: [...jsonModel.#AtpStaffLocalizedTextEntry]
}

#AtpStaffPhotoUploadRequest: #EvidenceUpload

#OfferExchangeRateLine: {
	id?:                    common.#Identifier
	category:               enums.#OfferCategory
	quantity:               >0 & int
	unit_amount_cents:      common.#NonNegativeMoneyAmount
	tax_rate_basis_points?: >=0 & <=100000 & int
}

#OfferExchangeRatesRequest: {
	from_currency: enums.#CurrencyCode
	to_currency:   enums.#CurrencyCode
	lines?: [...#OfferExchangeRateLine]
}

#BookingActivityCreateRequest: {
	expected_core_revision?: >=0 & int
	type:                    databaseModel.#BookingActivityType
	detail?:                 string
	actor?:                  string
}

#BookingPaymentDocumentCreateRequest: {
	expected_payment_documents_revision?: >=0 & int
	document_kind?:                       string
	payment_id?:                          common.#Identifier
	payment_received_at?:                 common.#Timestamp
	payment_confirmed_by_atp_staff_id?:   common.#Identifier
	payment_reference?:                   string
	payment_confirmed_by_label?:          string
	pdf_personalization?:                 databaseModel.#BookingPdfPersonalizationScoped
	actor?:                               string
}

#TourUpsertRequest: {
	id?:    common.#Identifier
	title?: string
	title_i18n?: [string]: string
	destinations?: [...enums.#CountryCode]
	styles?: [...enums.#TourStyleCode]
	priority?:                int
	seasonality_start_month?: enums.#MonthCode
	seasonality_end_month?:   enums.#MonthCode
	short_description?:       string
	short_description_i18n?: [string]: string
	pictures?: [...string]
	travel_plan?: databaseModel.#TravelPlan
	expected_updated_at?: common.#Timestamp
}

#TourTranslateFieldsRequest: #TranslationEntriesRequest

#EvidenceUpload: {
	filename:    string & !=""
	mime_type?:  string
	data_base64: string & !=""
}
