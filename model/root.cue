package model

import (
	apiModel "travelagency.local/model/api"
	commonModel "travelagency.local/model/common"
	entityModel "travelagency.local/model/entities"
	enumModel "travelagency.local/model/enums"
)

#AbstractModel: {
	entities: {
		ATPUser:  entityModel.#ATPUser
		Customer: entityModel.#Customer
		Booking:  entityModel.#Booking
		Tour:     entityModel.#Tour
	}

	common: {
		MoneyAmount: commonModel.#MoneyAmount
		Timestamp:   commonModel.#Timestamp
		Identifier:  commonModel.#Identifier
	}

	enums: {
		CurrencyCode:          enumModel.#CurrencyCode
		CurrencyMeta:          enumModel.#CurrencyMeta
		ATPUserRole:           enumModel.#ATPUserRole
		BookingStage:          enumModel.#BookingStage
		PaymentStatus:         enumModel.#PaymentStatus
		PricingAdjustmentType: enumModel.#PricingAdjustmentType
	}

	api: {
		BookingList:      apiModel.#BookingList
		CustomerList:     apiModel.#CustomerList
		TourList:         apiModel.#TourList
		BookingDetail:    apiModel.#BookingDetail
		CustomerDetail:   apiModel.#CustomerDetail
		TourDetail:       apiModel.#TourDetail
		MobileBootstrap:  apiModel.#MobileBootstrap
		ErrorResponse:    apiModel.#ErrorResponse
		PaginatedRequest: apiModel.#PaginatedRequest
		Endpoints:        apiModel.#Endpoints
	}
}

AbstractModel: #AbstractModel
