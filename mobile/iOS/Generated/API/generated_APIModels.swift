import Foundation

// Generated from the normalized model IR exported from model/ir.
// Do not edit by hand.

    struct GeneratedBookingList: Codable, Equatable {
    let items: [GeneratedBooking]
    let pagination: GeneratedPagination

        private enum CodingKeys: String, CodingKey {
        case items = "items"
        case pagination = "pagination"
        }
    }

    struct GeneratedCustomerList: Codable, Equatable {
    let items: [GeneratedCustomer]
    let pagination: GeneratedPagination

        private enum CodingKeys: String, CodingKey {
        case items = "items"
        case pagination = "pagination"
        }
    }

    struct GeneratedTourList: Codable, Equatable {
    let items: [GeneratedTour]
    let pagination: GeneratedPagination

        private enum CodingKeys: String, CodingKey {
        case items = "items"
        case pagination = "pagination"
        }
    }

    struct GeneratedBookingDetail: Codable, Equatable {
    let booking: GeneratedBooking
    let customer: GeneratedCustomer?

        private enum CodingKeys: String, CodingKey {
        case booking = "booking"
        case customer = "customer"
        }
    }

    struct GeneratedCustomerDetail: Codable, Equatable {
    let customer: GeneratedCustomer
    let bookings: [GeneratedBooking]

        private enum CodingKeys: String, CodingKey {
        case customer = "customer"
        case bookings = "bookings"
        }
    }

    struct GeneratedTourOptions: Codable, Equatable {
    let destinations: [String]?
    let styles: [String]?

        private enum CodingKeys: String, CodingKey {
        case destinations = "destinations"
        case styles = "styles"
        }
    }

    struct GeneratedTourDetail: Codable, Equatable {
    let tour: GeneratedTour
    let options: GeneratedTourOptions

        private enum CodingKeys: String, CodingKey {
        case tour = "tour"
        case options = "options"
        }
    }

    struct GeneratedStaffDirectoryEntry: Codable, Equatable, Identifiable {
    let id: String
    let name: String
    let active: Bool?
    let usernames: [String]?
    let destinations: [String]?
    let languages: [String]?

        private enum CodingKeys: String, CodingKey {
        case id = "id"
        case name = "name"
        case active = "active"
        case usernames = "usernames"
        case destinations = "destinations"
        case languages = "languages"
        }
    }

    struct GeneratedStaffListResponse: Codable, Equatable {
    let items: [GeneratedStaffDirectoryEntry]
    let total: Int

        private enum CodingKeys: String, CodingKey {
        case items = "items"
        case total = "total"
        }
    }

    struct GeneratedBookingActivitiesResponse: Codable, Equatable {
    let items: [GeneratedBookingActivity]
    let activities: [GeneratedBookingActivity]
    let total: Int

        private enum CodingKeys: String, CodingKey {
        case items = "items"
        case activities = "activities"
        case total = "total"
        }
    }

    struct GeneratedBookingInvoicesResponse: Codable, Equatable {
    let items: [GeneratedBookingInvoice]
    let total: Int

        private enum CodingKeys: String, CodingKey {
        case items = "items"
        case total = "total"
        }
    }

    struct GeneratedMobileBootstrap: Codable, Equatable {
    let app: GeneratedMobileAppVersionGate
    let api: GeneratedAPIContractVersion
    let features: GeneratedFeatureFlags

        private enum CodingKeys: String, CodingKey {
        case app = "app"
        case api = "api"
        case features = "features"
        }
    }

    struct GeneratedFeatureFlags: Codable, Equatable {
    let bookings: Bool
    let customers: Bool
    let tours: Bool

        private enum CodingKeys: String, CodingKey {
        case bookings = "bookings"
        case customers = "customers"
        case tours = "tours"
        }
    }

    struct GeneratedMobileAppVersionGate: Codable, Equatable {
    let minSupportedVersion: String
    let latestVersion: String
    let forceUpdate: Bool

        private enum CodingKeys: String, CodingKey {
        case minSupportedVersion = "min_supported_version"
        case latestVersion = "latest_version"
        case forceUpdate = "force_update"
        }
    }

    struct GeneratedAPIContractVersion: Codable, Equatable {
    let contractVersion: String

        private enum CodingKeys: String, CodingKey {
        case contractVersion = "contract_version"
        }
    }

    struct GeneratedPagination: Codable, Equatable {
    let page: Int
    let pageSize: Int
    let totalItems: Int

        private enum CodingKeys: String, CodingKey {
        case page = "page"
        case pageSize = "page_size"
        case totalItems = "total_items"
        }
    }

    struct GeneratedPaginatedRequest: Codable, Equatable {
    let page: Int?
    let pageSize: Int?
    let sort: String?
    let query: String?

        private enum CodingKeys: String, CodingKey {
        case page = "page"
        case pageSize = "page_size"
        case sort = "sort"
        case query = "query"
        }
    }

    struct GeneratedAuthMeResponse: Codable, Equatable {
    let authenticated: Bool
    let principal: GeneratedATPUser?

        private enum CodingKeys: String, CodingKey {
        case authenticated = "authenticated"
        case principal = "principal"
        }
    }

    struct GeneratedPublicBookingCreateRequest: Codable, Equatable {
    let destination: String?
    let style: String?
    let travelMonth: String?
    let travelers: Int?
    let duration: String?
    let budget: String?
    let preferredCurrency: GeneratedCurrencyCode?
    let name: String?
    let email: String?
    let phone: String?
    let language: String?
    let notes: String?
    let pageUrl: String?
    let referrer: String?
    let utmSource: String?
    let utmMedium: String?
    let utmCampaign: String?
    let idempotencyKey: String?

        private enum CodingKeys: String, CodingKey {
        case destination = "destination"
        case style = "style"
        case travelMonth = "travel_month"
        case travelers = "travelers"
        case duration = "duration"
        case budget = "budget"
        case preferredCurrency = "preferred_currency"
        case name = "name"
        case email = "email"
        case phone = "phone"
        case language = "language"
        case notes = "notes"
        case pageUrl = "page_url"
        case referrer = "referrer"
        case utmSource = "utm_source"
        case utmMedium = "utm_medium"
        case utmCampaign = "utm_campaign"
        case idempotencyKey = "idempotency_key"
        }
    }

    struct GeneratedBookingPricingUpdateRequest: Codable, Equatable {
    let bookingHash: String?
    let pricing: GeneratedBookingPricing

        private enum CodingKeys: String, CodingKey {
        case bookingHash = "booking_hash"
        case pricing = "pricing"
        }
    }

    struct GeneratedErrorResponse: Codable, Equatable {
    let error: String
    let detail: String?
    let code: String?

        private enum CodingKeys: String, CodingKey {
        case error = "error"
        case detail = "detail"
        case code = "code"
        }
    }

