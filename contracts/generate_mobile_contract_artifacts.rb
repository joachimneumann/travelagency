#!/usr/bin/env ruby
require 'json'
require 'fileutils'
require 'psych'

ROOT = File.expand_path('..', __dir__)
OPENAPI_PATH = File.join(ROOT, 'contracts', 'mobile-api.openapi.yaml')
CONTRACT_GENERATED_DIR = File.join(ROOT, 'contracts', 'generated')
IOS_GENERATED_ROOT = File.join(ROOT, 'mobile', 'iOS', 'Generated')
IOS_GENERATED_MODELS_DIR = File.join(IOS_GENERATED_ROOT, 'Models')
IOS_GENERATED_API_DIR = File.join(IOS_GENERATED_ROOT, 'API')
FRONTEND_GENERATED_ROOT = File.join(ROOT, 'assets', 'js', 'generated')
FRONTEND_GENERATED_MODELS_DIR = File.join(FRONTEND_GENERATED_ROOT, 'models')
FRONTEND_GENERATED_API_DIR = File.join(FRONTEND_GENERATED_ROOT, 'api')

spec = Psych.safe_load(File.read(OPENAPI_PATH), aliases: true)
info = spec.fetch('info')
schemas = spec.fetch('components').fetch('schemas')

roles = schemas.fetch('ATPUserRole').fetch('enum')
stages = schemas.fetch('BookingStage').fetch('enum')
bootstrap = schemas.fetch('MobileBootstrapResponse')
pricing_adjustment_types = schemas.fetch('PricingAdjustmentType').fetch('enum')
payment_statuses = schemas.fetch('PaymentStatus').fetch('enum')
currency_schema = schemas.fetch('ATPCurrencyCode')
currency_codes = currency_schema.fetch('enum')
currency_definitions = currency_schema.fetch('x-definitions')

[CONTRACT_GENERATED_DIR, IOS_GENERATED_ROOT, IOS_GENERATED_MODELS_DIR, IOS_GENERATED_API_DIR, FRONTEND_GENERATED_ROOT, FRONTEND_GENERATED_MODELS_DIR, FRONTEND_GENERATED_API_DIR].each do |dir|
  FileUtils.mkdir_p(dir)
end

currencies_meta = currency_codes.map do |code|
  definition = currency_definitions.fetch(code)
  [
    code,
    {
      'code' => code,
      'symbol' => definition.fetch('symbol'),
      'decimal_places' => definition.fetch('decimal_places'),
      'iso_code' => definition.fetch('iso_code')
    }
  ]
end.to_h

paths_meta = {
  'mobile_bootstrap' => '/public/v1/mobile/bootstrap',
  'auth_me' => '/auth/me',
  'public_bookings' => '/public/v1/bookings',
  'public_tours' => '/public/v1/tours',
  'bookings' => '/api/v1/bookings',
  'booking_detail' => '/api/v1/bookings/{bookingId}',
  'booking_stage' => '/api/v1/bookings/{bookingId}/stage',
  'booking_assignment' => '/api/v1/bookings/{bookingId}/owner',
  'booking_note' => '/api/v1/bookings/{bookingId}/notes',
  'booking_pricing' => '/api/v1/bookings/{bookingId}/pricing',
  'booking_activities' => '/api/v1/bookings/{bookingId}/activities',
  'booking_invoices' => '/api/v1/bookings/{bookingId}/invoices',
  'staff' => '/api/v1/staff',
  'customers' => '/api/v1/customers',
  'customer_detail' => '/api/v1/customers/{customerId}',
  'tours' => '/api/v1/tours',
  'tour_detail' => '/api/v1/tours/{tourId}',
  'tour_image' => '/api/v1/tours/{tourId}/image'
}

