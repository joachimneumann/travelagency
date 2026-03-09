package ir

import enumModel "travelagency.local/model/enums"

IR: {
	catalogs: {
		languages: [for language in enumModel.LanguageCatalog {{code: language}}]
		months: [for month in enumModel.MonthCatalog {{code: month}}]
		roles: [for role in enumModel.ATPStaffRoleCatalog {{code: role}}]
		stages: [for stage in enumModel.BookingStageCatalog {{code: stage}}]
		bookingPersonRoles: [for role in enumModel.BookingPersonRoleCatalog {{code: role}}]
		paymentStatuses: [for status in enumModel.PaymentStatusCatalog {{code: status}}]
		pricingAdjustmentTypes: [for adjustmentType in enumModel.PricingAdjustmentTypeCatalog {{code: adjustmentType}}]
		offerCategories: [for category in enumModel.OfferCategoryCatalog {{code: category}}]
		countries: [for country in enumModel.CountryCatalog {{code: country}}]
		timezones: [for timezone in enumModel.TimezoneCatalog {{code: timezone}}]
		customerConsentTypes: [for consentType in enumModel.CustomerConsentTypeCatalog {{code: consentType}}]
		customerConsentStatuses: [for consentStatus in enumModel.CustomerConsentStatusCatalog {{code: consentStatus}}]
		customerDocumentTypes: [for documentType in enumModel.CustomerDocumentTypeCatalog {{code: documentType}}]
		bookingActivityTypes: [for activityType in enumModel.BookingActivityTypeCatalog {{code: activityType}}]
		currencies: [
			for currency in enumModel.CurrencyCatalog {
				{
					code:          currency.code
					symbol:        currency.displaySymbol
					decimalPlaces: currency.decimalPlaces
				}
			},
		]
	}
}
