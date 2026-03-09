import Foundation

// Generated from api/generated/openapi.yaml.
// Do not edit by hand.

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

    struct GeneratedAuthMeResponse: Codable, Equatable {
    let authenticated: Bool
    let principal: GeneratedATPStaff?

        private enum CodingKeys: String, CodingKey {
        case authenticated = "authenticated"
        case principal = "principal"
        }

    }

    struct GeneratedPublicBookingCreateRequest: Codable, Equatable {
    let destinations: [String]?
    let travel_style: [String]?
    let travel_month: String?
    let number_of_travelers: Int?
    let preferred_currency: GeneratedCurrencyCode
    let travel_duration_days_min: Int?
    let travel_duration_days_max: Int?
    let name: String
    let email: String?
    let phone_number: String?
    let budget_lower_USD: Int?
    let budget_upper_USD: Int?
    let preferred_language: GeneratedLanguageCode
    let notes: String?
    let pageUrl: String?
    let referrer: String?
    let utm_source: String?
    let utm_medium: String?
    let utm_campaign: String?
    let idempotencyKey: String?
    let tourId: String?
    let tourTitle: String?

        private enum CodingKeys: String, CodingKey {
        case destinations = "destinations"
        case travel_style = "travel_style"
        case travel_month = "travel_month"
        case number_of_travelers = "number_of_travelers"
        case preferred_currency = "preferred_currency"
        case travel_duration_days_min = "travel_duration_days_min"
        case travel_duration_days_max = "travel_duration_days_max"
        case name = "name"
        case email = "email"
        case phone_number = "phone_number"
        case budget_lower_USD = "budget_lower_USD"
        case budget_upper_USD = "budget_upper_USD"
        case preferred_language = "preferred_language"
        case notes = "notes"
        case pageUrl = "pageUrl"
        case referrer = "referrer"
        case utm_source = "utm_source"
        case utm_medium = "utm_medium"
        case utm_campaign = "utm_campaign"
        case idempotencyKey = "idempotencyKey"
        case tourId = "tourId"
        case tourTitle = "tourTitle"
        }

    }

    struct GeneratedBookingDetail: Codable, Equatable {
    let booking: GeneratedBooking

        private enum CodingKeys: String, CodingKey {
        case booking = "booking"
        }

    }

    struct GeneratedTourList: Codable, Equatable {
    let items: [GeneratedTour]?
    let pagination: GeneratedPagination

        private enum CodingKeys: String, CodingKey {
        case items = "items"
        case pagination = "pagination"
        }

    }

    struct GeneratedBookingList: Codable, Equatable {
    let items: [GeneratedBooking]?
    let pagination: GeneratedPagination

        private enum CodingKeys: String, CodingKey {
        case items = "items"
        case pagination = "pagination"
        }

    }

    struct GeneratedBookingChatResponse: Codable, Equatable {
    let mode: String?
    let items: [GeneratedBookingChatEvent]?
    let total: Int
    let conversations: [GeneratedBookingChatConversation]?
    let conversationTotal: Int

        private enum CodingKeys: String, CodingKey {
        case mode = "mode"
        case items = "items"
        case total = "total"
        case conversations = "conversations"
        case conversationTotal = "conversationTotal"
        }

    }

    struct GeneratedBookingPricingUpdateRequest: Codable, Equatable {
    let booking_hash: String?
    let pricing: GeneratedBookingPricing

        private enum CodingKeys: String, CodingKey {
        case booking_hash = "booking_hash"
        case pricing = "pricing"
        }

    }

    struct GeneratedBookingOfferUpdateRequest: Codable, Equatable {
    let booking_hash: String?
    let offer: GeneratedBookingOffer

        private enum CodingKeys: String, CodingKey {
        case booking_hash = "booking_hash"
        case offer = "offer"
        }

    }

    struct GeneratedBookingActivitiesResponse: Codable, Equatable {
    let items: [GeneratedBookingActivity]?
    let activities: [GeneratedBookingActivity]?
    let total: Int

        private enum CodingKeys: String, CodingKey {
        case items = "items"
        case activities = "activities"
        case total = "total"
        }

    }

    struct GeneratedBookingInvoicesResponse: Codable, Equatable {
    let items: [GeneratedBookingInvoice]?
    let total: Int

        private enum CodingKeys: String, CodingKey {
        case items = "items"
        case total = "total"
        }

    }

    struct GeneratedAtpStaffListResponse: Codable, Equatable {
    let items: [GeneratedAtpStaffDirectoryEntry]?
    let total: Int

        private enum CodingKeys: String, CodingKey {
        case items = "items"
        case total = "total"
        }

    }

    struct GeneratedMobileAppVersionGate: Codable, Equatable {
    let minSupportedVersion: String
    let latestVersion: String
    let forceUpdate: Bool

        private enum CodingKeys: String, CodingKey {
        case minSupportedVersion = "minSupportedVersion"
        case latestVersion = "latestVersion"
        case forceUpdate = "forceUpdate"
        }

    }

    struct GeneratedAPIContractVersion: Codable, Equatable {
    let contractVersion: String

        private enum CodingKeys: String, CodingKey {
        case contractVersion = "contractVersion"
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

    struct GeneratedPagination: Codable, Equatable {
    let page: Int
    let pageSize: Int
    let totalItems: Int

        private enum CodingKeys: String, CodingKey {
        case page = "page"
        case pageSize = "pageSize"
        case totalItems = "totalItems"
        }

    }

    struct GeneratedBookingChatEvent: Codable, Equatable, Identifiable {
    let id: String
    let channel: String
    let direction: String
    let eventType: String
    let externalStatus: String?
    let textPreview: String
    let senderDisplay: String?
    let senderContact: String?
    let sentAt: String?
    let receivedAt: String?
    let conversationId: String
    let openUrl: String?

        private enum CodingKeys: String, CodingKey {
        case id = "id"
        case channel = "channel"
        case direction = "direction"
        case eventType = "eventType"
        case externalStatus = "externalStatus"
        case textPreview = "textPreview"
        case senderDisplay = "senderDisplay"
        case senderContact = "senderContact"
        case sentAt = "sentAt"
        case receivedAt = "receivedAt"
        case conversationId = "conversationId"
        case openUrl = "openUrl"
        }

    }

    struct GeneratedBookingChatConversation: Codable, Equatable, Identifiable {
    let id: String
    let channel: String
    let externalContactId: String?
    let clientId: String?
    let bookingId: String?
    let lastEventAt: String?
    let latestPreview: String?
    let openUrl: String?

        private enum CodingKeys: String, CodingKey {
        case id = "id"
        case channel = "channel"
        case externalContactId = "externalContactId"
        case clientId = "clientId"
        case bookingId = "bookingId"
        case lastEventAt = "lastEventAt"
        case latestPreview = "latestPreview"
        case openUrl = "openUrl"
        }

    }

    struct GeneratedAtpStaffDirectoryEntry: Codable, Equatable, Identifiable {
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

    struct GeneratedBookingPerson: Codable, Equatable, Identifiable {
    let id: String
    let name: String
    let emails: [String]?
    let phone_numbers: [String]?
    let preferred_language: GeneratedLanguageCode?
    let date_of_birth: String?
    let nationality: GeneratedCountryCode?
    let notes: String?
    let is_lead_contact: Bool?
    let is_traveling: Bool?

        private enum CodingKeys: String, CodingKey {
        case id = "id"
        case name = "name"
        case emails = "emails"
        case phone_numbers = "phone_numbers"
        case preferred_language = "preferred_language"
        case date_of_birth = "date_of_birth"
        case nationality = "nationality"
        case notes = "notes"
        case is_lead_contact = "is_lead_contact"
        case is_traveling = "is_traveling"
        }

    }

    struct GeneratedBookingWebFormSubmission: Codable, Equatable {
    let destinations: [String]?
    let travel_style: [String]?
    let travel_month: String?
    let number_of_travelers: Int?
    let preferred_currency: GeneratedCurrencyCode?
    let travel_duration_days_min: Int?
    let travel_duration_days_max: Int?
    let name: String?
    let email: String?
    let phone_number: String?
    let budget_lower_USD: Int?
    let budget_upper_USD: Int?
    let preferred_language: GeneratedLanguageCode?
    let notes: String?
    let submittedAt: String?

        private enum CodingKeys: String, CodingKey {
        case destinations = "destinations"
        case travel_style = "travel_style"
        case travel_month = "travel_month"
        case number_of_travelers = "number_of_travelers"
        case preferred_currency = "preferred_currency"
        case travel_duration_days_min = "travel_duration_days_min"
        case travel_duration_days_max = "travel_duration_days_max"
        case name = "name"
        case email = "email"
        case phone_number = "phone_number"
        case budget_lower_USD = "budget_lower_USD"
        case budget_upper_USD = "budget_upper_USD"
        case preferred_language = "preferred_language"
        case notes = "notes"
        case submittedAt = "submittedAt"
        }

    }