meta = {
  'contract_version' => info.fetch('version'),
  'roles' => roles,
  'stages' => stages,
  'currencies' => currencies_meta,
  'pricing_adjustment_types' => pricing_adjustment_types,
  'payment_statuses' => payment_statuses,
  'paths' => paths_meta,
  'bootstrap_schema' => bootstrap
}
File.write(File.join(CONTRACT_GENERATED_DIR, 'mobile-api.meta.json'), JSON.pretty_generate(meta) + "\n")

roles_swift = roles.map { |r| "    case #{r.sub('atp_', '')} = \"#{r}\"" }.join("\n")
stages_swift = stages.map { |s| "    case #{s.downcase} = \"#{s}\"" }.join("\n")
adjustment_types_swift = pricing_adjustment_types.map { |t| "    case #{t.downcase} = \"#{t}\"" }.join("\n")
payment_statuses_swift = payment_statuses.map { |s| "    case #{s.downcase} = \"#{s}\"" }.join("\n")
currency_cases_swift = currency_codes.map { |code| "    case #{code.downcase} = \"#{code}\"" }.join("\n")
currency_catalog_entries_swift = currency_codes.map do |code|
  definition = currencies_meta.fetch(code)
  "        .#{code.downcase}: ATPCurrencyDefinition(code: .#{code.downcase}, symbol: #{definition.fetch('symbol').inspect}, decimalPlaces: #{definition.fetch('decimal_places')}, isoCode: #{definition.fetch('iso_code').inspect})"
end.join(",\n")

models_swift = <<~SWIFT
import Foundation

// Generated from contracts/mobile-api.openapi.yaml. Canonical location: mobile/iOS/Generated/Models/MobileAPIModels.swift.
// Compatibility copies may exist at older paths. Do not edit by hand.

enum ATPCurrencyCode: String, CaseIterable, Codable, Hashable {
#{currency_cases_swift}

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self).trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        switch rawValue {
        case "USD":
            self = .usd
        case "EURO", "EUR":
            self = .euro
        case "VND":
            self = .vnd
        case "THB":
            self = .thb
        default:
            self = .usd
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }
}

struct ATPCurrencyDefinition: Codable, Equatable {
    let code: ATPCurrencyCode
    let symbol: String
    let decimalPlaces: Int
    let isoCode: String
}

enum ATPCurrencyCatalog {
    static let definitions: [ATPCurrencyCode: ATPCurrencyDefinition] = [
#{currency_catalog_entries_swift}
    ]

    static func definition(for code: ATPCurrencyCode) -> ATPCurrencyDefinition {
        definitions[code] ?? ATPCurrencyDefinition(code: .usd, symbol: "$", decimalPlaces: 2, isoCode: "USD")
    }
}

enum ATPUserRole: String, CaseIterable, Codable, Hashable {
#{roles_swift}
}

enum BookingStage: String, CaseIterable, Codable, Hashable {
#{stages_swift}
}

enum PricingAdjustmentType: String, CaseIterable, Codable, Hashable {
#{adjustment_types_swift}
}

enum PaymentStatus: String, CaseIterable, Codable, Hashable {
#{payment_statuses_swift}
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
    let unchanged: Bool?
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

struct SourceAttribution: Codable, Equatable {
    let pageURL: String?
    let ipAddress: String?
    let ipCountryGuess: String?
    let utmSource: String?
    let utmMedium: String?
    let utmCampaign: String?
    let referrer: String?

    private enum CodingKeys: String, CodingKey {
        case pageURL = "page_url"
        case ipAddress = "ip_address"
        case ipCountryGuess = "ip_country_guess"
        case utmSource = "utm_source"
        case utmMedium = "utm_medium"
        case utmCampaign = "utm_campaign"
        case referrer
    }
}

struct BookingPricingAdjustment: Codable, Identifiable, Equatable {
    let id: String
    let type: PricingAdjustmentType
    let label: String
    let amountCents: Int
    let notes: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case type
        case label
        case amountCents = "amount_cents"
        case notes
    }
}

