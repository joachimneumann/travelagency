package api

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
	entities "travelagency.local/model/entities"
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
	expected_core_revision?:  >=0 & int
	source_channel:           enums.#BookingSourceChannel
	referral_kind:            enums.#BookingReferralKind
	referral_label?:          string
	referral_staff_user_id?:  common.#Identifier
	actor?:                   string
}

#BookingImageUploadRequest: #EvidenceUpload & {
	expected_core_revision?: >=0 & int
	actor?:                  string
}

#BookingMilestoneActionRequest: {
	expected_core_revision?: >=0 & int
	action:                  enums.#BookingMilestoneAction
	actor?:                  string
}

#BookingOwnerUpdateRequest: {
	expected_core_revision?:    >=0 & int
	assigned_keycloak_user_id?: common.#Identifier
	actor?:                     string
}

#BookingPersonCreateRequest: {
	expected_persons_revision?: >=0 & int
	person:                     entities.#BookingPerson
	actor?:                     string
}

#BookingPersonUpdateRequest: {
	expected_persons_revision?: >=0 & int
	person:                     entities.#BookingPerson
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
	travel_plan:                    entities.#BookingTravelPlan
	actor?:                         string
}

#BookingTravelPlanTranslateRequest: {
	expected_travel_plan_revision?: >=0 & int
	lang:                           enums.#LanguageCode
	actor?:                         string
}

#TravelPlanServiceSearchRequest: {
	q?:           string
	destination?: string
	country?:     enums.#CountryCode
	style?:       string
	service_kind?:   enums.#TravelPlanServiceKind
	limit?:       >=0 & int
	offset?:      >=0 & int
}

#TravelPlanServiceImportRequest: {
	expected_travel_plan_revision?:       >=0 & int
	source_booking_id:                    common.#Identifier
	source_service_id:                       common.#Identifier
	insert_after_service_id?:                common.#Identifier
	include_images:                       *true | bool
	include_customer_visible_images_only: *false | bool
	include_notes:                        *true | bool
	include_translations:                 *true | bool
	include_offer_links:                  *false | bool
	actor?:                               string
}

#TravelPlanServiceImageUploadRequest: #EvidenceUpload & {
	expected_travel_plan_revision?: >=0 & int
	actor?:                         string
}

#TravelPlanServiceImageDeleteRequest: {
	expected_travel_plan_revision?: >=0 & int
	actor?:                         string
}

#TravelPlanServiceImageReorderRequest: {
	expected_travel_plan_revision?: >=0 & int
	image_ids: [...common.#Identifier]
	actor?:                      string
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
	actor?:                         string
}

#TravelPlanPdfArtifactUpdateRequest: {
	expected_travel_plan_revision?: >=0 & int
	sent_to_customer:               bool
	actor?:                         string
}

#TravelPlanPdfArtifactDeleteRequest: {
	expected_travel_plan_revision?: >=0 & int
	actor?:                         string
}

#BookingPricingUpdateRequest: {
	expected_pricing_revision?: >=0 & int
	pricing:                    entities.#BookingPricing
	deposit_receipt?:           #BookingDepositReceiptUpdateRequest
	deposit_receipt_draft?:     #BookingDepositReceiptDraftUpdateRequest
	actor?:                     string
}

#BookingDepositReceiptUpdateRequest: {
	deposit_received_at:               common.#Timestamp
	deposit_confirmed_by_atp_staff_id: common.#Identifier
	deposit_reference?:                string
}

#BookingDepositReceiptDraftUpdateRequest: {
	deposit_received_at?:               common.#Timestamp
	deposit_confirmed_by_atp_staff_id?: common.#Identifier
	deposit_reference?:                string
}

#BookingOfferUpdateRequest: {
	expected_offer_revision?: >=0 & int
	offer:                    entities.#BookingOffer
	actor?:                   string
}

#BookingOfferTranslateRequest: {
	expected_offer_revision?: >=0 & int
	lang:                     enums.#LanguageCode
	actor?:                   string
}

#BookingGenerateOfferRequest: {
	expected_offer_revision?: >=0 & int
	comment?:                 string
	actor?:                   string
	booking_confirmation_route?:        #BookingGenerateOfferBookingConfirmationRouteRequest
}

