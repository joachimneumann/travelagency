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
typealias BookingPricing = GeneratedBookingPricing
typealias BookingOfferCategoryRule = GeneratedBookingOfferCategoryRule
typealias BookingOfferComponent = GeneratedBookingOfferComponent
typealias BookingOfferTotals = GeneratedBookingOfferTotals
typealias BookingOffer = GeneratedBookingOffer
typealias BookingInvoice = GeneratedBookingInvoice
typealias BookingActivity = GeneratedBookingActivity
typealias Booking = GeneratedBooking
typealias Client = GeneratedClient
typealias ClientType = GeneratedClientType
typealias ClientSummary = GeneratedClientSummary
typealias Customer = GeneratedCustomer
typealias CustomerConsent = GeneratedCustomerConsent
typealias CustomerDocument = GeneratedCustomerDocument
typealias TravelGroup = GeneratedTravelGroup
typealias TravelGroupMember = GeneratedTravelGroupMember

typealias BookingListResponse = GeneratedBookingList
typealias CustomerListResponse = GeneratedCustomerList
typealias BookingDetailResponse = GeneratedBookingDetail
typealias BookingUpdateResponse = GeneratedBookingDetail
typealias CustomerDetailResponse = GeneratedCustomerDetail
typealias CustomerUpdateResponse = GeneratedCustomerUpdateResponse
typealias CustomerPhotoUploadResponse = GeneratedCustomerPhotoUploadResponse
typealias CustomerConsentCreateResponse = GeneratedCustomerConsentCreateResponse
typealias TravelGroupListResponse = GeneratedTravelGroupList
typealias TravelGroupDetailResponse = GeneratedTravelGroupDetail
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
typealias AuthMeResponse = GeneratedAuthMeResponse
typealias PublicBookingCreateRequest = GeneratedPublicBookingCreateRequest
typealias BookingPricingUpdateRequest = GeneratedBookingPricingUpdateRequest
typealias BookingOfferUpdateRequest = GeneratedBookingOfferUpdateRequest
typealias EvidenceUpload = GeneratedEvidenceUpload

struct BookingChatEvent: Codable, Equatable, Identifiable {
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
    let conversationID: String
    let openURL: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case channel
        case direction
        case eventType = "event_type"
        case externalStatus = "external_status"
        case textPreview = "text_preview"
        case senderDisplay = "sender_display"
        case senderContact = "sender_contact"
        case sentAt = "sent_at"
        case receivedAt = "received_at"
        case conversationID = "conversation_id"
        case openURL = "open_url"
        case createdAt = "created_at"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        channel = try container.decodeIfPresent(String.self, forKey: .channel) ?? ""
        direction = try container.decodeIfPresent(String.self, forKey: .direction) ?? ""
        eventType = try container.decodeIfPresent(String.self, forKey: .eventType) ?? "message"
        externalStatus = try container.decodeIfPresent(String.self, forKey: .externalStatus)
        textPreview = try container.decodeIfPresent(String.self, forKey: .textPreview) ?? ""
        senderDisplay = try container.decodeIfPresent(String.self, forKey: .senderDisplay)
        senderContact = try container.decodeIfPresent(String.self, forKey: .senderContact)
        sentAt = try container.decodeIfPresent(String.self, forKey: .sentAt)
        receivedAt = try container.decodeIfPresent(String.self, forKey: .receivedAt)
        conversationID = try container.decodeIfPresent(String.self, forKey: .conversationID) ?? ""
        openURL = try container.decodeIfPresent(String.self, forKey: .openURL)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
    }
}

struct BookingChatConversation: Codable, Equatable, Identifiable {
    let id: String
    let channel: String
    let externalContactID: String?
    let clientID: String?
    let bookingID: String?
    let lastEventAt: String?
    let latestPreview: String?
    let openURL: String?

    enum CodingKeys: String, CodingKey {
        case id
        case channel
        case externalContactID = "external_contact_id"
        case clientID = "client_id"
        case bookingID = "booking_id"
        case lastEventAt = "last_event_at"
        case latestPreview = "latest_preview"
        case openURL = "open_url"
    }
}

struct BookingChatResponse: Codable, Equatable {
    let mode: String?
    let items: [BookingChatEvent]
    let total: Int?
    let conversations: [BookingChatConversation]
    let conversationTotal: Int?

    enum CodingKeys: String, CodingKey {
        case mode
        case items
        case total
        case conversations
        case conversationTotal = "conversation_total"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        mode = try container.decodeIfPresent(String.self, forKey: .mode)
        items = try container.decodeIfPresent([BookingChatEvent].self, forKey: .items) ?? []
        total = try container.decodeIfPresent(Int.self, forKey: .total)
        conversations = try container.decodeIfPresent([BookingChatConversation].self, forKey: .conversations) ?? []
        conversationTotal = try container.decodeIfPresent(Int.self, forKey: .conversationTotal)
    }
}

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

    static func customersURL(baseURL: URL, page: Int, pageSize: Int, search: String? = nil) -> URL {
        var queryItems: [URLQueryItem] = [
            URLQueryItem(name: "page", value: String(page)),
            URLQueryItem(name: "page_size", value: String(pageSize))
        ]
        let trimmedSearch = (search ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedSearch.isEmpty {
            queryItems.append(URLQueryItem(name: "search", value: trimmedSearch))
        }
        return GeneratedAPIRequestFactory.customersURL(
            baseURL: baseURL,
            queryItems: queryItems
        )
    }

    static func travelGroupsURL(baseURL: URL, page: Int, pageSize: Int, search: String? = nil) -> URL {
        var queryItems: [URLQueryItem] = [
            URLQueryItem(name: "page", value: String(page)),
            URLQueryItem(name: "page_size", value: String(pageSize)),
            URLQueryItem(name: "sort", value: "updated_at_desc")
        ]
        let trimmedSearch = (search ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedSearch.isEmpty {
            queryItems.append(URLQueryItem(name: "search", value: trimmedSearch))
        }
        return GeneratedAPIRequestFactory.travelGroupsURL(
            baseURL: baseURL,
            queryItems: queryItems
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
        GeneratedAPIRequestFactory.atpStaffURL(
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

    static func bookingChatURL(baseURL: URL, bookingID: String, limit: Int = 100) -> URL {
        GeneratedAPIRequestFactory.bookingChatURL(
            baseURL: baseURL,
            bookingId: bookingID,
            queryItems: [URLQueryItem(name: "limit", value: String(limit))]
        )
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
