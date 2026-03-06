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
        case travelMonth = "travelMonth"
        case travelers = "travelers"
        case duration = "duration"
        case budget = "budget"
        case preferredCurrency = "preferredCurrency"
        case name = "name"
        case email = "email"
        case phone = "phone"
        case language = "language"
        case notes = "notes"
        case pageUrl = "pageUrl"
        case referrer = "referrer"
        case utmSource = "utmSource"
        case utmMedium = "utmMedium"
        case utmCampaign = "utmCampaign"
        case idempotencyKey = "idempotencyKey"
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
    let bookingHash: String?
    let pricing: GeneratedBookingPricing

        private enum CodingKeys: String, CodingKey {
        case bookingHash = "bookingHash"
        case pricing = "pricing"
        }
    }

    struct GeneratedBookingOfferUpdateRequest: Codable, Equatable {
    let bookingHash: String?
    let offer: GeneratedBookingOffer

        private enum CodingKeys: String, CodingKey {
        case bookingHash = "bookingHash"
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

    struct GeneratedCustomerList: Codable, Equatable {
    let items: [GeneratedCustomer]?
    let pagination: GeneratedPagination

        private enum CodingKeys: String, CodingKey {
        case items = "items"
        case pagination = "pagination"
        }
    }

    struct GeneratedCustomerDetail: Codable, Equatable {
    let customer: GeneratedCustomer
    let bookings: [GeneratedBooking]?
    let consents: [GeneratedCustomerConsent]?
    let documents: [GeneratedCustomerDocument]?
    let travelGroups: [GeneratedTravelGroup]?
    let travelGroupMembers: [GeneratedTravelGroupMember]?

        private enum CodingKeys: String, CodingKey {
        case customer = "customer"
        case bookings = "bookings"
        case consents = "consents"
        case documents = "documents"
        case travelGroups = "travelGroups"
        case travelGroupMembers = "travelGroupMembers"
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
    let customerId: String?
    let bookingId: String?
    let lastEventAt: String?
    let latestPreview: String?
    let openUrl: String?

        private enum CodingKeys: String, CodingKey {
        case id = "id"
        case channel = "channel"
        case externalContactId = "externalContactId"
        case customerId = "customerId"
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

    struct GeneratedTourOptions: Codable, Equatable {
    let destinations: [String]?
    let styles: [String]?

        private enum CodingKeys: String, CodingKey {
        case destinations = "destinations"
        case styles = "styles"
        }
    }