#BookingGenerateOfferDepositBookingConfirmationRuleRequest: {
	payment_term_line_id: common.#Identifier
}

#BookingGenerateOfferBookingConfirmationRouteRequest: {
	mode:                       enums.#GeneratedOfferBookingConfirmationRouteMode
	expires_at?:                common.#Timestamp
	customer_message_snapshot?: string

	if mode == "DEPOSIT_PAYMENT" {
		deposit_rule: #BookingGenerateOfferDepositBookingConfirmationRuleRequest
	}
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

#PublicGeneratedOfferAcceptRequest: {
	booking_confirmation_token:       string & !=""
	accepted_by_name?:      string
	accepted_by_email?:     common.#Email
	accepted_by_phone?:     string
	accepted_by_person_id?: common.#Identifier
	language?:              enums.#LanguageCode
	otp_channel?:           enums.#BookingConfirmationOtpChannel
	otp_code?:              string & !=""
}

#PublicTravelerDetailsUpdateRequest: {
	person: entities.#BookingPerson
}

#SupplierCreateRequest: {
	name:             string
	contact?:         string
	emergency_phone?: string
	email?:           common.#Email
	country?:         enums.#CountryCode
	category:         enums.#SupplierCategory
}

#SupplierUpdateRequest: {
	name?:            string
	contact?:         string
	emergency_phone?: string
	email?:           common.#Email
	country?:         enums.#CountryCode
	category?:        enums.#SupplierCategory
}

#AtpStaffProfileUpdateRequest: {
	languages: [...enums.#LanguageCode]
	destinations?:               [...enums.#CountryCode]
	full_name?:                  string
	position?:                   string
	position_i18n?: [...entities.#AtpStaffLocalizedTextEntry]
	friendly_short_name?: string
	team_order?: int | null
	appears_in_team_web_page?: bool
	qualification?:              string
	qualification_i18n?: [...entities.#AtpStaffLocalizedTextEntry]
	description?:                string
	description_i18n?: [...entities.#AtpStaffLocalizedTextEntry]
	mobile_description?: string
	mobile_description_i18n?: [...entities.#AtpStaffLocalizedTextEntry]
}

#AtpStaffPhotoUploadRequest: #EvidenceUpload

#OfferExchangeRateComponent: {
	id?:                    common.#Identifier
	category:               enums.#OfferCategory
	quantity:               >0 & int
	unit_amount_cents:      common.#NonNegativeMoneyAmount
	tax_rate_basis_points?: >=0 & <=100000 & int
}

#OfferExchangeRatesRequest: {
	from_currency: enums.#CurrencyCode
	to_currency:   enums.#CurrencyCode
	components?: [...#OfferExchangeRateComponent]
}

#BookingActivityCreateRequest: {
	expected_core_revision?: >=0 & int
	type:                    entities.#BookingActivityType
	detail?:                 string
	actor?:                  string
}

#BookingInvoiceUpsertRequest: {
	expected_invoices_revision?: >=0 & int
	invoice_number?:             string
	currency?:                   enums.#CurrencyCode
	issue_date?:                 common.#DateOnly
	due_date?:                   common.#DateOnly
	title?:                      string
	notes?:                      string
	components?: [...entities.#InvoiceComponent]
	due_amount_cents?:  common.#NonNegativeMoneyAmount
	sent_to_recipient?: bool
}

#BookingInvoiceTranslateRequest: {
	expected_invoices_revision?: >=0 & int
	lang:                        enums.#LanguageCode
	actor?:                      string
}

#TourUpsertRequest: {
	id?:    common.#Identifier
	title?: string
	destinations?: [...enums.#CountryCode]
	styles?: [...enums.#TourStyleCode]
	priority?: int
	seasonality_start_month?: enums.#MonthCode
	seasonality_end_month?:   enums.#MonthCode
	short_description?:       string
	highlights?: [...string] | string
	image?: string
}

#TourTranslateFieldsRequest: #TranslationEntriesRequest

#EvidenceUpload: {
	filename:    string & !=""
	mime_type?:  string
	data_base64: string & !=""
}
