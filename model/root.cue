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
		BookingInvoicesResponse:     apiModel.#BookingInvoicesResponse
		TourOptions:                 apiModel.#TourOptions
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
		BookingPricingUpdateRequest: apiModel.#BookingPricingUpdateRequest
		BookingOfferUpdateRequest:   apiModel.#BookingOfferUpdateRequest
		Endpoints:                   apiModel.#Endpoints
	}
}

AbstractModel: #AbstractModel
