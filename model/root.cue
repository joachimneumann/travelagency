package model

import (
	apiModel "travelagency.local/model/api"
	commonModel "travelagency.local/model/common"
	entityModel "travelagency.local/model/entities"
	enumModel "travelagency.local/model/enums"
)

#AbstractModel: {
	entities: {
		ATPStaff:              entityModel.#ATPStaff
		Booking:               entityModel.#Booking
		BookingPerson:         entityModel.#BookingPerson
		BookingPersonAddress:  entityModel.#BookingPersonAddress
		BookingPersonConsent:  entityModel.#BookingPersonConsent
		BookingPersonDocument: entityModel.#BookingPersonDocument
		Tour:                  entityModel.#Tour
	}

	common: {
		MoneyAmount: commonModel.#MoneyAmount
		Timestamp:   commonModel.#Timestamp
		Identifier:  commonModel.#Identifier
	}

	enums: {
		LanguageCode:          enumModel.#LanguageCode
		CurrencyCode:          enumModel.#CurrencyCode
		CurrencyMeta:          enumModel.#CurrencyMeta
		ATPStaffRole:          enumModel.#ATPStaffRole
		BookingStage:          enumModel.#BookingStage
		BookingPersonRole:     enumModel.#BookingPersonRole
		PaymentStatus:         enumModel.#PaymentStatus
		PricingAdjustmentType: enumModel.#PricingAdjustmentType
		OfferCategory:         enumModel.#OfferCategory
		CountryCode:           enumModel.#CountryCode
		TimezoneCode:          enumModel.#TimezoneCode
		PersonConsentType:     enumModel.#PersonConsentType
		PersonConsentStatus:   enumModel.#PersonConsentStatus
		PersonDocumentType:    enumModel.#PersonDocumentType
		BookingActivityType:   enumModel.#BookingActivityType
	}

	api: {
		BookingList:                 apiModel.#BookingList
		TourList:                    apiModel.#TourList
		BookingDetail:               apiModel.#BookingDetail
		TourDetail:                  apiModel.#TourDetail
		AtpStaffDirectoryEntry:      apiModel.#AtpStaffDirectoryEntry
		AtpStaffListResponse:        apiModel.#AtpStaffListResponse
		BookingActivitiesResponse:   apiModel.#BookingActivitiesResponse
		BookingActivityResponse:     apiModel.#BookingActivityResponse
		BookingDeleteResponse:       apiModel.#BookingDeleteResponse
		BookingInvoicesResponse:     apiModel.#BookingInvoicesResponse
		BookingInvoiceResponse:      apiModel.#BookingInvoiceResponse
		BookingChatEvent:            apiModel.#BookingChatEvent
		BookingChatConversation:     apiModel.#BookingChatConversation
		BookingChatResponse:         apiModel.#BookingChatResponse
		TourOptions:                 apiModel.#TourOptions
		TourResponse:                apiModel.#TourResponse
		OfferExchangeRatesResponse:  apiModel.#OfferExchangeRatesResponse
		BookingListFilters:          apiModel.#BookingListFilters
		TourListFilters:             apiModel.#TourListFilters
		AuthenticatedUser:           apiModel.#AuthenticatedUser
		AuthMeResponse:              apiModel.#AuthMeResponse
		MobileBootstrap:             apiModel.#MobileBootstrap
		FeatureFlags:                apiModel.#FeatureFlags
		MobileAppVersionGate:        apiModel.#MobileAppVersionGate
		APIContractVersion:          apiModel.#APIContractVersion
		Pagination:                  apiModel.#Pagination
		ErrorResponse:               apiModel.#ErrorResponse
		PaginatedRequest:            apiModel.#PaginatedRequest
		WebsiteBookingForm:          apiModel.#WebsiteBookingForm
		PublicBookingCreateRequest:  apiModel.#PublicBookingCreateRequest
		BookingDeleteRequest:        apiModel.#BookingDeleteRequest
		BookingNameUpdateRequest:    apiModel.#BookingNameUpdateRequest
		BookingStageUpdateRequest:   apiModel.#BookingStageUpdateRequest
		BookingOwnerUpdateRequest:   apiModel.#BookingOwnerUpdateRequest
		BookingPersonsUpdateRequest: apiModel.#BookingPersonsUpdateRequest
		BookingNotesUpdateRequest:   apiModel.#BookingNotesUpdateRequest
		BookingPricingUpdateRequest: apiModel.#BookingPricingUpdateRequest
		BookingOfferUpdateRequest:   apiModel.#BookingOfferUpdateRequest
		OfferExchangeRateComponent:  apiModel.#OfferExchangeRateComponent
		OfferExchangeRatesRequest:   apiModel.#OfferExchangeRatesRequest
		BookingActivityCreateRequest: apiModel.#BookingActivityCreateRequest
		BookingInvoiceUpsertRequest: apiModel.#BookingInvoiceUpsertRequest
		AtpStaffCreateRequest:       apiModel.#AtpStaffCreateRequest
		AtpStaffResponse:            apiModel.#AtpStaffResponse
		TourUpsertRequest:           apiModel.#TourUpsertRequest
		EvidenceUpload:              apiModel.#EvidenceUpload
		Endpoints:                   apiModel.#Endpoints
	}
}

AbstractModel: #AbstractModel
