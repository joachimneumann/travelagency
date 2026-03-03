#!/usr/bin/env ruby
# frozen_string_literal: true

require 'json'
require 'yaml'
require 'fileutils'
require 'open3'
require 'time'

ROOT = File.expand_path('../..', __dir__)
MODEL_DIR = File.join(ROOT, 'model')
CONTRACT_GENERATED_DIR = File.join(ROOT, 'api', 'generated')

BACKEND_GENERATED_MODELS_DIR = File.join(ROOT, 'backend', 'app', 'Generated', 'Models')
BACKEND_GENERATED_API_DIR = File.join(ROOT, 'backend', 'app', 'Generated', 'API')
FRONTEND_GENERATED_MODELS_DIR = File.join(ROOT, 'frontend', 'Generated', 'Models')
FRONTEND_GENERATED_API_DIR = File.join(ROOT, 'frontend', 'Generated', 'API')
IOS_GENERATED_MODELS_DIR = File.join(ROOT, 'mobile', 'iOS', 'Generated', 'Models')
IOS_GENERATED_API_DIR = File.join(ROOT, 'mobile', 'iOS', 'Generated', 'API')

OUTPUT_DIRS = [
  CONTRACT_GENERATED_DIR,
  BACKEND_GENERATED_MODELS_DIR,
  BACKEND_GENERATED_API_DIR,
  FRONTEND_GENERATED_MODELS_DIR,
  FRONTEND_GENERATED_API_DIR,
  IOS_GENERATED_MODELS_DIR,
  IOS_GENERATED_API_DIR
].freeze

JS_RUNTIME_HEADER = <<~JS.freeze
  // Generated from the normalized model IR exported from model/ir.
  // Do not edit by hand.
JS

SWIFT_RUNTIME_HEADER = <<~SWIFT.freeze
  // Generated from the normalized model IR exported from model/ir.
  // Do not edit by hand.
SWIFT

def load_ir_json
  stdout, stderr, status = Open3.capture3('cue', 'export', './ir', '-e', 'IR', chdir: MODEL_DIR)
  unless status.success?
    warn stderr
    abort 'Failed to export normalized model IR from model/ir'
  end
  JSON.parse(stdout)
end

def write_file(path, content)
  FileUtils.mkdir_p(File.dirname(path))
  File.write(path, content)
end

def js_literal(object)
  JSON.pretty_generate(object)
end

def upper_snake(name)
  name.gsub(/([a-z\d])([A-Z])/, '\\1_\\2').upcase
end

def catalog_codes(entries)
  entries.map { |entry| entry.is_a?(Hash) ? entry.fetch('code') : entry }
end

def lower_camel(value)
  parts = value.split('_')
  return value if parts.empty?

  parts.first + parts[1..].map(&:capitalize).join
end

def swift_case(value)
  normalized = value.to_s.gsub(/[^A-Za-z0-9]+/, '_')
  normalized = normalized.gsub(/([a-z\d])([A-Z])/, '\\1_\\2').downcase
  parts = normalized.split('_').reject(&:empty?)
  return 'unknown' if parts.empty?

  first = parts.shift
  first + parts.map(&:capitalize).join
end

def snake_case(value)
  value
    .gsub(/([a-z\d])([A-Z])/, '\\1_\\2')
    .gsub(/([A-Z]+)([A-Z][a-z])/, '\\1_\\2')
    .tr('-', '_')
    .downcase
end

def swift_type_for_field(field)
  base = case field.fetch('kind')
         when 'enum'
           "Generated#{field.fetch('typeName')}"
         when 'entity', 'valueObject', 'transport'
           "Generated#{field.fetch('typeName')}"
         else
           case field.fetch('typeName')
           when 'Identifier', 'Timestamp', 'Email', 'string'
             'String'
           when 'int'
             'Int'
           when 'bool'
             'Bool'
           else
             'String'
           end
         end

  base = "[#{base}]" if field['isArray']
  field.fetch('required') ? base : "#{base}?"
end

def js_schema_for_type(type)
  {
    'name' => type.fetch('name'),
    'domain' => type.fetch('domain'),
    'module' => type.fetch('module'),
    'sourceType' => type.fetch('sourceType'),
    'fields' => type.fetch('fields')
  }
end

def js_validator_helpers
  <<~JS
    function __assertObject(value, schemaName) {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError(`${schemaName} must be an object`);
      }
    }

    function __validateShape(value, schema) {
      __assertObject(value, schema.name);
      for (const field of schema.fields) {
        const fieldValue = value[field.name];
        if (field.required && (fieldValue === undefined || fieldValue === null)) {
          throw new TypeError(`${schema.name}.${field.name} is required`);
        }
        if (fieldValue === undefined || fieldValue === null) continue;
        if (field.isArray && !Array.isArray(fieldValue)) {
          throw new TypeError(`${schema.name}.${field.name} must be an array`);
        }
      }
      return value;
    }
  JS
