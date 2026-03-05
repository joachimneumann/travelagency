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
    let consents: [GeneratedCustomerConsent]
    let documents: [GeneratedCustomerDocument]
    let travelGroups: [GeneratedTravelGroup]
    let travelGroupMembers: [GeneratedTravelGroupMember]

        private enum CodingKeys: String, CodingKey {
        case customer = "customer"
        case bookings = "bookings"
        case consents = "consents"
        case documents = "documents"
        case travelGroups = "travel_groups"
        case travelGroupMembers = "travel_group_members"
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

    struct GeneratedAtpStaffListResponse: Codable, Equatable {
    let items: [GeneratedAtpStaffDirectoryEntry]
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
        case eventType = "event_type"
        case externalStatus = "external_status"
        case textPreview = "text_preview"
        case senderDisplay = "sender_display"
        case senderContact = "sender_contact"
        case sentAt = "sent_at"
        case receivedAt = "received_at"
        case conversationId = "conversation_id"
        case openUrl = "open_url"
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
        case externalContactId = "external_contact_id"
        case customerId = "customer_id"
        case bookingId = "booking_id"
        case lastEventAt = "last_event_at"
        case latestPreview = "latest_preview"
        case openUrl = "open_url"
        }
    }

    struct GeneratedBookingChatResponse: Codable, Equatable {
    let mode: String?
    let items: [GeneratedBookingChatEvent]
    let total: Int
    let conversations: [GeneratedBookingChatConversation]
    let conversationTotal: Int

        private enum CodingKeys: String, CodingKey {
        case mode = "mode"
        case items = "items"
        case total = "total"
        case conversations = "conversations"
        case conversationTotal = "conversation_total"
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

    struct GeneratedBookingOfferUpdateRequest: Codable, Equatable {
    let bookingHash: String?
    let offer: GeneratedBookingOffer

        private enum CodingKeys: String, CodingKey {
        case bookingHash = "booking_hash"
        case offer = "offer"
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