struct BookingPayment: Codable, Identifiable, Equatable {
    let id: String
    let label: String
    let dueDate: String?
    let netAmountCents: Int
    let taxRateBasisPoints: Int
    let taxAmountCents: Int
    let grossAmountCents: Int
    let status: PaymentStatus
    let paidAt: String?
    let notes: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case label
        case dueDate = "due_date"
        case netAmountCents = "net_amount_cents"
        case taxRateBasisPoints = "tax_rate_basis_points"
        case taxAmountCents = "tax_amount_cents"
        case grossAmountCents = "gross_amount_cents"
        case status
        case paidAt = "paid_at"
        case notes
    }
}

struct BookingPricingSummary: Codable, Equatable {
    let agreedNetAmountCents: Int
    let adjustmentsDeltaCents: Int
    let adjustedNetAmountCents: Int
    let scheduledNetAmountCents: Int
    let unscheduledNetAmountCents: Int
    let scheduledTaxAmountCents: Int
    let scheduledGrossAmountCents: Int
    let paidGrossAmountCents: Int
    let outstandingGrossAmountCents: Int
    let isScheduleBalanced: Bool

    private enum CodingKeys: String, CodingKey {
        case agreedNetAmountCents = "agreed_net_amount_cents"
        case adjustmentsDeltaCents = "adjustments_delta_cents"
        case adjustedNetAmountCents = "adjusted_net_amount_cents"
        case scheduledNetAmountCents = "scheduled_net_amount_cents"
        case unscheduledNetAmountCents = "unscheduled_net_amount_cents"
        case scheduledTaxAmountCents = "scheduled_tax_amount_cents"
        case scheduledGrossAmountCents = "scheduled_gross_amount_cents"
        case paidGrossAmountCents = "paid_gross_amount_cents"
        case outstandingGrossAmountCents = "outstanding_gross_amount_cents"
        case isScheduleBalanced = "is_schedule_balanced"
    }
}

struct BookingPricing: Codable, Equatable {
    let currency: ATPCurrencyCode
    let agreedNetAmountCents: Int
    let adjustments: [BookingPricingAdjustment]
    let payments: [BookingPayment]
    let summary: BookingPricingSummary

    private enum CodingKeys: String, CodingKey {
        case currency
        case agreedNetAmountCents = "agreed_net_amount_cents"
        case adjustments
        case payments
        case summary
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
    let preferredCurrency: ATPCurrencyCode?
    let notes: String?
    let pricing: BookingPricing?
    let source: SourceAttribution?
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
        case preferredCurrency = "preferred_currency"
        case notes
        case pricing
        case source
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
        preferredCurrency = try container.decodeIfPresent(ATPCurrencyCode.self, forKey: .preferredCurrency)
        notes = try container.decodeIfPresent(String.self, forKey: .notes)
        pricing = try container.decodeIfPresent(BookingPricing.self, forKey: .pricing)
        source = try container.decodeIfPresent(SourceAttribution.self, forKey: .source)
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
    let currency: ATPCurrencyCode
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

// Generated from contracts/mobile-api.openapi.yaml. Canonical location: mobile/iOS/Generated/API/MobileAPIRequestFactory.swift.
// Compatibility copies may exist at older paths. Do not edit by hand.

enum MobileAPIRequestFactory {
    static let contractVersion = #{info.fetch('version').inspect}
    static let bootstrapPath = #{paths_meta.fetch('mobile_bootstrap').inspect}
    static let authMePath = #{paths_meta.fetch('auth_me').inspect}
    static let publicBookingsPath = #{paths_meta.fetch('public_bookings').inspect}
    static let publicToursPath = #{paths_meta.fetch('public_tours').inspect}
    static let bookingsPath = #{paths_meta.fetch('bookings').inspect}
    static let staffPath = #{paths_meta.fetch('staff').inspect}
    static let customersPath = #{paths_meta.fetch('customers').inspect}
    static let toursPath = #{paths_meta.fetch('tours').inspect}

