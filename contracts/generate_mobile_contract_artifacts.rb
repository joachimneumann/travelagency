#!/usr/bin/env ruby
require 'json'
require 'fileutils'
require 'psych'

ROOT = File.expand_path('..', __dir__)
OPENAPI_PATH = File.join(ROOT, 'contracts', 'mobile-api.openapi.yaml')
GENERATED_DIR = File.join(ROOT, 'contracts', 'generated')
IOS_GENERATED_DIR = File.join(ROOT, 'mobile', 'iOS', 'Generated')

spec = Psych.safe_load(File.read(OPENAPI_PATH), aliases: true)
info = spec.fetch('info')
schemas = spec.fetch('components').fetch('schemas')
paths = spec.fetch('paths')

roles = schemas.fetch('ATPUserRole').fetch('enum')
stages = schemas.fetch('BookingStage').fetch('enum')
bootstrap = schemas.fetch('MobileBootstrapResponse')

FileUtils.mkdir_p(GENERATED_DIR)
FileUtils.mkdir_p(IOS_GENERATED_DIR)

meta = {
  'contract_version' => info.fetch('version'),
  'roles' => roles,
  'stages' => stages,
  'paths' => {
    'mobile_bootstrap' => '/public/v1/mobile/bootstrap',
    'auth_me' => '/auth/me',
    'bookings' => '/api/v1/bookings',
    'booking_detail' => '/api/v1/bookings/{bookingId}',
    'booking_stage' => '/api/v1/bookings/{bookingId}/stage',
    'booking_assignment' => '/api/v1/bookings/{bookingId}/owner',
    'booking_activities' => '/api/v1/bookings/{bookingId}/activities',
    'booking_invoices' => '/api/v1/bookings/{bookingId}/invoices',
    'staff' => '/api/v1/staff'
  },
  'bootstrap_schema' => bootstrap
}
File.write(File.join(GENERATED_DIR, 'mobile-api.meta.json'), JSON.pretty_generate(meta) + "\n")

roles_swift = roles.map { |r| "    case #{r.sub('atp_', '')} = \"#{r}\"" }.join("\n")
stages_swift = stages.map { |s| "    case #{s.downcase} = \"#{s}\"" }.join("\n")

models_swift = <<~SWIFT
import Foundation

// Generated from contracts/mobile-api.openapi.yaml. Do not edit by hand.

enum ATPUserRole: String, CaseIterable, Codable, Hashable {
#{roles_swift}
}

enum BookingStage: String, CaseIterable, Codable, Hashable {
#{stages_swift}
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
SWIFT

request_factory_swift = <<~SWIFT
import Foundation

// Generated from contracts/mobile-api.openapi.yaml. Do not edit by hand.

enum MobileAPIRequestFactory {
    static let contractVersion = #{info.fetch('version').inspect}
    static let bootstrapPath = "/public/v1/mobile/bootstrap"
    static let authMePath = "/auth/me"
    static let bookingsPath = "/api/v1/bookings"
    static let staffPath = "/api/v1/staff"

    static func bootstrapURL(baseURL: URL) -> URL {
        baseURL.appendingPathComponent(String(bootstrapPath.dropFirst()))
    }

    static func bookingsURL(baseURL: URL, page: Int, pageSize: Int) -> URL {
        var components = URLComponents(url: baseURL.appendingPathComponent(String(bookingsPath.dropFirst())), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "page", value: String(page)),
            URLQueryItem(name: "page_size", value: String(pageSize)),
            URLQueryItem(name: "sort", value: "created_at_desc")
        ]
        return components.url!
    }

    static func bookingDetailURL(baseURL: URL, bookingID: String) -> URL {
        baseURL.appendingPathComponent("api/v1/bookings/\\(bookingID)")
    }

    static func bookingStageURL(baseURL: URL, bookingID: String) -> URL {
        baseURL.appendingPathComponent("api/v1/bookings/\\(bookingID)/stage")
    }

    static func bookingAssignmentURL(baseURL: URL, bookingID: String) -> URL {
        baseURL.appendingPathComponent("api/v1/bookings/\\(bookingID)/owner")
    }

    static func bookingActivitiesURL(baseURL: URL, bookingID: String) -> URL {
        baseURL.appendingPathComponent("api/v1/bookings/\\(bookingID)/activities")
    }

    static func bookingInvoicesURL(baseURL: URL, bookingID: String) -> URL {
        baseURL.appendingPathComponent("api/v1/bookings/\\(bookingID)/invoices")
    }

    static func activeStaffURL(baseURL: URL) -> URL {
        var components = URLComponents(url: baseURL.appendingPathComponent(String(staffPath.dropFirst())), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "active", value: "true")]
        return components.url!
    }
}
SWIFT

File.write(File.join(IOS_GENERATED_DIR, 'MobileAPIModels.swift'), models_swift)
File.write(File.join(IOS_GENERATED_DIR, 'MobileAPIRequestFactory.swift'), request_factory_swift)
puts 'Generated mobile contract artifacts.'
