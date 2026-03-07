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
    let phone_number: String?
    let preferred_language: GeneratedLanguageCode?
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
        case phone_number = "phone_number"
        case preferred_language = "preferred_language"
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

    struct GeneratedCustomerUpdateRequest: Codable, Equatable {
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
    let customer: GeneratedCustomer

        private enum CodingKeys: String, CodingKey {
        case customer = "customer"
        }
    }

    struct GeneratedCustomerPhotoUploadRequest: Codable, Equatable {
    let photo_upload: GeneratedEvidenceUpload?
    let photo: GeneratedEvidenceUpload?

        private enum CodingKeys: String, CodingKey {
        case photo_upload = "photo_upload"
        case photo = "photo"
        }
    }

    struct GeneratedCustomerPhotoUploadResponse: Codable, Equatable {
    let customer: GeneratedCustomer

        private enum CodingKeys: String, CodingKey {
        case customer = "customer"
        }
    }

    struct GeneratedCustomerConsentCreateRequest: Codable, Equatable {
    let consent_type: GeneratedCustomerConsentType
    let status: GeneratedCustomerConsentStatus
    let captured_via: String?
    let captured_at: String?
    let evidence_ref: String?
    let evidence_upload: GeneratedEvidenceUpload?

        private enum CodingKeys: String, CodingKey {
        case consent_type = "consent_type"
        case status = "status"
        case captured_via = "captured_via"
        case captured_at = "captured_at"
        case evidence_ref = "evidence_ref"
        case evidence_upload = "evidence_upload"
        }
    }

    struct GeneratedCustomerConsentCreateResponse: Codable, Equatable {
    let consent: GeneratedCustomerConsent

        private enum CodingKeys: String, CodingKey {
        case consent = "consent"
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