struct AuthenticatedUser: Codable, Equatable {
    let sub: String
    let preferredUsername: String?
    let email: String?
    let roles: Set<ATPUserRole>

    private enum CodingKeys: String, CodingKey {
        case sub
        case preferredUsername = "preferred_username"
        case email
        case roles
    }
}

struct BookingUpdateResponse: Codable, Equatable {
    let booking: Booking
    let unchanged: Bool?
}

typealias MobileBootstrapResponse = GeneratedMobileBootstrap
typealias BookingListResponse = GeneratedBookingList
typealias CustomerListResponse = GeneratedCustomerList
typealias TourListResponse = GeneratedTourList
typealias BookingDetailResponse = GeneratedBookingDetail
typealias CustomerDetailResponse = GeneratedCustomerDetail
typealias TourDetailResponse = GeneratedTourDetail
typealias TourOptions = GeneratedTourOptions
typealias StaffDirectoryEntry = GeneratedStaffDirectoryEntry
typealias StaffMember = GeneratedStaffDirectoryEntry
typealias StaffListResponse = GeneratedStaffListResponse
typealias BookingActivitiesResponse = GeneratedBookingActivitiesResponse
typealias BookingInvoicesResponse = GeneratedBookingInvoicesResponse
typealias FeatureFlags = GeneratedFeatureFlags
typealias MobileAppVersionGate = GeneratedMobileAppVersionGate
typealias APIContractVersion = GeneratedAPIContractVersion
typealias Pagination = GeneratedPagination
typealias PaginatedRequest = GeneratedPaginatedRequest
typealias AuthMeResponse = GeneratedAuthMeResponse
typealias PublicBookingCreateRequest = GeneratedPublicBookingCreateRequest
typealias BookingPricingUpdateRequest = GeneratedBookingPricingUpdateRequest
typealias ErrorResponse = GeneratedErrorResponse