    static func bootstrapURL(baseURL: URL) -> URL {
        baseURL.appendingPathComponent(String(bootstrapPath.dropFirst()))
    }

    static func authMeURL(baseURL: URL) -> URL {
        baseURL.appendingPathComponent(String(authMePath.dropFirst()))
    }

    static func publicBookingsURL(baseURL: URL) -> URL {
        baseURL.appendingPathComponent(String(publicBookingsPath.dropFirst()))
    }

    static func publicToursURL(baseURL: URL) -> URL {
        baseURL.appendingPathComponent(String(publicToursPath.dropFirst()))
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
        baseURL.appendingPathComponent("api/v1/bookings/\(bookingID)")
    }

    static func bookingStageURL(baseURL: URL, bookingID: String) -> URL {
        baseURL.appendingPathComponent("api/v1/bookings/\(bookingID)/stage")
    }

    static func bookingAssignmentURL(baseURL: URL, bookingID: String) -> URL {
        baseURL.appendingPathComponent("api/v1/bookings/\(bookingID)/owner")
    }

    static func bookingNoteURL(baseURL: URL, bookingID: String) -> URL {
        baseURL.appendingPathComponent("api/v1/bookings/\(bookingID)/notes")
    }

    static func bookingPricingURL(baseURL: URL, bookingID: String) -> URL {
        baseURL.appendingPathComponent("api/v1/bookings/\(bookingID)/pricing")
    }

    static func bookingActivitiesURL(baseURL: URL, bookingID: String) -> URL {
        baseURL.appendingPathComponent("api/v1/bookings/\(bookingID)/activities")
    }

    static func bookingInvoicesURL(baseURL: URL, bookingID: String) -> URL {
        baseURL.appendingPathComponent("api/v1/bookings/\(bookingID)/invoices")
    }

    static func activeStaffURL(baseURL: URL) -> URL {
        var components = URLComponents(url: baseURL.appendingPathComponent(String(staffPath.dropFirst())), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "active", value: "true")]
        return components.url!
    }

    static func staffURL(baseURL: URL) -> URL {
        baseURL.appendingPathComponent(String(staffPath.dropFirst()))
    }

    static func customersURL(baseURL: URL) -> URL {
        baseURL.appendingPathComponent(String(customersPath.dropFirst()))
    }

    static func customerDetailURL(baseURL: URL, customerID: String) -> URL {
        baseURL.appendingPathComponent("api/v1/customers/\(customerID)")
    }

    static func toursURL(baseURL: URL) -> URL {
        baseURL.appendingPathComponent(String(toursPath.dropFirst()))
    }

    static func tourDetailURL(baseURL: URL, tourID: String) -> URL {
        baseURL.appendingPathComponent("api/v1/tours/\(tourID)")
    }

