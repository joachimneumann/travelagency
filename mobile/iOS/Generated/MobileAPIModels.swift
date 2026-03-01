import Foundation

// Generated from contracts/mobile-api.openapi.yaml. Do not edit by hand.

enum ATPUserRole: String, CaseIterable, Codable, Hashable {
    case admin = "atp_admin"
    case manager = "atp_manager"
    case accountant = "atp_accountant"
    case staff = "atp_staff"
}

enum BookingStage: String, CaseIterable, Codable, Hashable {
    case new = "NEW"
    case qualified = "QUALIFIED"
    case proposal_sent = "PROPOSAL_SENT"
    case negotiation = "NEGOTIATION"
    case invoice_sent = "INVOICE_SENT"
    case payment_received = "PAYMENT_RECEIVED"
    case won = "WON"
    case lost = "LOST"
    case post_trip = "POST_TRIP"
}

struct MobileBootstrapResponse: Decodable {
    struct AppInfo: Decodable {
        let minSupportedVersion: String
        let latestVersion: String
        let forceUpdate: Bool

        private enum CodingKeys: String, CodingKey {
            case minSupportedVersion = "min_supported_version"
            case latestVersion = "latest_version"
            case forceUpdate = "force_update"
        }
    }

    struct APIInfo: Decodable {
        let contractVersion: String

        private enum CodingKeys: String, CodingKey {
            case contractVersion = "contract_version"
        }
    }

    struct Features: Decodable {
        let bookings: Bool
        let customers: Bool
        let tours: Bool
    }

    let app: AppInfo
    let api: APIInfo
    let features: Features
}

struct BookingListResponse: Decodable {
    let items: [Booking]
    let page: Int
    let pageSize: Int
    let total: Int
    let totalPages: Int

    private enum CodingKeys: String, CodingKey {
        case items
        case page
        case pageSize = "page_size"
        case total
        case totalPages = "total_pages"
    }
}

struct BookingDetailResponse: Decodable {
    let booking: Booking
    let customer: Customer?
}

struct BookingUpdateResponse: Decodable {
    let booking: Booking
}

struct BookingActivitiesResponse: Decodable {
    let activities: [BookingActivity]
}

struct BookingActivityCreateResponse: Decodable {
    let activity: BookingActivity
}

struct BookingInvoicesResponse: Decodable {
    let items: [BookingInvoice]
    let total: Int
}

struct StaffListResponse: Decodable {
    let items: [StaffMember]
    let total: Int
}

struct AuthMeResponse: Decodable {
    let authenticated: Bool
    let user: AuthenticatedUser?
}

struct AuthenticatedUser: Decodable, Equatable {
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

struct Booking: Decodable, Identifiable, Equatable {
    let id: String
    var stage: String
    let bookingHash: String?
    let destination: String?
    let style: String?
    let travelMonth: String?
    let travelers: Int?
    let duration: String?
    let budget: String?
    let notes: String?
    let createdAt: String?
    let updatedAt: String?
    let slaDueAt: String?
    let staff: String?
    let staffName: String?
    let customerID: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case stage
        case bookingHash = "booking_hash"
        case destination
        case style
        case travelMonth = "travel_month"
        case travelers
        case duration
        case budget
        case notes
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case slaDueAt = "sla_due_at"
        case staff
        case staffName = "staff_name"
        case ownerID = "owner_id"
        case ownerName = "owner_name"
        case customerID = "customer_id"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        stage = try container.decode(String.self, forKey: .stage)
        bookingHash = try container.decodeIfPresent(String.self, forKey: .bookingHash)
        destination = try container.decodeIfPresent(String.self, forKey: .destination)
        style = try container.decodeIfPresent(String.self, forKey: .style)
        travelMonth = try container.decodeIfPresent(String.self, forKey: .travelMonth)
        travelers = try container.decodeIfPresent(Int.self, forKey: .travelers)
        duration = try container.decodeIfPresent(String.self, forKey: .duration)
        budget = try container.decodeIfPresent(String.self, forKey: .budget)
        notes = try container.decodeIfPresent(String.self, forKey: .notes)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
        slaDueAt = try container.decodeIfPresent(String.self, forKey: .slaDueAt)
        let canonicalStaff = try container.decodeIfPresent(String.self, forKey: .staff)
        let legacyStaff = try container.decodeIfPresent(String.self, forKey: .ownerID)
        staff = canonicalStaff ?? legacyStaff
        let canonicalStaffName = try container.decodeIfPresent(String.self, forKey: .staffName)
        let legacyStaffName = try container.decodeIfPresent(String.self, forKey: .ownerName)
        staffName = canonicalStaffName ?? legacyStaffName
        customerID = try container.decodeIfPresent(String.self, forKey: .customerID)
    }
}

struct Customer: Codable, Equatable {
    let id: String
    let name: String?
    let email: String?
    let phone: String?
    let language: String?
}

struct BookingActivity: Codable, Identifiable, Equatable {
    let id: String
    let bookingID: String
    let type: String
    let detail: String
    let actor: String
    let createdAt: String

    private enum CodingKeys: String, CodingKey {
        case id
        case bookingID = "booking_id"
        case type
        case detail
        case actor
        case createdAt = "created_at"
    }
}

struct BookingInvoice: Codable, Identifiable, Equatable {
    let id: String
    let bookingID: String
    let customerID: String?
    let invoiceNumber: String?
    let version: Int
    let status: String
    let currency: String
    let issueDate: String?
    let dueDate: String?
    let title: String?
    let notes: String?
    let sentToCustomer: Bool
    let sentToCustomerAt: String?
    let totalAmountCents: Int
    let dueAmountCents: Int
    let pdfURL: String?
    let createdAt: String?
    let updatedAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case bookingID = "booking_id"
        case customerID = "customer_id"
        case invoiceNumber = "invoice_number"
        case version
        case status
        case currency
        case issueDate = "issue_date"
        case dueDate = "due_date"
        case title
        case notes
        case sentToCustomer = "sent_to_customer"
        case sentToCustomerAt = "sent_to_customer_at"
        case totalAmountCents = "total_amount_cents"
        case dueAmountCents = "due_amount_cents"
        case pdfURL = "pdf_url"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct StaffMember: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let active: Bool
    let usernames: [String]
    let destinations: [String]
    let languages: [String]
}
