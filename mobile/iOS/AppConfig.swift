import Foundation

typealias ATPCurrencyCode = GeneratedCurrencyCode
typealias ATPCurrencyDefinition = GeneratedCurrencyDefinition
typealias ATPCurrencyCatalog = GeneratedCurrencyCatalog

typealias ATPStaffRole = GeneratedATPStaffRole
typealias ATPStaff = GeneratedATPStaff

typealias BookingStage = GeneratedBookingStage
typealias PaymentStatus = GeneratedPaymentStatus
typealias PricingAdjustmentType = GeneratedPricingAdjustmentType
typealias OfferCategory = GeneratedOfferCategory
typealias SourceAttribution = GeneratedSourceAttribution
typealias BookingPricingAdjustment = GeneratedBookingPricingAdjustment
typealias BookingPayment = GeneratedBookingPayment
typealias BookingPricingSummary = GeneratedBookingPricingSummary
typealias BookingPricing = GeneratedBookingPricing
typealias BookingOfferCategoryRule = GeneratedBookingOfferCategoryRule
typealias BookingOfferItem = GeneratedBookingOfferItem
typealias BookingOfferTotals = GeneratedBookingOfferTotals
typealias BookingOffer = GeneratedBookingOffer
typealias InvoiceLineItem = GeneratedInvoiceLineItem
typealias BookingInvoice = GeneratedBookingInvoice
typealias BookingActivity = GeneratedBookingActivity
typealias Booking = GeneratedBooking

typealias Customer = GeneratedCustomer
typealias Tour = GeneratedTour
typealias TourPriceFrom = GeneratedTourPriceFrom

typealias BookingListResponse = GeneratedBookingList
typealias CustomerListResponse = GeneratedCustomerList
typealias TourListResponse = GeneratedTourList
typealias BookingDetailResponse = GeneratedBookingDetail
typealias BookingUpdateResponse = GeneratedBookingDetail
typealias CustomerDetailResponse = GeneratedCustomerDetail
typealias TourOptionsResponse = GeneratedTourOptions
typealias TourDetailResponse = GeneratedTourDetail
typealias AtpStaffDirectoryEntry = GeneratedAtpStaffDirectoryEntry
typealias AtpStaffMember = GeneratedAtpStaffDirectoryEntry
typealias AtpStaffListResponse = GeneratedAtpStaffListResponse
typealias BookingActivitiesResponse = GeneratedBookingActivitiesResponse
typealias BookingInvoicesResponse = GeneratedBookingInvoicesResponse
typealias MobileBootstrapResponse = GeneratedMobileBootstrap
typealias FeatureFlags = GeneratedFeatureFlags
typealias MobileAppVersionGate = GeneratedMobileAppVersionGate
typealias APIContractVersion = GeneratedAPIContractVersion
typealias Pagination = GeneratedPagination
typealias PaginatedRequest = GeneratedPaginatedRequest
typealias AuthMeResponse = GeneratedAuthMeResponse
typealias PublicBookingCreateRequest = GeneratedPublicBookingCreateRequest
typealias BookingPricingUpdateRequest = GeneratedBookingPricingUpdateRequest
typealias BookingOfferUpdateRequest = GeneratedBookingOfferUpdateRequest
typealias APIErrorResponse = GeneratedErrorResponse

enum MobileAPIRequestFactory {
    static let contractVersion = GeneratedAPIRequestFactory.contractVersion

    static func bootstrapURL(baseURL: URL) -> URL {
        GeneratedAPIRequestFactory.mobileBootstrapURL(baseURL: baseURL)
    }

    static func bookingsURL(baseURL: URL, page: Int, pageSize: Int, sort: String = "created_at_desc") -> URL {
        GeneratedAPIRequestFactory.bookingsURL(
            baseURL: baseURL,
            queryItems: [
                URLQueryItem(name: "page", value: String(page)),
                URLQueryItem(name: "page_size", value: String(pageSize)),
                URLQueryItem(name: "sort", value: sort)
            ]
        )
    }

    static func bookingDetailURL(baseURL: URL, bookingID: String) -> URL {
        GeneratedAPIRequestFactory.bookingDetailURL(baseURL: baseURL, bookingId: bookingID)
    }

    static func bookingActivitiesURL(baseURL: URL, bookingID: String) -> URL {
        GeneratedAPIRequestFactory.bookingActivitiesURL(baseURL: baseURL, bookingId: bookingID)
    }

    static func bookingInvoicesURL(baseURL: URL, bookingID: String) -> URL {
        GeneratedAPIRequestFactory.bookingInvoicesURL(baseURL: baseURL, bookingId: bookingID)
    }

    static func activeAtpStaffURL(baseURL: URL) -> URL {
        GeneratedAPIRequestFactory.staffURL(
            baseURL: baseURL,
            queryItems: [URLQueryItem(name: "active", value: "true")]
        )
    }

    static func bookingStageURL(baseURL: URL, bookingID: String) -> URL {
        GeneratedAPIRequestFactory.bookingStageURL(baseURL: baseURL, bookingId: bookingID)
    }

    static func bookingAssignmentURL(baseURL: URL, bookingID: String) -> URL {
        GeneratedAPIRequestFactory.bookingAssignmentURL(baseURL: baseURL, bookingId: bookingID)
    }

    static func bookingNoteURL(baseURL: URL, bookingID: String) -> URL {
        GeneratedAPIRequestFactory.bookingNoteURL(baseURL: baseURL, bookingId: bookingID)
    }
}

enum AppConfig {
    static let apiBaseURL = URL(string: "https://api-staging.asiatravelplan.com")!
    static let keycloakBaseURL = URL(string: "https://auth-staging.asiatravelplan.com")!
    static let realm = "master"
    static let clientID = "asiatravelplan-ios"
    static let redirectURI = "asiatravelplan://auth/callback"
    static let allowedRoles: Set<ATPStaffRole> = [.atpAdmin, .atpManager, .atpAccountant, .atpStaff]
    static let currentAppVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0"
}
