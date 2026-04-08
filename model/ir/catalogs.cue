package ir

import enumModel "travelagency.local/model/enums"

IR: {
	catalogs: {
		languages: [for language in enumModel.LanguageCatalog {{code: language}}]
		months: [for month in enumModel.MonthCatalog {{code: month}}]
		roles: [for role in enumModel.ATPStaffRoleCatalog {{code: role}}]
		stages: [for stage in enumModel.BookingStageCatalog {{code: stage}}]
		bookingSourceChannels: [for channel in enumModel.BookingSourceChannelCatalog {{code: channel}}]
		bookingReferralKinds: [for kind in enumModel.BookingReferralKindCatalog {{code: kind}}]
		bookingPersonRoles: [for role in enumModel.BookingPersonRoleCatalog {{code: role}}]
		bookingPersonGenders: [for gender in enumModel.BookingPersonGenderCatalog {{code: gender}}]
		travelPlanTimingKinds: [for kind in enumModel.TravelPlanTimingKindCatalog {{code: kind}}]
		travelPlanServiceKinds: [for kind in enumModel.TravelPlanServiceKindCatalog {{code: kind}}]
		supplierCategories: [for category in enumModel.SupplierCategoryCatalog {{code: category}}]
		paymentStatuses: [for status in enumModel.PaymentStatusCatalog {{code: status}}]
		pricingAdjustmentTypes: [for adjustmentType in enumModel.PricingAdjustmentTypeCatalog {{code: adjustmentType}}]
		offerCategories: [for category in enumModel.OfferCategoryCatalog {{code: category}}]
		offerDetailLevels: [for detailLevel in enumModel.OfferDetailLevelCatalog {{code: detailLevel}}]
		offerPaymentTermKinds: [for kind in enumModel.OfferPaymentTermKindCatalog {{code: kind}}]
		offerPaymentAmountModes: [for mode in enumModel.OfferPaymentAmountModeCatalog {{code: mode}}]
		offerPaymentDueTypes: [for dueType in enumModel.OfferPaymentDueTypeCatalog {{code: dueType}}]
		generatedOfferCustomerConfirmationFlowModes: [for mode in enumModel.GeneratedOfferCustomerConfirmationFlowModeCatalog {{code: mode}}]
		generatedOfferCustomerConfirmationFlowStatuses: [for status in enumModel.GeneratedOfferCustomerConfirmationFlowStatusCatalog {{code: status}}]
		bookingConfirmationMethods: [for method in enumModel.BookingConfirmationMethodCatalog {{code: method}}]
		tourStyles: [for style in enumModel.TourStyleCatalog {{
			code:  style
			label: enumModel.TourStyleNameCatalog[style]
		}}]
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
