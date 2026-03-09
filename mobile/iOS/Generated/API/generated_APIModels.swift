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
    let client: GeneratedClient?
    let customer: GeneratedCustomer?
    let travelGroup: GeneratedTravelGroup?

        private enum CodingKeys: String, CodingKey {
        case booking = "booking"
        case client = "client"
        case customer = "customer"
        case travelGroup = "travelGroup"
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

    struct GeneratedBookingClientUpdateRequest: Codable, Equatable {
    let booking_hash: String?
    let customer_client_id: String?
    let travel_group_id: String?

        private enum CodingKeys: String, CodingKey {
        case booking_hash = "booking_hash"
        case customer_client_id = "customer_client_id"
        case travel_group_id = "travel_group_id"
        }

    }

    struct GeneratedBookingClientUpdateResponse: Codable, Equatable {
    let booking: GeneratedBooking
    let client: GeneratedClient?
    let customer: GeneratedCustomer?
    let travelGroup: GeneratedTravelGroup?
    let members: [GeneratedTravelGroupMember]?
    let memberCustomers: [GeneratedCustomer]?

        private enum CodingKeys: String, CodingKey {
        case booking = "booking"
        case client = "client"
        case customer = "customer"
        case travelGroup = "travelGroup"
        case members = "members"
        case memberCustomers = "memberCustomers"
        }

    }

    struct GeneratedBookingClientCreateCustomerRequest: Codable, Equatable {
    let booking_hash: String?

        private enum CodingKeys: String, CodingKey {
        case booking_hash = "booking_hash"
        }

    }

    struct GeneratedBookingClientCreateGroupRequest: Codable, Equatable {
    let booking_hash: String?
    let group_name: String
    let customer_client_id: String?

        private enum CodingKeys: String, CodingKey {
        case booking_hash = "booking_hash"
        case group_name = "group_name"
        case customer_client_id = "customer_client_id"
        }

    }

    struct GeneratedBookingGroupMemberCreateRequest: Codable, Equatable {
    let booking_hash: String?
    let name: String
    let email: String?
    let phone_number: String?
    let preferred_language: GeneratedLanguageCode?
    let member_roles: [GeneratedTravelGroupMemberRole]?
    let is_traveling: Bool?
    let member_notes: String?

        private enum CodingKeys: String, CodingKey {
        case booking_hash = "booking_hash"
        case name = "name"
        case email = "email"
        case phone_number = "phone_number"
        case preferred_language = "preferred_language"
        case member_roles = "member_roles"
        case is_traveling = "is_traveling"
        case member_notes = "member_notes"
        }

    }

    struct GeneratedBookingGroupMemberCreateResponse: Codable, Equatable {
    let booking: GeneratedBooking
    let client: GeneratedClient?
    let customer: GeneratedCustomer?
    let travelGroup: GeneratedTravelGroup?
    let members: [GeneratedTravelGroupMember]?
    let memberCustomers: [GeneratedCustomer]?

        private enum CodingKeys: String, CodingKey {
        case booking = "booking"
        case client = "client"
        case customer = "customer"
        case travelGroup = "travelGroup"
        case members = "members"
        case memberCustomers = "memberCustomers"
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

    struct GeneratedCustomerList: Codable, Equatable {
    let items: [GeneratedCustomer]?
    let pagination: GeneratedPagination

        private enum CodingKeys: String, CodingKey {
        case items = "items"
        case pagination = "pagination"
        }

    }

    struct GeneratedCustomerDetail: Codable, Equatable {
    let client: GeneratedClient
    let customer: GeneratedCustomer
    let bookings: [GeneratedBooking]?
    let consents: [GeneratedCustomerConsent]?
    let documents: [GeneratedCustomerDocument]?
    let travelGroups: [GeneratedTravelGroup]?
    let travelGroupMembers: [GeneratedTravelGroupMember]?

        private enum CodingKeys: String, CodingKey {
        case client = "client"
        case customer = "customer"
        case bookings = "bookings"
        case consents = "consents"
        case documents = "documents"
        case travelGroups = "travelGroups"
        case travelGroupMembers = "travelGroupMembers"
        }

    }

    struct GeneratedCustomerUpdateRequest: Codable, Equatable {
    let customer_hash: String?
    let name: String?
    let photo_ref: String?
    let title: String?
    let first_name: String?
    let last_name: String?
    let date_of_birth: String?
    let nationality: GeneratedCountryCode?
    let address_line_1: String?
    let address_line_2: String?
    let address_city: String?
    let address_state_region: String?
    let address_postal_code: String?
    let address_country_code: GeneratedCountryCode?
    let organization_name: String?
    let organization_address: String?
    let organization_phone_number: String?
    let organization_webpage: String?
    let organization_email: String?
    let tax_id: String?
    let phone_number: String?
    let email: String?
    let preferred_language: GeneratedLanguageCode?
    let preferred_currency: GeneratedCurrencyCode?
    let timezone: GeneratedTimezoneCode?
    let notes: String?

        private enum CodingKeys: String, CodingKey {
        case customer_hash = "customer_hash"
        case name = "name"
        case photo_ref = "photo_ref"
        case title = "title"
        case first_name = "first_name"
        case last_name = "last_name"
        case date_of_birth = "date_of_birth"
        case nationality = "nationality"
        case address_line_1 = "address_line_1"
        case address_line_2 = "address_line_2"
        case address_city = "address_city"
        case address_state_region = "address_state_region"
        case address_postal_code = "address_postal_code"
        case address_country_code = "address_country_code"
        case organization_name = "organization_name"
        case organization_address = "organization_address"
        case organization_phone_number = "organization_phone_number"
        case organization_webpage = "organization_webpage"
        case organization_email = "organization_email"
        case tax_id = "tax_id"
        case phone_number = "phone_number"
        case email = "email"
        case preferred_language = "preferred_language"
        case preferred_currency = "preferred_currency"
        case timezone = "timezone"
        case notes = "notes"
        }

    }

    struct GeneratedCustomerUpdateResponse: Codable, Equatable {
    let client: GeneratedClient
    let customer: GeneratedCustomer

        private enum CodingKeys: String, CodingKey {
        case client = "client"
        case customer = "customer"
        }

    }

    struct GeneratedCustomerPhotoUploadRequest: Codable, Equatable {
    let customer_hash: String?
    let photo_upload: GeneratedEvidenceUpload?
    let photo: GeneratedEvidenceUpload?

        private enum CodingKeys: String, CodingKey {
        case customer_hash = "customer_hash"
        case photo_upload = "photo_upload"
        case photo = "photo"
        }

    }

    struct GeneratedCustomerPhotoUploadResponse: Codable, Equatable {
    let client: GeneratedClient
    let customer: GeneratedCustomer

        private enum CodingKeys: String, CodingKey {
        case client = "client"
        case customer = "customer"
        }

    }

    struct GeneratedCustomerConsentCreateRequest: Codable, Equatable {
    let customer_hash: String?
    let consent_type: GeneratedCustomerConsentType
    let status: GeneratedCustomerConsentStatus
    let captured_via: String?
    let captured_at: String?
    let evidence_ref: String?
    let evidence_upload: GeneratedEvidenceUpload?

        private enum CodingKeys: String, CodingKey {
        case customer_hash = "customer_hash"
        case consent_type = "consent_type"
        case status = "status"
        case captured_via = "captured_via"
        case captured_at = "captured_at"
        case evidence_ref = "evidence_ref"
        case evidence_upload = "evidence_upload"
        }

    }

    struct GeneratedCustomerConsentCreateResponse: Codable, Equatable {
    let client: GeneratedClient
    let customer: GeneratedCustomer
    let consent: GeneratedCustomerConsent

        private enum CodingKeys: String, CodingKey {
        case client = "client"
        case customer = "customer"
        case consent = "consent"
        }

    }

    struct GeneratedTravelGroupList: Codable, Equatable {
    let items: [GeneratedTravelGroup]?
    let total: Int
    let page: Int
    let page_size: Int
    let total_pages: Int

        private enum CodingKeys: String, CodingKey {
        case items = "items"
        case total = "total"
        case page = "page"
        case page_size = "page_size"
        case total_pages = "total_pages"
        }

    }

    struct GeneratedTravelGroupDetail: Codable, Equatable {
    let client: GeneratedClient
    let travel_group: GeneratedTravelGroup
    let members: [GeneratedTravelGroupMember]?
    let memberCustomers: [GeneratedCustomer]?

        private enum CodingKeys: String, CodingKey {
        case client = "client"
        case travel_group = "travel_group"
        case members = "members"
        case memberCustomers = "memberCustomers"
        }

    }

    struct GeneratedTravelGroupUpdateRequest: Codable, Equatable {
    let travel_group_hash: String?
    let group_name: String?
    let group_contact_customer_id: String?
    let traveler_customer_ids: [String]?
    let number_of_travelers: Int?
    let notes: String?

        private enum CodingKeys: String, CodingKey {
        case travel_group_hash = "travel_group_hash"
        case group_name = "group_name"
        case group_contact_customer_id = "group_contact_customer_id"
        case traveler_customer_ids = "traveler_customer_ids"
        case number_of_travelers = "number_of_travelers"
        case notes = "notes"
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

    struct GeneratedClient: Codable, Equatable, Identifiable {
    let id: String
    let client_type: GeneratedClientType
    let customer_id: String?
    let travel_group_id: String?
    let client_hash: String

        private enum CodingKeys: String, CodingKey {
        case id = "id"
        case client_type = "client_type"
        case customer_id = "customer_id"
        case travel_group_id = "travel_group_id"
        case client_hash = "client_hash"
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

    struct GeneratedEvidenceUpload: Codable, Equatable {
    let filename: String
    let mime_type: String?
    let data_base64: String

        private enum CodingKeys: String, CodingKey {
        case filename = "filename"
        case mime_type = "mime_type"
        case data_base64 = "data_base64"
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