end

def render_js_type_exports(types)
  return '' if types.empty?

  types.map do |type|
    const_name = "#{upper_snake(type.fetch('name'))}_SCHEMA"
    <<~JS
      export const #{const_name} = #{js_literal(js_schema_for_type(type))};

      export function validate#{type.fetch('name')}(value) {
        return __validateShape(value, #{const_name});
      }
    JS
  end.join("\n")
end

def render_js_currency_module(currency_entries)
  currency_hash = currency_entries.each_with_object({}) do |entry, acc|
    acc[entry.fetch('code')] = {
      'code' => entry.fetch('code'),
      'symbol' => entry.fetch('symbol'),
      'decimalPlaces' => entry.fetch('decimalPlaces')
    }
  end

  <<~JS
    #{JS_RUNTIME_HEADER}
    export const GENERATED_CURRENCIES = #{js_literal(currency_hash)};
    export const GENERATED_CURRENCY_CODES = Object.freeze(Object.keys(GENERATED_CURRENCIES));

    export function normalizeCurrencyCode(value) {
      const normalized = String(value || '').trim().toUpperCase();
      if (normalized === 'EUR') return 'EURO';
      return GENERATED_CURRENCY_CODES.includes(normalized) ? normalized : null;
    }

    export function currencyDefinition(code) {
      const normalized = normalizeCurrencyCode(code);
      return normalized ? GENERATED_CURRENCIES[normalized] : null;
    }

    export function currencyDecimalPlaces(code) {
      return currencyDefinition(code)?.decimalPlaces ?? 2;
    }

    export function formatMoneyFromMinorUnits(amountMinorUnits, code) {
      const definition = currencyDefinition(code);
      if (!definition) return String(amountMinorUnits ?? '');
      const numeric = Number(amountMinorUnits || 0);
      const scale = 10 ** definition.decimalPlaces;
      const major = definition.decimalPlaces === 0 ? numeric : numeric / scale;
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: definition.decimalPlaces,
        maximumFractionDigits: definition.decimalPlaces
      }).format(major);
    }
  JS
end

