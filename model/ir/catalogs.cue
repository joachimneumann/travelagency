package ir

import enumModel "travelagency.local/model/enums"

IR: {
	catalogs: {
		languages: [for language in enumModel.LanguageCatalog {{code: language}}]
		months: [for month in enumModel.MonthCatalog {{code: month}}]
		roles: [for role in enumModel.ATPStaffRoleCatalog {{code: role}}]
		stages: [for stage in enumModel.BookingStageCatalog {{code: stage}}]
		bookingPersonRoles: [for role in enumModel.BookingPersonRoleCatalog {{code: role}}]
		travelPlanTimingKinds: [for kind in enumModel.TravelPlanTimingKindCatalog {{code: kind}}]
		travelPlanItemKinds: [for kind in enumModel.TravelPlanItemKindCatalog {{code: kind}}]
		travelPlanFinancialCoverageStatuses: [for status in enumModel.TravelPlanFinancialCoverageStatusCatalog {{code: status}}]
		travelPlanOfferCoverageTypes: [for coverageType in enumModel.TravelPlanOfferCoverageTypeCatalog {{code: coverageType}}]
		supplierCategories: [for category in enumModel.SupplierCategoryCatalog {{code: category}}]
		paymentStatuses: [for status in enumModel.PaymentStatusCatalog {{code: status}}]
		pricingAdjustmentTypes: [for adjustmentType in enumModel.PricingAdjustmentTypeCatalog {{code: adjustmentType}}]
		offerCategories: [for category in enumModel.OfferCategoryCatalog {{code: category}}]
		offerPaymentTermKinds: [for kind in enumModel.OfferPaymentTermKindCatalog {{code: kind}}]
		offerPaymentAmountModes: [for mode in enumModel.OfferPaymentAmountModeCatalog {{code: mode}}]
		offerPaymentDueTypes: [for dueType in enumModel.OfferPaymentDueTypeCatalog {{code: dueType}}]
		generatedOfferAcceptanceRouteModes: [for mode in enumModel.GeneratedOfferAcceptanceRouteModeCatalog {{code: mode}}]
		generatedOfferAcceptanceRouteStatuses: [for status in enumModel.GeneratedOfferAcceptanceRouteStatusCatalog {{code: status}}]
		offerAcceptanceMethods: [for method in enumModel.OfferAcceptanceMethodCatalog {{code: method}}]
		offerAcceptanceOtpChannels: [for channel in enumModel.OfferAcceptanceOtpChannelCatalog {{code: channel}}]
		countries: [for country in enumModel.CountryCatalog {{
			code:  country
			label: "\(country) \(enumModel.CountryNameCatalog[country])"
		}}]
		timezones: [for timezone in enumModel.TimezoneCatalog {{code: timezone}}]
		personConsentTypes: [for consentType in enumModel.PersonConsentTypeCatalog {{code: consentType}}]
		personConsentStatuses: [for consentStatus in enumModel.PersonConsentStatusCatalog {{code: consentStatus}}]
		personDocumentTypes: [for documentType in enumModel.PersonDocumentTypeCatalog {{code: documentType}}]
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
