package model

import (
	apiModel "travelagency.local/model/api"
	commonModel "travelagency.local/model/common"
	entityModel "travelagency.local/model/entities"
	enumModel "travelagency.local/model/enums"
)

#AbstractModel: {
	entities: {
		ATPStaff: entityModel.#ATPStaff
		Client: entityModel.#Client
		Customer: entityModel.#Customer
		CustomerConsent: entityModel.#CustomerConsent
		CustomerDocument: entityModel.#CustomerDocument
		Booking:  entityModel.#Booking
		Tour:     entityModel.#Tour
		TravelGroup: entityModel.#TravelGroup
		TravelGroupMember: entityModel.#TravelGroupMember
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
		PaymentStatus:         enumModel.#PaymentStatus
		PricingAdjustmentType: enumModel.#PricingAdjustmentType
		OfferCategory:         enumModel.#OfferCategory
		CountryCode:           enumModel.#CountryCode
		TimezoneCode:          enumModel.#TimezoneCode
		ClientType:            enumModel.#ClientType
		CustomerConsentType:   enumModel.#CustomerConsentType
		CustomerConsentStatus: enumModel.#CustomerConsentStatus
		CustomerDocumentType:  enumModel.#CustomerDocumentType
		TravelGroupType:       enumModel.#TravelGroupType
		TravelGroupMemberRole: enumModel.#TravelGroupMemberRole
		BookingActivityType:   enumModel.#BookingActivityType
	}

	api: {
		BookingList:                 apiModel.#BookingList
		CustomerList:                  apiModel.#CustomerList
		TravelGroupList:             apiModel.#TravelGroupList
		TourList:                    apiModel.#TourList
		BookingDetail:               apiModel.#BookingDetail
		CustomerDetail:                apiModel.#CustomerDetail
		TravelGroupDetail:           apiModel.#TravelGroupDetail
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
		PublicBookingCreateRequest:   apiModel.#PublicBookingCreateRequest
		BookingPricingUpdateRequest:  apiModel.#BookingPricingUpdateRequest
		BookingOfferUpdateRequest:    apiModel.#BookingOfferUpdateRequest
		CustomerUpdateRequest:          apiModel.#CustomerUpdateRequest
		TravelGroupUpdateRequest:     apiModel.#TravelGroupUpdateRequest
		CustomerPhotoUploadRequest:     apiModel.#CustomerPhotoUploadRequest
		CustomerConsentCreateRequest:   apiModel.#CustomerConsentCreateRequest
		CustomerUpdateResponse:         apiModel.#CustomerUpdateResponse
		CustomerPhotoUploadResponse:    apiModel.#CustomerPhotoUploadResponse
		CustomerConsentCreateResponse:  apiModel.#CustomerConsentCreateResponse
		Endpoints:                    apiModel.#Endpoints
	}
}

AbstractModel: #AbstractModel