def render_js_user_module(types, roles)
  role_codes = catalog_codes(roles)

  <<~JS
    #{JS_RUNTIME_HEADER}
    #{js_validator_helpers}
    export const GENERATED_ATP_USER_ROLES = Object.freeze(#{js_literal(role_codes)});

    #{render_js_type_exports(types)}
  JS
end

def render_js_booking_module(types, stages, payment_statuses, adjustment_types)
  stage_codes = catalog_codes(stages)
  payment_status_codes = catalog_codes(payment_statuses)
  adjustment_type_codes = catalog_codes(adjustment_types)

  <<~JS
    #{JS_RUNTIME_HEADER}
    #{js_validator_helpers}
    export const GENERATED_BOOKING_STAGES = Object.freeze(#{js_literal(stage_codes)});
    export const GENERATED_PAYMENT_STATUSES = Object.freeze(#{js_literal(payment_status_codes)});
    export const GENERATED_PRICING_ADJUSTMENT_TYPES = Object.freeze(#{js_literal(adjustment_type_codes)});

    #{render_js_type_exports(types)}
  JS
end

def render_js_aux_module(types)
  <<~JS
    #{JS_RUNTIME_HEADER}
    #{js_validator_helpers}

    #{render_js_type_exports(types)}
  JS
end

def render_js_api_models_module(api_types, endpoints)
  <<~JS
    #{JS_RUNTIME_HEADER}
    #{js_validator_helpers}
    export const GENERATED_API_ENDPOINTS = #{js_literal(endpoints)};

    #{render_js_type_exports(api_types)}
  JS
end

def render_js_request_factory_module(endpoints, contract_version)
  endpoint_map = endpoints.each_with_object({}) { |entry, acc| acc[entry.fetch('key')] = entry }

  functions = endpoints.map do |endpoint|
    key = endpoint.fetch('key')
    function_base = lower_camel(key)
    template = endpoint.fetch('path')
    <<~JS
      export function #{function_base}Path(params = {}) {
        return buildPath(#{template.inspect}, params);
      }

      export function #{function_base}Request({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
        const path = #{function_base}Path(params);
        const url = buildURL(baseURL, path, query);
        return {
          key: #{key.inspect},
          method: #{endpoint.fetch('method').inspect},
          authenticated: #{endpoint.fetch('authenticated') ? 'true' : 'false'},
          url,
          headers,
          body
        };
      }
    JS
  end.join("\n")

  <<~JS
    #{JS_RUNTIME_HEADER}
    export const GENERATED_CONTRACT_VERSION = #{contract_version.inspect};
    export const GENERATED_API_ENDPOINTS = #{js_literal(endpoint_map)};

    export function buildPath(template, params = {}) {
      return template.replace(/\{(\w+)\}/g, (_, key) => {
        if (!(key in params)) throw new Error(`Missing path parameter ${key}`);
        return encodeURIComponent(String(params[key]));
      });
    }

    export function buildURL(baseURL, path, query = {}) {
      const url = new URL(path, baseURL);
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === '') continue;
        url.searchParams.set(key, String(value));
      }
      return url;
    }

    #{functions}
  JS
end

def render_js_api_client_module(endpoints)
  helper_cases = endpoints.map do |endpoint|
    key = endpoint.fetch('key')
    function_name = "#{lower_camel(key)}Request"
    <<~JS
        case #{key.inspect}:
          return RequestFactory.#{function_name}(options);
    JS
  end.join

  <<~JS
    #{JS_RUNTIME_HEADER}
    import * as RequestFactory from './generated_APIRequestFactory.js';

    export class GeneratedAPIClient {
      constructor({ baseURL = '', fetchImpl = fetch, defaultHeaders = {} } = {}) {
        this.baseURL = baseURL;
        this.fetchImpl = fetchImpl;
        this.defaultHeaders = defaultHeaders;
      }

      buildRequest(key, options = {}) {
        switch (key) {
#{helper_cases}      default:
            throw new Error(`Unknown generated endpoint ${key}`);
        }
      }

      async request(key, { parseAs = 'json', ...options } = {}) {
        const request = this.buildRequest(key, { ...options, baseURL: this.baseURL });
        const headers = { ...this.defaultHeaders, ...(request.headers || {}) };
        const init = { method: request.method, headers };
        if (request.body !== undefined) {
          init.body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
          if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
        }
        const response = await this.fetchImpl(request.url, init);
        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status} ${response.statusText}: ${detail}`);
        }
        if (parseAs === 'text') return response.text();
        if (response.status === 204) return null;
        return response.json();
      }
    }
  JS
end

def render_swift_currency(currency_entries)
  currency_cases = currency_entries.map { |entry| "    case #{swift_case(entry.fetch('code'))} = \"#{entry.fetch('code')}\"" }.join("\n")
  currency_catalog_entries = currency_entries.map do |entry|
    code_case = swift_case(entry.fetch('code'))
    "        .#{code_case}: GeneratedCurrencyDefinition(code: .#{code_case}, symbol: #{entry.fetch('symbol').inspect}, decimalPlaces: #{entry.fetch('decimalPlaces')}, isoCode: #{entry.fetch('code').inspect})"
  end.join(",\n")

  <<~SWIFT
    import Foundation

    #{SWIFT_RUNTIME_HEADER}
    enum GeneratedCurrencyCode: String, CaseIterable, Codable, Hashable {
#{currency_cases}

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
    }

    struct GeneratedCurrencyDefinition: Codable, Equatable {
        let code: GeneratedCurrencyCode
        let symbol: String
        let decimalPlaces: Int
        let isoCode: String
    }

    enum GeneratedCurrencyCatalog {
        static let definitions: [GeneratedCurrencyCode: GeneratedCurrencyDefinition] = [
#{currency_catalog_entries}
        ]

        static func definition(for code: GeneratedCurrencyCode) -> GeneratedCurrencyDefinition {
            definitions[code] ?? GeneratedCurrencyDefinition(code: .usd, symbol: "$", decimalPlaces: 2, isoCode: "USD")
        }
    }
  SWIFT
end

def render_swift_user(roles)
  role_codes = catalog_codes(roles)
  role_cases = role_codes.map { |role| "    case #{swift_case(role)} = \"#{role}\"" }.join("\n")

  <<~SWIFT
    import Foundation

    #{SWIFT_RUNTIME_HEADER}
    enum GeneratedATPUserRole: String, CaseIterable, Codable, Hashable {
#{role_cases}
    }

    struct GeneratedATPUser: Codable, Equatable {
        let id: String
        let preferredUsername: String
        let displayName: String?
        let email: String?
        let roles: [GeneratedATPUserRole]
        let staffId: String?
    }
  SWIFT
end

def render_swift_booking(stages, payment_statuses, adjustment_types)
  stage_codes = catalog_codes(stages)
  payment_status_codes = catalog_codes(payment_statuses)
  adjustment_type_codes = catalog_codes(adjustment_types)

  stage_cases = stage_codes.map { |entry| "    case #{swift_case(entry)} = \"#{entry}\"" }.join("\n")
  payment_cases = payment_status_codes.map { |entry| "    case #{swift_case(entry)} = \"#{entry}\"" }.join("\n")
  adjustment_cases = adjustment_type_codes.map { |entry| "    case #{swift_case(entry)} = \"#{entry}\"" }.join("\n")

  <<~SWIFT
    import Foundation

    #{SWIFT_RUNTIME_HEADER}
    enum GeneratedBookingStage: String, CaseIterable, Codable, Hashable {
#{stage_cases}
    }

    enum GeneratedPaymentStatus: String, CaseIterable, Codable, Hashable {
#{payment_cases}
    }

    enum GeneratedPricingAdjustmentType: String, CaseIterable, Codable, Hashable {
#{adjustment_cases}
    }

    struct GeneratedSourceAttribution: Codable, Equatable {
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

    struct GeneratedBookingPricingAdjustment: Codable, Identifiable, Equatable {
        let id: String
        let type: GeneratedPricingAdjustmentType
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

    struct GeneratedBookingPayment: Codable, Identifiable, Equatable {
        let id: String
        let label: String
        let dueDate: String?
        let netAmountCents: Int
        let taxRateBasisPoints: Int
        let taxAmountCents: Int
        let grossAmountCents: Int
        let status: GeneratedPaymentStatus
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

    struct GeneratedBookingPricingSummary: Codable, Equatable {
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

    struct GeneratedBookingPricing: Codable, Equatable {
        let currency: GeneratedCurrencyCode
        let agreedNetAmountCents: Int
        let adjustments: [GeneratedBookingPricingAdjustment]
        let payments: [GeneratedBookingPayment]
        let summary: GeneratedBookingPricingSummary

        private enum CodingKeys: String, CodingKey {
            case currency
            case agreedNetAmountCents = "agreed_net_amount_cents"
            case adjustments
            case payments
            case summary
        }
    }

    struct GeneratedInvoiceLineItem: Codable, Identifiable, Equatable {
        let id: String
        let description: String
        let quantity: Int
        let unitAmountCents: Int
        let totalAmountCents: Int

        private enum CodingKeys: String, CodingKey {
            case id
            case description
            case quantity
            case unitAmountCents = "unit_amount_cents"
            case totalAmountCents = "total_amount_cents"
        }
    }

    struct GeneratedBookingInvoice: Codable, Identifiable, Equatable {
        let id: String
        let currency: GeneratedCurrencyCode
        let status: String
        let dueAmountCents: Int
        let notes: String?
        let items: [GeneratedInvoiceLineItem]

        private enum CodingKeys: String, CodingKey {
            case id
            case currency
            case status
            case dueAmountCents = "due_amount_cents"
            case notes
            case items
        }
    }

    struct GeneratedBookingActivity: Codable, Identifiable, Equatable {
        let id: String
        let type: String
        let createdAt: String
        let note: String?

        private enum CodingKeys: String, CodingKey {
            case id
            case type
            case createdAt = "created_at"
            case note
        }
    }

    struct GeneratedBooking: Codable, Identifiable, Equatable {
        let id: String
        let customerId: String?
        let customerName: String?
        let destination: String
        let style: String
        let travelMonth: String?
        let travelers: Int?
        let duration: String?
        let budget: String?
        let stage: GeneratedBookingStage
        let assignedStaffId: String?
        let assignedStaffName: String?
        let notes: String?
        let source: GeneratedSourceAttribution?
        let bookingHash: String?
        let pricing: GeneratedBookingPricing?

        private enum CodingKeys: String, CodingKey {
            case id
            case customerId = "customer_id"
            case customerName = "customer_name"
            case destination
            case style
            case travelMonth = "travel_month"
            case travelers
            case duration
            case budget
            case stage
            case assignedStaffId = "staff"
            case assignedStaffName = "staff_name"
            case notes
            case source
            case bookingHash = "booking_hash"
            case pricing
        }
    }
  SWIFT
end

def render_swift_type(type)
  protocol_list = ['Codable', 'Equatable']
  protocol_list << 'Identifiable' if type.fetch('fields').any? { |field| field.fetch('name') == 'id' && !field['isArray'] }
  protocols = protocol_list.join(', ')

  fields = type.fetch('fields').map do |field|
    field_name = field.fetch('name')
    swift_type = swift_type_for_field(field)
    "    let #{field_name}: #{swift_type}"
  end.join("\n")

  coding_keys = type.fetch('fields').map do |field|
    field_name = field.fetch('name')
    wire_name = field['wireName'] || snake_case(field_name)
    "        case #{field_name} = \"#{wire_name}\""
  end.join("\n")

  <<~SWIFT
    struct Generated#{type.fetch('name')}: #{protocols} {
#{fields}

        private enum CodingKeys: String, CodingKey {
#{coding_keys}
        }
    }
  SWIFT
end

def render_swift_type_collection(types)
  types.map { |type| render_swift_type(type) }.join("\n")
end

def render_swift_aux(types)
  <<~SWIFT
    import Foundation

    #{SWIFT_RUNTIME_HEADER}
    #{render_swift_type_collection(types)}
  SWIFT
end

def render_swift_api_models(api_types)
  <<~SWIFT
    import Foundation

    #{SWIFT_RUNTIME_HEADER}
    #{render_swift_type_collection(api_types)}
  SWIFT
end

def render_swift_request_factory(endpoints, contract_version)
  endpoint_constants = endpoints.map do |endpoint|
    "    static let #{lower_camel(endpoint.fetch('key'))} = \"#{endpoint.fetch('path')}\""
  end.join("\n")

  path_functions = endpoints.map do |endpoint|
    function_name = "#{lower_camel(endpoint.fetch('key'))}Path"
    path = endpoint.fetch('path')
    parameters = endpoint.fetch('parameters', [])

    if parameters.empty?
      <<~SWIFT
        static func #{function_name}() -> String {
            #{path.inspect}
        }
      SWIFT
    else
      args = parameters.map { |param| "#{param.fetch('name')}: String" }.join(', ')
      body = path.dup
      parameters.each do |param|
        body = body.gsub("{#{param.fetch('name')}}", "\\(#{param.fetch('name')})")
      end
      <<~SWIFT
        static func #{function_name}(#{args}) -> String {
            "#{body}"
        }
      SWIFT
    end
  end.join("\n")

  url_helpers = endpoints.map do |endpoint|
    function_name = "#{lower_camel(endpoint.fetch('key'))}URL"
    path_function = "#{lower_camel(endpoint.fetch('key'))}Path"
    parameters = endpoint.fetch('parameters', [])
    args = ['baseURL: URL']
    call_args = []
    parameters.each do |param|
      args << "#{param.fetch('name')}: String"
      call_args << "#{param.fetch('name')}: #{param.fetch('name')}"
    end
    args << 'queryItems: [URLQueryItem] = []'
    path_call = call_args.empty? ? "#{path_function}()" : "#{path_function}(#{call_args.join(', ')})"
    <<~SWIFT
      static func #{function_name}(#{args.join(', ')}) -> URL {
          buildURL(baseURL: baseURL, path: #{path_call}, queryItems: queryItems)
      }
    SWIFT
  end.join("\n")

  <<~SWIFT
    import Foundation

    #{SWIFT_RUNTIME_HEADER}
    enum GeneratedAPIRequestFactory {
        static let contractVersion = #{contract_version.inspect}

#{endpoint_constants}

        static func buildURL(baseURL: URL, path: String, queryItems: [URLQueryItem] = []) -> URL {
            var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
            components.queryItems = queryItems.isEmpty ? nil : queryItems
            return components.url!
        }

#{path_functions}

#{url_helpers}
    }
  SWIFT
end

def render_swift_api_client(endpoints)
  cases = endpoints.map do |endpoint|
    "        case .#{swift_case(endpoint.fetch('key'))}: return #{endpoint.fetch('method').inspect}"
  end.join("\n")

  enum_cases = endpoints.map do |endpoint|
    "    case #{swift_case(endpoint.fetch('key'))}"
  end.join("\n")

  <<~SWIFT
    import Foundation

    #{SWIFT_RUNTIME_HEADER}
    enum GeneratedAPIEndpointKey: String, CaseIterable {
#{enum_cases}
    }

    enum GeneratedAPIClientMethod {
        static func httpMethod(for endpoint: GeneratedAPIEndpointKey) -> String {
            switch endpoint {
#{cases}
            }
        }
    }
  SWIFT
end

# --- OpenAPI 3.1 generation from IR (model/api/ + entities/enums/common) ---

OPENAPI_INFO = {
  title: 'AsiaTravelPlan Mobile API',
  version: '2026-03-02.1',
  summary: 'Contract for the in-house iPhone app and the AsiaTravelPlan backend.',
  description: <<~DESC.strip
    This contract is generated from the CUE abstract model (model/api, model/entities, model/enums, model/common).
    It describes the request and response payloads the iPhone app and frontend may rely on.

    Important:
    - The mobile app must not depend on backend storage details.
    - Breaking changes should increment the contract version and normally require a mobile app update.
    - Only these app roles are supported: atp_admin, atp_manager, atp_accountant, atp_staff.
  DESC
}.freeze

def openapi_schema_ref(name)
  { '$ref' => "#/components/schemas/#{name}" }
end

def openapi_schema_for_field(field, type_index, enum_schema_names)
  prop = case field.fetch('kind')
         when 'scalar'
           case field.fetch('typeName')
           when 'string', 'Identifier', 'Timestamp', 'Email', 'Url'
             { type: 'string' }
           when 'int'
             { type: 'integer' }
           when 'bool'
             { type: 'boolean' }
           else
             { type: 'string' }
           end
         when 'enum'
           ref_name = field.fetch('typeName')
           ref_name = 'ATPCurrencyCode' if ref_name == 'CurrencyCode'
           ref_name = 'ATPUserRole' if ref_name == 'ATPUserRole'
           ref_name = 'BookingStage' if ref_name == 'BookingStage'
           ref_name = 'PaymentStatus' if ref_name == 'PaymentStatus'
           ref_name = 'PricingAdjustmentType' if ref_name == 'PricingAdjustmentType'
           openapi_schema_ref(ref_name)
         when 'entity', 'valueObject', 'transport'
           openapi_schema_ref(field.fetch('typeName'))
         else
           { type: 'string' }
         end

  prop = { type: 'array', items: prop } if field['isArray']
  prop[:nullable] = true if field['required'] == false && !field['isArray']
  prop
end

def build_openapi_schemas(ir)
  types = ir.fetch('types')
  type_index = types.each_with_object({}) { |t, acc| acc[t.fetch('name')] = t }

  enum_schema_names = %w[ATPCurrencyCode ATPUserRole BookingStage PaymentStatus PricingAdjustmentType]

  # Enum schemas from catalogs (camelCase not needed for enum values)
  schemas = {}
  schemas['ATPCurrencyCode'] = {
    type: 'string',
    enum: catalog_codes(ir.dig('catalogs', 'currencies'))
  }
  schemas['ATPUserRole'] = {
    type: 'string',
    enum: catalog_codes(ir.dig('catalogs', 'roles'))
  }
  schemas['BookingStage'] = {
    type: 'string',
    enum: catalog_codes(ir.dig('catalogs', 'stages'))
  }
  schemas['PaymentStatus'] = {
    type: 'string',
    enum: catalog_codes(ir.dig('catalogs', 'paymentStatuses'))
  }
  schemas['PricingAdjustmentType'] = {
    type: 'string',
    enum: catalog_codes(ir.dig('catalogs', 'pricingAdjustmentTypes'))
  }

  # Collect all referenced type names
  referenced = types.flat_map do |t|
    t.fetch('fields').map { |f| f.fetch('typeName') if %w[entity valueObject transport enum].include?(f.fetch('kind')) }
  end.compact.uniq
  referenced += enum_schema_names
  referenced.uniq!

  # Placeholder for refs not defined in types (e.g. BookingPricing from CUE but not in IR types list)
  referenced.each do |name|
    next if schemas.key?(name)
    next if type_index.key?(name)

    canonical = name
    canonical = 'ATPCurrencyCode' if name == 'CurrencyCode'
    next if schemas.key?(canonical)

    schemas[name] = { type: 'object', description: "Defined in model (referenced as #{name})." }
  end

  # Object schemas from IR types (camelCase property names)
  types.each do |type|
    name = type.fetch('name')
    fields = type.fetch('fields')
    properties = {}
    required = []

    fields.each do |field|
      prop_name = field.fetch('name')
      properties[prop_name] = openapi_schema_for_field(field, type_index, enum_schema_names)
      required << prop_name if field.fetch('required') && !field['isArray']
    end

    schemas[name] = {
      type: 'object',
      required: required,
      properties: properties
    }
  end

  schemas
end

def build_openapi_paths(endpoints, request_types, response_types)
  paths = {}
  endpoints.each do |ep|
    path = ep.fetch('path')
    method = ep.fetch('method').downcase
    paths[path] ||= {}
    tag = if path.start_with?('/public/') then 'Public'
           elsif path.include?('auth') then 'Auth'
           else (path.split('/')[2]&.capitalize || 'API')
           end
    op = {
      summary: ep.fetch('key').split('_').map(&:capitalize).join(' '),
      tags: [tag],
      security: ep.fetch('authenticated') ? [{ bearerAuth: [] }] : []
    }
    op[:parameters] = (ep['parameters'] || []).map do |p|
      {
        name: p.fetch('name'),
        in: p.fetch('location') == 'path' ? 'path' : 'query',
        required: p.fetch('required'),
        schema: { type: 'string' }
      }
    end
    if request_types.include?(ep['requestType'])
      op[:requestBody] = {
        required: true,
        content: {
          'application/json' => {
            schema: openapi_schema_ref(ep['requestType'])
          }
        }
      }
    end
    response_schema = response_types.include?(ep['responseType']) ? openapi_schema_ref(ep['responseType']) : { type: 'object' }
    op[:responses] = {
      '200' => { description: 'Success', content: { 'application/json' => { schema: response_schema } } }
    }
    op[:responses]['201'] = { description: 'Created', content: { 'application/json' => { schema: response_schema } } } if ep.fetch('method') == 'POST'
    op[:responses]['401'] = { description: 'Unauthorized', content: { 'application/json' => { schema: openapi_schema_ref('ErrorResponse') } } } if ep.fetch('authenticated')
    op[:responses]['403'] = { description: 'Forbidden', content: { 'application/json' => { schema: openapi_schema_ref('ErrorResponse') } } } if ep.fetch('authenticated')
    paths[path][method] = op
  end
  paths
end

def build_openapi_doc(ir)
  endpoints = ir.dig('api', 'endpoints') || []
  types = ir.fetch('types')

  schemas = build_openapi_schemas(ir)
  request_types = endpoints.map { |e| e['requestType'] }.compact.uniq
  response_types = endpoints.map { |e| e['responseType'] }.compact.uniq

  {
    'openapi' => '3.1.0',
    'info' => OPENAPI_INFO,
    'servers' => [
      { url: 'https://api-staging.asiatravelplan.com', description: 'Staging API' },
      { url: 'http://localhost:8787', description: 'Local development API' }
    ],
    'tags' => [
      { name: 'Auth' },
      { name: 'Public' },
      { name: 'Bookings' },
      { name: 'Customers' },
      { name: 'Staff' },
      { name: 'Tours' }
    ],
    'components' => {
      'securitySchemes' => {
        'bearerAuth' => { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      },
      'schemas' => schemas
    },
    'security' => [{ 'bearerAuth' => [] }],
    'paths' => build_openapi_paths(endpoints, request_types, response_types)
  }
end

def deep_stringify_keys(obj)
  case obj
  when Hash
    obj.transform_keys(&:to_s).transform_values { |v| deep_stringify_keys(v) }
  when Array
    obj.map { |e| deep_stringify_keys(e) }
  else
    obj
  end
end

def write_openapi_yaml(path, doc)
  yaml = YAML.dump(deep_stringify_keys(doc))
  File.write(path, "# Generated from model/ (CUE) via tools/generator. Do not edit by hand.\n# #{Time.now.utc.iso8601}\n\n" + yaml)
end

FileUtils.mkdir_p(CONTRACT_GENERATED_DIR)
OUTPUT_DIRS.each { |directory| FileUtils.mkdir_p(directory) }

ir = load_ir_json
meta = ir.fetch('meta')
types = ir.fetch('types')
endpoints = ir.dig('api', 'endpoints') || []

currency_entries = ir.fetch('catalogs').fetch('currencies')
roles = ir.fetch('catalogs').fetch('roles')
stages = ir.fetch('catalogs').fetch('stages')
payment_statuses = ir.fetch('catalogs').fetch('paymentStatuses')
adjustment_types = ir.fetch('catalogs').fetch('pricingAdjustmentTypes')
contract_version = meta.fetch('modelVersion')

entity_types = types.select { |type| type.fetch('module') == 'entities' }
api_types = types.select { |type| type.fetch('module') == 'api' }

user_types = entity_types.select { |type| type.fetch('domain') == 'user' }
booking_types = entity_types.select { |type| type.fetch('domain') == 'booking' }
aux_types = entity_types.reject { |type| %w[user booking].include?(type.fetch('domain')) }

write_file(
  File.join(CONTRACT_GENERATED_DIR, 'mobile-api.meta.json'),
  JSON.pretty_generate(
    {
      modelVersion: meta.fetch('modelVersion'),
      generatorVersion: meta.fetch('generatorVersion'),
      modulePath: meta.fetch('modulePath'),
      defaultCurrency: meta.fetch('defaultCurrency'),
      generatedAt: Time.now.utc.iso8601,
      currencies: currency_entries,
      roles: roles,
      stages: stages,
      paymentStatuses: payment_statuses,
      pricingAdjustmentTypes: adjustment_types,
      endpoints: endpoints
    }
  ) + "\n"
)

openapi_doc = build_openapi_doc(ir)
write_openapi_yaml(File.join(CONTRACT_GENERATED_DIR, 'openapi.yaml'), openapi_doc)

# Embed spec in HTML so Redoc never resolves external refs (avoids Node-only lstatSync/process in the bundle).
openapi_json = JSON.pretty_generate(deep_stringify_keys(openapi_doc))
openapi_json = openapi_json.gsub('</script>', '\u003c/script>') # avoid closing the script tag in HTML

redoc_head = <<~REDOC_HEAD
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>#{OPENAPI_INFO[:title]} – API Documentation</title>
    <link href="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.css" rel="stylesheet">
  </head>
  <body>
    <div id="redoc"></div>
    <script type="application/json" id="openapi-spec">
REDOC_HEAD
redoc_tail = <<~REDOC_TAIL
  </script>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
    <script>
      Redoc.init(JSON.parse(document.getElementById("openapi-spec").textContent), {}, document.getElementById("redoc"));
    </script>
  </body>
  </html>
REDOC_TAIL

write_file(File.join(CONTRACT_GENERATED_DIR, 'redoc.html'), redoc_head + openapi_json + redoc_tail)

write_file(
  File.join(CONTRACT_GENERATED_DIR, 'README.md'),
  <<~README
    # Generated API contract and docs

    This directory is generated from the CUE model (\`model/\`) by \`tools/generator/generate_mobile_contract_artifacts.rb\`. Do not edit these files by hand.

    - **openapi.yaml** – OpenAPI 3.1 specification (source of truth for mobile and frontend clients).
    - **mobile-api.meta.json** – Generator metadata (endpoints, catalogs, version).
    - **redoc.html** – API documentation rendered with [Redoc](https://redoc.ly/).

    ## Viewing the API docs

    Serve this directory over HTTP so `openapi.yaml` can be loaded (e.g. CORS when opening the HTML from file is restricted). From the project root:

    ```bash
    npx serve api/generated
    ```

    Then open http://localhost:3000/redoc.html (or the port shown). Alternatively, use any static server (Python \`http.server\`, Ruby \`rackup\`, etc.) pointed at \`api/generated\`.
  README
)

backend_model_outputs = {
  'generated_Currency.js' => render_js_currency_module(currency_entries),
  'generated_User.js' => render_js_user_module(user_types, roles),
  'generated_Booking.js' => render_js_booking_module(booking_types, stages, payment_statuses, adjustment_types),
  'generated_Aux.js' => render_js_aux_module(aux_types)
}

frontend_model_outputs = backend_model_outputs

api_model_js = render_js_api_models_module(api_types, endpoints)
api_request_js = render_js_request_factory_module(endpoints, contract_version)
api_client_js = render_js_api_client_module(endpoints)

backend_api_outputs = {
  'generated_APIModels.js' => api_model_js,
  'generated_APIRequestFactory.js' => api_request_js,
  'generated_APIClient.js' => api_client_js
}

frontend_api_outputs = backend_api_outputs

ios_model_outputs = {
  'generated_Currency.swift' => render_swift_currency(currency_entries),
  'generated_User.swift' => render_swift_user(roles),
  'generated_Booking.swift' => render_swift_booking(stages, payment_statuses, adjustment_types),
  'generated_Aux.swift' => render_swift_aux(aux_types)
}

ios_api_outputs = {
  'generated_APIModels.swift' => render_swift_api_models(api_types),
  'generated_APIRequestFactory.swift' => render_swift_request_factory(endpoints, contract_version),
  'generated_APIClient.swift' => render_swift_api_client(endpoints)
}

backend_model_outputs.each do |filename, content|
  write_file(File.join(BACKEND_GENERATED_MODELS_DIR, filename), content)
end
backend_api_outputs.each do |filename, content|
  write_file(File.join(BACKEND_GENERATED_API_DIR, filename), content)
end
frontend_model_outputs.each do |filename, content|
  write_file(File.join(FRONTEND_GENERATED_MODELS_DIR, filename), content)
end
frontend_api_outputs.each do |filename, content|
  write_file(File.join(FRONTEND_GENERATED_API_DIR, filename), content)
end
ios_model_outputs.each do |filename, content|
  write_file(File.join(IOS_GENERATED_MODELS_DIR, filename), content)
end
ios_api_outputs.each do |filename, content|
  write_file(File.join(IOS_GENERATED_API_DIR, filename), content)
end