    static func tourImageURL(baseURL: URL, tourID: String) -> URL {
        baseURL.appendingPathComponent("api/v1/tours/\(tourID)/image")
    }
}
SWIFT

def js_literal(object)
  JSON.pretty_generate(object)
end

models_js = <<~JS
(function (global) {
  const models = Object.freeze({
    contractVersion: #{info.fetch('version').inspect},
    roles: Object.freeze(#{js_literal(roles)}),
    stages: Object.freeze(#{js_literal(stages)}),
    pricingAdjustmentTypes: Object.freeze(#{js_literal(pricing_adjustment_types)}),
    paymentStatuses: Object.freeze(#{js_literal(payment_statuses)}),
    currencies: Object.freeze(#{js_literal(currencies_meta)}),
    paths: Object.freeze(#{js_literal(paths_meta)}),
    normalizeCurrencyCode(value) {
      const raw = String(value || "USD").trim().toUpperCase();
      if (raw === "EUR") return "EURO";
      return this.currencies[raw] ? raw : "USD";
    },
    currencyDefinition(value) {
      const code = this.normalizeCurrencyCode(value);
      return this.currencies[code] || this.currencies.USD;
    }
  });

  global.ATPGeneratedModels = models;
  global.ATPContract = models;
})(window);
JS

request_factory_js = <<~JS
(function (global) {
  const models = global.ATPGeneratedModels || global.ATPContract;
  const paths = models.paths;

  function normalizeBaseURL(baseURL) {
    return String(baseURL || "").replace(/\/$/, "");
  }

  function buildURL(baseURL, path) {
    return `${normalizeBaseURL(baseURL)}${path}`;
  }

  function applyQuery(baseURL, path, query) {
    const url = new URL(buildURL(baseURL, path), window.location.origin);
    Object.entries(query || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });
    return normalizeBaseURL(baseURL) ? `${url.pathname}${url.search}`.replace(/^/, normalizeBaseURL(baseURL)) : `${url.pathname}${url.search}`;
  }

  function encodeSegment(value) {
    return encodeURIComponent(String(value || ""));
  }

  const requestFactory = Object.freeze({
    contractVersion: models.contractVersion,
    bootstrapURL(baseURL) {
      return buildURL(baseURL, paths.mobile_bootstrap);
    },
    authMeURL(baseURL) {
      return buildURL(baseURL, paths.auth_me);
    },
    publicBookingsURL(baseURL) {
      return buildURL(baseURL, paths.public_bookings);
    },
    publicToursURL(baseURL) {
      return buildURL(baseURL, paths.public_tours);
    },
    bookingsURL(baseURL, options = {}) {
      return applyQuery(baseURL, paths.bookings, {
        page: options.page,
        page_size: options.pageSize,
        sort: options.sort,
        search: options.search,
        stage: options.stage,
        owner_id: options.ownerId
      });
    },
    bookingDetailURL(baseURL, bookingId) {
      return buildURL(baseURL, paths.booking_detail.replace('{bookingId}', encodeSegment(bookingId)));
    },
    bookingStageURL(baseURL, bookingId) {
      return buildURL(baseURL, paths.booking_stage.replace('{bookingId}', encodeSegment(bookingId)));
    },
    bookingAssignmentURL(baseURL, bookingId) {
      return buildURL(baseURL, paths.booking_assignment.replace('{bookingId}', encodeSegment(bookingId)));
    },
    bookingNoteURL(baseURL, bookingId) {
      return buildURL(baseURL, paths.booking_note.replace('{bookingId}', encodeSegment(bookingId)));
    },
    bookingPricingURL(baseURL, bookingId) {
      return buildURL(baseURL, paths.booking_pricing.replace('{bookingId}', encodeSegment(bookingId)));
    },
    bookingActivitiesURL(baseURL, bookingId) {
      return buildURL(baseURL, paths.booking_activities.replace('{bookingId}', encodeSegment(bookingId)));
    },
    bookingInvoicesURL(baseURL, bookingId) {
      return buildURL(baseURL, paths.booking_invoices.replace('{bookingId}', encodeSegment(bookingId)));
    },
    staffURL(baseURL, options = {}) {
      return applyQuery(baseURL, paths.staff, { active: options.active });
    },
    customerDetailURL(baseURL, customerId) {
      return buildURL(baseURL, paths.customer_detail.replace('{customerId}', encodeSegment(customerId)));
    },
    customersURL(baseURL, options = {}) {
      return applyQuery(baseURL, paths.customers, { page: options.page, page_size: options.pageSize, search: options.search });
    },
    toursURL(baseURL, options = {}) {
      return applyQuery(baseURL, paths.tours, { page: options.page, page_size: options.pageSize, search: options.search, destination: options.destination, style: options.style });
    },
    tourDetailURL(baseURL, tourId) {
      return buildURL(baseURL, paths.tour_detail.replace('{tourId}', encodeSegment(tourId)));
    },
    tourImageURL(baseURL, tourId) {
      return buildURL(baseURL, paths.tour_image.replace('{tourId}', encodeSegment(tourId)));
    }
  });

  global.ATPGeneratedRequestFactory = requestFactory;
})(window);
JS

api_js = <<~JS
(function (global) {
  const requestFactory = global.ATPGeneratedRequestFactory;

  function createClient(config = {}) {
    const baseURL = String(config.baseURL || '').replace(/\/$/, '');
    const defaultHeaders = Object.assign({}, config.headers || {});
    const defaultCredentials = config.credentials || 'include';

    async function fetchJSON(url, options = {}) {
      const response = await fetch(url, {
        credentials: options.credentials || defaultCredentials,
        headers: Object.assign({}, defaultHeaders, options.headers || {}),
        method: options.method || 'GET',
        body: options.body
      });
      const text = await response.text();
      let payload = null;
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = text;
        }
      }
      if (!response.ok) {
        const error = new Error(
          payload?.detail || payload?.error_description || payload?.error || `HTTP ${response.status}`
        );
        error.status = response.status;
        error.payload = payload;
        throw error;
      }
      return payload;
    }

    return Object.freeze({
      fetchJSON,
      authMe() {
        return fetchJSON(requestFactory.authMeURL(baseURL));
      },
      listBookings(options = {}) {
        return fetchJSON(requestFactory.bookingsURL(baseURL, options));
      },
      getBooking(bookingId) {
        return fetchJSON(requestFactory.bookingDetailURL(baseURL, bookingId));
      },
      updateBookingStage(bookingId, payload) {
        return fetchJSON(requestFactory.bookingStageURL(baseURL, bookingId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      },
      updateBookingAssignment(bookingId, payload) {
        return fetchJSON(requestFactory.bookingAssignmentURL(baseURL, bookingId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      },
      updateBookingNote(bookingId, payload) {
        return fetchJSON(requestFactory.bookingNoteURL(baseURL, bookingId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      },
      updateBookingPricing(bookingId, payload) {
        return fetchJSON(requestFactory.bookingPricingURL(baseURL, bookingId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      },
      listBookingActivities(bookingId) {
        return fetchJSON(requestFactory.bookingActivitiesURL(baseURL, bookingId));
      },
      listBookingInvoices(bookingId) {
        return fetchJSON(requestFactory.bookingInvoicesURL(baseURL, bookingId));
      },
      listStaff(options = { active: true }) {
        return fetchJSON(requestFactory.staffURL(baseURL, options));
      },
      createStaff(payload) {
        return fetchJSON(requestFactory.staffURL(baseURL), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      },
      listPublicTours() {
        return fetchJSON(requestFactory.publicToursURL(baseURL));
      },
      createPublicBooking(payload) {
        return fetchJSON(requestFactory.publicBookingsURL(baseURL), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
    });
  }

  global.ATPGeneratedAPI = Object.freeze({ createClient });
})(window);
JS

aggregate_js = [models_js, request_factory_js, api_js].join("\n")

def write_file(path, content)
  FileUtils.mkdir_p(File.dirname(path))
  File.write(path, content)
end

write_file(File.join(IOS_GENERATED_MODELS_DIR, 'MobileAPIModels.swift'), models_swift)
write_file(File.join(IOS_GENERATED_API_DIR, 'MobileAPIRequestFactory.swift'), request_factory_swift)
write_file(File.join(IOS_GENERATED_ROOT, 'MobileAPIModels.swift'), models_swift)
write_file(File.join(IOS_GENERATED_ROOT, 'MobileAPIRequestFactory.swift'), request_factory_swift)

write_file(File.join(FRONTEND_GENERATED_MODELS_DIR, 'mobile-api-models.js'), models_js)
write_file(File.join(FRONTEND_GENERATED_API_DIR, 'mobile-api-request-factory.js'), request_factory_js)
write_file(File.join(FRONTEND_GENERATED_API_DIR, 'mobile-api-client.js'), api_js)
write_file(File.join(FRONTEND_GENERATED_ROOT, 'mobile-api-contract.js'), aggregate_js)

puts 'Generated mobile contract artifacts.'
