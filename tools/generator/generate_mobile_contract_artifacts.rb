#!/usr/bin/env ruby
# frozen_string_literal: true

require 'json'
require 'yaml'
require 'fileutils'
require 'open3'
require 'time'
require 'set'
require 'pathname'

ROOT = File.expand_path('../..', __dir__)
MODEL_DIR = File.join(ROOT, 'model')
CONTRACT_GENERATED_DIR = File.join(ROOT, 'api', 'generated')
SHARED_GENERATED_CONTRACT_DIR = File.join(ROOT, 'shared', 'generated-contract')
SHARED_GENERATED_MODELS_DIR = File.join(SHARED_GENERATED_CONTRACT_DIR, 'Models')
SHARED_GENERATED_API_DIR = File.join(SHARED_GENERATED_CONTRACT_DIR, 'API')

BACKEND_GENERATED_MODELS_DIR = File.join(ROOT, 'backend', 'app', 'Generated', 'Models')
BACKEND_GENERATED_API_DIR = File.join(ROOT, 'backend', 'app', 'Generated', 'API')
FRONTEND_GENERATED_MODELS_DIR = File.join(ROOT, 'frontend', 'Generated', 'Models')
FRONTEND_GENERATED_API_DIR = File.join(ROOT, 'frontend', 'Generated', 'API')
IOS_GENERATED_MODELS_DIR = File.join(ROOT, 'mobile', 'iOS', 'Generated', 'Models')
IOS_GENERATED_API_DIR = File.join(ROOT, 'mobile', 'iOS', 'Generated', 'API')

OUTPUT_DIRS = [
  CONTRACT_GENERATED_DIR,
  SHARED_GENERATED_MODELS_DIR,
  SHARED_GENERATED_API_DIR,
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

JS_OPENAPI_HEADER = <<~JS.freeze
  // Generated from api/generated/openapi.yaml.
  // Do not edit by hand.
JS

SWIFT_RUNTIME_HEADER = <<~SWIFT.freeze
  // Generated from the normalized model IR exported from model/ir.
  // Do not edit by hand.
SWIFT

SWIFT_OPENAPI_HEADER = <<~SWIFT.freeze
  // Generated from api/generated/openapi.yaml.
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

def load_traveler_constraints_json
  stdout, stderr, status = Open3.capture3('cue', 'export', './api', '-e', '#TravelerConstraints', chdir: MODEL_DIR)
  unless status.success?
    warn stderr
    abort 'Failed to export traveler constraints from model/api'
  end
  JSON.parse(stdout)
end

def write_file(path, content)
  FileUtils.mkdir_p(File.dirname(path))
  File.write(path, content)
end

def relative_module_path(from_dir, to_file)
  relative = Pathname.new(to_file).relative_path_from(Pathname.new(from_dir)).to_s
  relative.start_with?('.') ? relative : "./#{relative}"
end

def render_js_reexport_module(relative_target, header = JS_OPENAPI_HEADER)
  <<~JS
    #{header}
    export * from #{relative_target.inspect};
  JS
end

def js_literal(object)
  JSON.pretty_generate(object)
end

def js_inline_literal(object)
  JSON.generate(object)
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

SWIFT_RESERVED_IDENTIFIERS = %w[
  associatedtype class deinit enum extension fileprivate func import init inout internal let open operator private protocol public rethrows static struct subscript typealias var break case catch continue default defer do else fallthrough for guard if in repeat return switch throw where while as Any false is nil self Self super throws true try _
].to_set.freeze

def swift_enum_case_identifier(value)
  identifier = swift_case(value)
  return "`#{identifier}`" if SWIFT_RESERVED_IDENTIFIERS.include?(identifier)
  identifier
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
           when 'float'
             'Double'
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

def js_field_fragment(field)
  field.reject { |key, _| %w[name required wireName].include?(key) }
end

def build_js_shared_field_definitions(types)
  ordered = {}
  types.each do |type|
    type.fetch('fields').each do |field|
      fragment = js_field_fragment(field)
      key = JSON.generate(fragment)
      ordered[key] ||= fragment
    end
  end

  names = {}
  definitions = {}
  ordered.each_with_index do |(key, fragment), index|
    name = "FIELD_#{index + 1}"
    names[key] = name
    definitions[name] = fragment
  end

  [definitions, names]
end

def build_js_shared_parameter_definitions(endpoints)
  ordered = {}
  endpoints.each do |endpoint|
    Array(endpoint['parameters']).each do |parameter|
      key = JSON.generate(parameter)
      ordered[key] ||= parameter
    end
  end

  names = {}
  definitions = {}
  ordered.each_with_index do |(key, parameter), index|
    name = "PARAM_#{index + 1}"
    names[key] = name
    definitions[name] = parameter
  end

  [definitions, names]
end

def render_js_shared_field_definitions(definitions)
  body = definitions.map do |name, fragment|
    "  #{name}: #{js_literal(fragment)}"
  end.join(",\n")

  <<~JS
    export const SHARED_FIELD_DEFS = Object.freeze({
#{body}
    });
  JS
end

def render_js_shared_parameter_definitions(definitions)
  body = definitions.map do |name, parameter|
    "  #{name}: #{js_literal(parameter)}"
  end.join(",\n")

  <<~JS
    export const SHARED_API_PARAMETER_DEFS = Object.freeze({
#{body}
    });
  JS
end

def render_js_type_exports(types, shared_field_names)
  return '' if types.empty?

  types.map do |type|
    const_name = "#{upper_snake(type.fetch('name'))}_SCHEMA"
    field_lines = type.fetch('fields').map do |field|
      base = {
        'name' => field.fetch('name'),
        'required' => field.fetch('required'),
        'wireName' => field['wireName'] || snake_case(field.fetch('name'))
      }
      fragment_name = shared_field_names.fetch(JSON.generate(js_field_fragment(field)))
      "    schemaField(#{js_inline_literal(base)}, SHARED_FIELD_DEFS.#{fragment_name})"
    end.join(",\n")
    <<~JS
      export const #{const_name} = {
        name: #{type.fetch('name').inspect},
        domain: #{type.fetch('domain').inspect},
        module: #{type.fetch('module').inspect},
        sourceType: #{type.fetch('sourceType').inspect},
        fields: [
#{field_lines}
        ]
      };

      export function validate#{type.fetch('name')}(value) {
        return validateShape(value, #{const_name});
      }
    JS
  end.join("\n")
end

def render_js_currency_module(currency_entries, header = JS_RUNTIME_HEADER)
  currency_hash = currency_entries.each_with_object({}) do |entry, acc|
    acc[entry.fetch('code')] = {
      'code' => entry.fetch('code'),
      'symbol' => entry.fetch('symbol'),
      'decimalPlaces' => entry.fetch('decimalPlaces')
    }
  end

  <<~JS
    #{header}
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
      maximumFractionDigits: definition.decimalPlaces,
      useGrouping: true
    }).format(major);
    }
  JS
end

def render_js_language_module(language_codes, header = JS_RUNTIME_HEADER)
  <<~JS
    #{header}

    export const GENERATED_LANGUAGE_CODES = Object.freeze(#{js_literal(language_codes)});

    export function normalizeLanguageCode(value) {
      const normalized = String(value || '').trim();
      return GENERATED_LANGUAGE_CODES.includes(normalized) ? normalized : null;
    }

    export function formatLanguageCodeLabel(code) {
      return normalizeLanguageCode(code) || String(code || '').trim();
    }
  JS
end

def render_js_form_constraints_module(traveler_constraints, header = JS_RUNTIME_HEADER)
  min_travelers = Integer(traveler_constraints.fetch('min'))
  max_travelers = Integer(traveler_constraints.fetch('max'))

  <<~JS
    #{header}
    export const GENERATED_TRAVELER_CONSTRAINTS = Object.freeze({
      min: #{min_travelers},
      max: #{max_travelers}
    });

    export const MIN_TRAVELERS = GENERATED_TRAVELER_CONSTRAINTS.min;
    export const MAX_TRAVELERS = GENERATED_TRAVELER_CONSTRAINTS.max;
  JS
end

def render_js_schema_runtime_module(shared_field_definitions, header = JS_RUNTIME_HEADER)
  <<~JS
    #{header}
    #{render_js_shared_field_definitions(shared_field_definitions)}

    export function schemaField(base, shared = {}) {
      return { ...shared, ...base };
    }

    export function assertObject(value, schemaName) {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError(`${schemaName} must be an object`);
      }
    }

    export function validateShape(value, schema) {
      assertObject(value, schema.name);
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

def render_js_api_runtime_module(endpoints, contract_version, shared_parameter_definitions, shared_parameter_names, header = JS_OPENAPI_HEADER)
  endpoint_entries = endpoints.map do |endpoint|
    parameter_lines = Array(endpoint.fetch('parameters', [])).map do |parameter|
      parameter_name = shared_parameter_names.fetch(JSON.generate(parameter))
      "      apiParameter(SHARED_API_PARAMETER_DEFS.#{parameter_name})"
    end.join(",\n")

    <<~JS.chomp
      {
        key: #{endpoint.fetch('key').inspect},
        path: #{endpoint.fetch('path').inspect},
        method: #{endpoint.fetch('method').inspect},
        authenticated: #{endpoint.fetch('authenticated') ? 'true' : 'false'},
        requestType: #{js_inline_literal(endpoint.fetch('requestType'))},
        responseType: #{js_inline_literal(endpoint.fetch('responseType'))},
        parameters: [
#{parameter_lines}
        ]
      }
    JS
  end.join(",\n")

  <<~JS
    #{header}
    #{render_js_shared_parameter_definitions(shared_parameter_definitions)}

    export const GENERATED_CONTRACT_VERSION = #{contract_version.inspect};

    export function apiParameter(parameter) {
      return parameter;
    }

    export const GENERATED_API_ENDPOINTS = [
#{endpoint_entries}
    ];

    export function buildPath(template, params = {}) {
      return template.replace(/\{(\\w+)\}/g, (_, key) => {
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
  JS
end

def render_js_atp_staff_module(types, roles, shared_field_names, header = JS_RUNTIME_HEADER)
  role_codes = catalog_codes(roles)

  <<~JS
    #{header}
    import { SHARED_FIELD_DEFS, schemaField, validateShape } from './generated_SchemaRuntime.js';
    export const GENERATED_ATP_STAFF_ROLES = Object.freeze(#{js_literal(role_codes)});

    #{render_js_type_exports(types, shared_field_names)}
  JS
end

def render_js_booking_module(types, stages, payment_statuses, adjustment_types, offer_categories, shared_field_names, header = JS_RUNTIME_HEADER)
  stage_codes = catalog_codes(stages)
  payment_status_codes = catalog_codes(payment_statuses)
  adjustment_type_codes = catalog_codes(adjustment_types)
  offer_category_codes = catalog_codes(offer_categories)

  <<~JS
    #{header}
    import { SHARED_FIELD_DEFS, schemaField, validateShape } from './generated_SchemaRuntime.js';
    export const GENERATED_BOOKING_STAGES = Object.freeze(#{js_literal(stage_codes)});
    export const GENERATED_PAYMENT_STATUSES = Object.freeze(#{js_literal(payment_status_codes)});
    export const GENERATED_PRICING_ADJUSTMENT_TYPES = Object.freeze(#{js_literal(adjustment_type_codes)});
    export const GENERATED_OFFER_CATEGORIES = Object.freeze(#{js_literal(offer_category_codes)});

    #{render_js_type_exports(types, shared_field_names)}
  JS
end

def render_js_aux_module(types, shared_field_names, header = JS_RUNTIME_HEADER)
  <<~JS
    #{header}
    import { SHARED_FIELD_DEFS, schemaField, validateShape } from './generated_SchemaRuntime.js';

    #{render_js_type_exports(types, shared_field_names)}
  JS
end

def render_js_api_models_module(api_types, endpoints, shared_field_names, header = JS_RUNTIME_HEADER)
  <<~JS
    #{header}
    import { SHARED_FIELD_DEFS, schemaField, validateShape } from '../Models/generated_SchemaRuntime.js';
    import { GENERATED_API_ENDPOINTS } from './generated_APIRuntime.js';

    #{render_js_type_exports(api_types, shared_field_names)}
  JS
end

def render_js_request_factory_module(endpoints, contract_version, header = JS_RUNTIME_HEADER)
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
    #{header}
    import {
      GENERATED_API_ENDPOINTS as GENERATED_API_ENDPOINT_LIST,
      buildPath,
      buildURL
    } from './generated_APIRuntime.js';

    export const GENERATED_CONTRACT_VERSION = #{contract_version.inspect};
    export const GENERATED_API_ENDPOINTS = Object.freeze(
      Object.fromEntries(GENERATED_API_ENDPOINT_LIST.map((entry) => [entry.key, entry]))
    );

    #{functions}
  JS
end

def render_js_api_client_module(endpoints, header = JS_RUNTIME_HEADER)
  helper_cases = endpoints.map do |endpoint|
    key = endpoint.fetch('key')
    function_name = "#{lower_camel(key)}Request"
    <<~JS
        case #{key.inspect}:
          return RequestFactory.#{function_name}(options);
    JS
  end.join

  <<~JS
    #{header}
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

def render_swift_currency(currency_entries, header = SWIFT_RUNTIME_HEADER)
  currency_cases = currency_entries.map { |entry| "    case #{swift_enum_case_identifier(entry.fetch('code'))} = \"#{entry.fetch('code')}\"" }.join("\n")
  currency_catalog_entries = currency_entries.map do |entry|
    code_case = swift_enum_case_identifier(entry.fetch('code'))
    "        .#{code_case}: GeneratedCurrencyDefinition(code: .#{code_case}, symbol: #{entry.fetch('symbol').inspect}, decimalPlaces: #{entry.fetch('decimalPlaces')}, isoCode: #{entry.fetch('code').inspect})"
  end.join(",\n")

  <<~SWIFT
    import Foundation

    #{header}
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

def render_swift_language(language_codes, header = SWIFT_RUNTIME_HEADER)
  language_cases = language_codes.map { |code| "    case #{swift_enum_case_identifier(code)} = \"#{code}\"" }.join("\n")

  <<~SWIFT
    #{header}

    enum GeneratedLanguageCode: String, CaseIterable, Codable, Hashable {
#{language_cases}
    }
  SWIFT
end

def render_swift_generic_enums(enum_schemas, header = SWIFT_RUNTIME_HEADER)
  blocks = enum_schemas.sort_by { |name, _| name }.map do |name, values|
    enum_cases = values.map { |value| "    case #{swift_enum_case_identifier(value)} = #{value.inspect}" }.join("\n")
    <<~SWIFT
      enum Generated#{name}: String, CaseIterable, Codable, Hashable {
#{enum_cases}
      }
    SWIFT
  end

  <<~SWIFT
    import Foundation

    #{header}
    #{blocks.join("\n")}
  SWIFT
end

def render_swift_form_constraints(traveler_constraints, header = SWIFT_RUNTIME_HEADER)
  min_travelers = Integer(traveler_constraints.fetch('min'))
  max_travelers = Integer(traveler_constraints.fetch('max'))

  <<~SWIFT
    #{header}
    enum GeneratedFormConstraints {
        static let minTravelers: Int = #{min_travelers}
        static let maxTravelers: Int = #{max_travelers}
    }
  SWIFT
end

def render_swift_atp_staff(roles, types = [], header = SWIFT_RUNTIME_HEADER)
  role_codes = catalog_codes(roles)
  role_cases = role_codes.map { |role| "    case #{swift_enum_case_identifier(role)} = \"#{role}\"" }.join("\n")

  <<~SWIFT
    import Foundation

    #{header}
    enum GeneratedATPStaffRole: String, CaseIterable, Codable, Hashable {
#{role_cases}
    }

    #{render_swift_type_collection(types)}
  SWIFT
end

def render_swift_booking(stages, payment_statuses, adjustment_types, offer_categories, types = [], header = SWIFT_RUNTIME_HEADER)
  stage_codes = catalog_codes(stages)
  payment_status_codes = catalog_codes(payment_statuses)
  adjustment_type_codes = catalog_codes(adjustment_types)
  offer_category_codes = catalog_codes(offer_categories)

  stage_cases = stage_codes.map { |entry| "    case #{swift_enum_case_identifier(entry)} = \"#{entry}\"" }.join("\n")
  payment_cases = payment_status_codes.map { |entry| "    case #{swift_enum_case_identifier(entry)} = \"#{entry}\"" }.join("\n")
  adjustment_cases = adjustment_type_codes.map { |entry| "    case #{swift_enum_case_identifier(entry)} = \"#{entry}\"" }.join("\n")
  offer_category_cases = offer_category_codes.map { |entry| "    case #{swift_enum_case_identifier(entry)} = \"#{entry}\"" }.join("\n")

  <<~SWIFT
    import Foundation

    #{header}
    enum GeneratedBookingStage: String, CaseIterable, Codable, Hashable {
#{stage_cases}
    }

    enum GeneratedPaymentStatus: String, CaseIterable, Codable, Hashable {
#{payment_cases}
    }

    enum GeneratedPricingAdjustmentType: String, CaseIterable, Codable, Hashable {
#{adjustment_cases}
    }

    enum GeneratedOfferCategory: String, CaseIterable, Codable, Hashable {
#{offer_category_cases}
    }

    #{render_swift_type_collection(types)}
  SWIFT
end

def render_swift_type(type)
  protocol_list = ['Codable', 'Equatable']
  protocol_list << 'Identifiable' if type.fetch('fields').any? { |field| field.fetch('name') == 'id' && !field['isArray'] }
  protocols = protocol_list.join(', ')
  type_fields = type.fetch('fields')

  fields = type_fields.map do |field|
    field_name = field.fetch('name')
    swift_type = swift_type_for_field(field)
    "    let #{field_name}: #{swift_type}"
  end.join("\n")

  coding_keys = type_fields.map do |field|
    field_name = field.fetch('name')
    wire_name = field['wireName'] || snake_case(field_name)
    "        case #{field_name} = \"#{wire_name}\""
  end.join("\n")

  body = if type_fields.empty?
           ""
         else
           <<~SWIFT_BODY
#{fields}

        private enum CodingKeys: String, CodingKey {
#{coding_keys}
        }
           SWIFT_BODY
         end

  <<~SWIFT
    struct Generated#{type.fetch('name')}: #{protocols} {
#{body}
    }
  SWIFT
end

def render_swift_type_collection(types)
  types.map { |type| render_swift_type(type) }.join("\n")
end

def render_swift_aux(types, header = SWIFT_RUNTIME_HEADER)
  <<~SWIFT
    import Foundation

    #{header}
    #{render_swift_type_collection(types)}
  SWIFT
end

def render_swift_api_models(api_types, header = SWIFT_RUNTIME_HEADER)
  <<~SWIFT
    import Foundation

    #{header}
    #{render_swift_type_collection(api_types)}
  SWIFT
end

def render_swift_request_factory(endpoints, contract_version, header = SWIFT_RUNTIME_HEADER)
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

    #{header}
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

def render_swift_api_client(endpoints, header = SWIFT_RUNTIME_HEADER)
  cases = endpoints.map do |endpoint|
    "        case .#{swift_case(endpoint.fetch('key'))}: return #{endpoint.fetch('method').inspect}"
  end.join("\n")

  enum_cases = endpoints.map do |endpoint|
    "    case #{swift_case(endpoint.fetch('key'))}"
  end.join("\n")

  <<~SWIFT
    import Foundation

    #{header}
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

def ref_name_from_schema_ref(ref)
  String(ref).split('/').last
end

def canonical_runtime_type_name(name)
  case name
  when 'ATPCurrencyCode' then 'CurrencyCode'
  else name
  end
end

def openapi_enum_schema_name(type_name)
  type_name == 'CurrencyCode' ? 'ATPCurrencyCode' : type_name
end

def enum_options_from_catalog(entries)
  Array(entries).map do |entry|
    if entry.is_a?(Hash)
      code = entry.fetch('code')
      { 'value' => code, 'label' => entry['label'] || code }
    else
      { 'value' => entry, 'label' => entry }
    end
  end
end

def openapi_enum_schema_names(schemas)
  schemas.each_with_object(Set.new) do |(name, schema), acc|
    acc << name if schema.is_a?(Hash) && schema['enum'].is_a?(Array)
  end
end

def field_type_from_openapi_schema(field_schema, enum_names, schemas, transport_kind)
  schema = field_schema.dup
  is_array = schema['type'] == 'array'
  schema = schema['items'] if is_array

  if schema['$ref']
    ref_name = ref_name_from_schema_ref(schema['$ref'])
    kind = enum_names.include?(ref_name) ? 'enum' : transport_kind
    type_name = canonical_runtime_type_name(ref_name)
    field = {
      'kind' => kind,
      'typeName' => type_name,
      'isArray' => is_array
    }
    if enum_names.include?(ref_name)
      enum_schema = schemas[ref_name] || {}
      field['enumValues'] = Array(enum_schema['enum'])
      field['options'] = Array(enum_schema['x-enum-options'])
    end
    field['format'] = schema['format'] if schema['format']
    return field
  end

  type_name = case schema['type']
              when 'integer' then 'int'
              when 'number' then 'float'
              when 'boolean' then 'bool'
              else 'string'
              end
  field = {
    'kind' => 'scalar',
    'typeName' => type_name,
    'isArray' => is_array
  }
  field['format'] = schema['format'] if schema['format']
  field
end

def openapi_object_schema_to_type(name, schema, enum_names, schemas:, domain:, mod:, source_type:, transport_kind:)
  properties = schema.fetch('properties', {})
  required = Array(schema['required'])
  fields = properties.map do |prop_name, prop_schema|
    field = field_type_from_openapi_schema(prop_schema, enum_names, schemas, transport_kind)
    field.merge(
      'name' => prop_name,
      'required' => required.include?(prop_name),
      'wireName' => prop_name
    )
  end

  {
    'name' => name,
    'domain' => domain,
    'module' => mod,
    'sourceType' => source_type,
    'fields' => fields
  }
end

def openapi_types_for_schema_names(schema_names, schemas, enum_names, domain:, mod:, transport_kind:)
  schema_names.map do |schema_name|
    schema = schemas[schema_name]
    next unless schema.is_a?(Hash)
    next unless schema['type'] == 'object' || schema.key?('properties')

    openapi_object_schema_to_type(
      schema_name,
      schema,
      enum_names,
      schemas: schemas,
      domain: domain,
      mod: mod,
      source_type: "openapi.components.schemas.#{schema_name}",
      transport_kind: transport_kind
    )
  end.compact
end

def openapi_endpoints(doc)
  paths = doc.fetch('paths')
  endpoints = []

  paths.each do |path, methods|
    methods.each do |method, operation|
      next unless operation.is_a?(Hash)
      key = operation['operationId'] || "#{method}_#{path}".gsub(%r{[^a-zA-Z0-9]+}, '_').gsub(/^_+|_+$/, '')
      parameters = Array(operation['parameters']).map do |parameter|
        schema = parameter['schema'] || {}
        {
          'name' => parameter.fetch('name'),
          'location' => parameter.fetch('in'),
          'required' => parameter.fetch('required', false),
          'typeName' => case schema['type']
                        when 'integer' then 'int'
                        when 'boolean' then 'bool'
                        else 'Identifier'
                        end
        }
      end

      request_body_schema = operation.dig('requestBody', 'content', 'application/json', 'schema')
      request_type = request_body_schema && request_body_schema['$ref'] ? ref_name_from_schema_ref(request_body_schema['$ref']) : nil

      response_schema = nil
      %w[200 201].each do |status_code|
        candidate = operation.dig('responses', status_code, 'content', 'application/json', 'schema')
        if candidate
          response_schema = candidate
          break
        end
      end
      response_type = response_schema && response_schema['$ref'] ? ref_name_from_schema_ref(response_schema['$ref']) : nil

      endpoints << {
        'key' => key,
        'path' => path,
        'method' => method.upcase,
        'authenticated' => Array(operation['security']).any?,
        'requestType' => request_type,
        'responseType' => response_type,
        'parameters' => parameters
      }
    end
  end

  endpoints
end

def openapi_transport_type_names(doc)
  endpoint_types = openapi_endpoints(doc).flat_map { |ep| [ep['requestType'], ep['responseType']] }.compact.uniq
  queue = endpoint_types.dup
  seen = Set.new
  schemas = doc.dig('components', 'schemas') || {}

  until queue.empty?
    name = queue.shift
    next if seen.include?(name)
    seen << name
    schema = schemas[name]
    next unless schema.is_a?(Hash)

    properties = schema['properties'] || {}
    properties.each_value do |prop_schema|
      nested = prop_schema['type'] == 'array' ? prop_schema['items'] : prop_schema
      next unless nested.is_a?(Hash) && nested['$ref']
      ref_name = ref_name_from_schema_ref(nested['$ref'])
      queue << ref_name
    end
  end

  seen
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
           when 'string', 'Identifier'
             { type: 'string' }
           when 'Timestamp'
             { type: 'string', format: 'date-time' }
           when 'DateOnly'
             { type: 'string', format: 'date' }
           when 'Email'
             { type: 'string', format: 'email' }
           when 'Url'
             { type: 'string', format: 'uri' }
           when 'int'
             { type: 'integer' }
           when 'float'
             { type: 'number' }
           when 'bool'
             { type: 'boolean' }
           else
             { type: 'string' }
           end
         when 'enum'
           openapi_schema_ref(openapi_enum_schema_name(field.fetch('typeName')))
         when 'entity', 'valueObject', 'transport'
           openapi_schema_ref(field.fetch('typeName'))
         else
           { type: 'string' }
         end

  prop = { type: 'array', items: prop } if field['isArray']
  prop[:nullable] = true if field['required'] == false && !field['isArray']
  prop
end

def build_openapi_schemas(ir, traveler_constraints)
  types = ir.fetch('types')
  type_index = types.each_with_object({}) { |t, acc| acc[t.fetch('name')] = t }

  enum_type_index = ir.fetch('enumTypes')
  enum_schema_names = enum_type_index.keys.map { |type_name| openapi_enum_schema_name(type_name) }

  schemas = {}
  enum_type_index.each do |type_name, definition|
    catalog_name = definition.fetch('catalog')
    catalog_entries = Array(ir.dig('catalogs', catalog_name))
    schema_name = openapi_enum_schema_name(type_name)
    schemas[schema_name] = {
      type: 'string',
      enum: catalog_codes(catalog_entries),
      'x-enum-catalog' => catalog_entries,
      'x-enum-options' => enum_options_from_catalog(catalog_entries)
    }
    if type_name == 'CurrencyCode'
      schemas[schema_name]['x-currency-catalog'] = catalog_entries
    end
  end
  schemas['TravelerConstraints'] = {
    type: 'object',
    required: %w[min max],
    properties: {
      'min' => { type: 'integer', const: Integer(traveler_constraints.fetch('min')) },
      'max' => { type: 'integer', const: Integer(traveler_constraints.fetch('max')) }
    }
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
      operationId: ep.fetch('key'),
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

def build_openapi_doc(ir, traveler_constraints)
  endpoints = ir.dig('api', 'endpoints') || []
  types = ir.fetch('types')

  schemas = build_openapi_schemas(ir, traveler_constraints)
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
traveler_constraints = load_traveler_constraints_json
meta = ir.fetch('meta')
types = ir.fetch('types')
endpoints = ir.dig('api', 'endpoints') || []

currency_entries = ir.fetch('catalogs').fetch('currencies')
language_codes = catalog_codes(ir.fetch('catalogs').fetch('languages'))
roles = ir.fetch('catalogs').fetch('roles')
stages = ir.fetch('catalogs').fetch('stages')
payment_statuses = ir.fetch('catalogs').fetch('paymentStatuses')
adjustment_types = ir.fetch('catalogs').fetch('pricingAdjustmentTypes')
offer_categories = ir.fetch('catalogs').fetch('offerCategories')
contract_version = meta.fetch('modelVersion')

entity_types = types.select { |type| type.fetch('module') == 'entities' }
api_types = types.select { |type| type.fetch('module') == 'api' }

atp_staff_types = entity_types.select { |type| type.fetch('domain') == 'atp_staff' }
booking_types = entity_types.select { |type| type.fetch('domain') == 'booking' }
aux_types = entity_types.reject { |type| %w[atp_staff booking].include?(type.fetch('domain')) }

write_file(
  File.join(CONTRACT_GENERATED_DIR, 'mobile-api.meta.json'),
  JSON.pretty_generate(
    {
      modelVersion: meta.fetch('modelVersion'),
      generatorVersion: meta.fetch('generatorVersion'),
      modulePath: meta.fetch('modulePath'),
      defaultCurrency: meta.fetch('defaultCurrency'),
      generatedAt: Time.now.utc.iso8601,
      languages: language_codes,
      currencies: currency_entries,
      roles: roles,
      stages: stages,
      paymentStatuses: payment_statuses,
      pricingAdjustmentTypes: adjustment_types,
      offerCategories: offer_categories,
      travelerConstraints: traveler_constraints,
      endpoints: endpoints
    }
  ) + "\n"
)

openapi_doc = deep_stringify_keys(build_openapi_doc(ir, traveler_constraints))
write_openapi_yaml(File.join(CONTRACT_GENERATED_DIR, 'openapi.yaml'), openapi_doc)

write_file(
  File.join(CONTRACT_GENERATED_DIR, 'README.md'),
  <<~README
    # Generated API contract and docs

    This directory is generated from the CUE model (\`model/\`) by \`tools/generator/generate_mobile_contract_artifacts.rb\`. Do not edit these files by hand.

    - **openapi.yaml** – OpenAPI 3.1 specification (source of truth for mobile and frontend clients).
    - **mobile-api.meta.json** – Generator metadata (endpoints, catalogs, version).

    Use `openapi.yaml` directly as the generated API contract.
  README
)

FileUtils.rm_f(File.join(CONTRACT_GENERATED_DIR, 'mobile-api.openapi.yaml'))
FileUtils.rm_f(File.join(CONTRACT_GENERATED_DIR, 'redoc.html'))

openapi_schemas = openapi_doc.dig('components', 'schemas') || {}
openapi_enum_names = openapi_enum_schema_names(openapi_schemas)
openapi_endpoint_list = openapi_endpoints(openapi_doc)
openapi_transport_names = openapi_transport_type_names(openapi_doc)
frontend_shared_parameter_definitions, frontend_shared_parameter_names = build_js_shared_parameter_definitions(openapi_endpoint_list)

frontend_currency_catalog = openapi_schemas.fetch('ATPCurrencyCode').fetch('x-currency-catalog')
frontend_language_codes = openapi_schemas.fetch('LanguageCode').fetch('enum')
frontend_generic_swift_enums = openapi_schemas.each_with_object({}) do |(name, schema), acc|
  next unless schema.is_a?(Hash) && schema['enum'].is_a?(Array)
  next if %w[LanguageCode ATPCurrencyCode ATPStaffRole BookingStage PaymentStatus PricingAdjustmentType OfferCategory].include?(name)
  acc[name] = schema['enum']
end
frontend_roles = openapi_schemas.fetch('ATPStaffRole').fetch('enum')
frontend_stages = openapi_schemas.fetch('BookingStage').fetch('enum')
frontend_payment_statuses = openapi_schemas.fetch('PaymentStatus').fetch('enum')
frontend_adjustment_types = openapi_schemas.fetch('PricingAdjustmentType').fetch('enum')
frontend_offer_categories = openapi_schemas.fetch('OfferCategory').fetch('enum')
frontend_traveler_constraints = {
  'min' => openapi_schemas.fetch('TravelerConstraints').dig('properties', 'min', 'const'),
  'max' => openapi_schemas.fetch('TravelerConstraints').dig('properties', 'max', 'const')
}

frontend_atp_staff_types = openapi_types_for_schema_names(
  ['ATPStaff'],
  openapi_schemas,
  openapi_enum_names,
  domain: 'atp_staff',
  mod: 'entities',
  transport_kind: 'entity'
)

frontend_booking_type_names = %w[
  SourceAttribution
  BookingActivity
  InvoiceComponent
  BookingInvoice
  BookingPricingAdjustment
  BookingPayment
  BookingPricingSummary
  BookingPricing
  BookingOfferCategoryRule
  BookingOfferComponent
  BookingOfferTotals
  BookingOffer
  Booking
]

frontend_customer_type_names = %w[
  Customer
  CustomerConsent
  CustomerDocument
]

frontend_travel_group_type_names = %w[
  TravelGroup
  TravelGroupMember
]

frontend_aux_type_names = %w[
  Tour
  TourPriceFrom
]

frontend_api_type_names = openapi_transport_names.to_a.reject do |name|
  frontend_booking_type_names.include?(name) ||
    frontend_customer_type_names.include?(name) ||
    frontend_travel_group_type_names.include?(name) ||
    frontend_aux_type_names.include?(name) ||
    name == 'ATPStaff'
end

frontend_booking_types = openapi_types_for_schema_names(
  frontend_booking_type_names,
  openapi_schemas,
  openapi_enum_names,
  domain: 'booking',
  mod: 'entities',
  transport_kind: 'entity'
)

frontend_customer_types = openapi_types_for_schema_names(
  frontend_customer_type_names,
  openapi_schemas,
  openapi_enum_names,
  domain: 'customer',
  mod: 'entities',
  transport_kind: 'entity'
)

frontend_travel_group_types = openapi_types_for_schema_names(
  frontend_travel_group_type_names,
  openapi_schemas,
  openapi_enum_names,
  domain: 'travel_group',
  mod: 'entities',
  transport_kind: 'entity'
)

frontend_aux_types = openapi_types_for_schema_names(
  frontend_aux_type_names,
  openapi_schemas,
  openapi_enum_names,
  domain: 'aux',
  mod: 'entities',
  transport_kind: 'entity'
)

frontend_api_types = openapi_types_for_schema_names(
  frontend_api_type_names,
  openapi_schemas,
  openapi_enum_names,
  domain: 'api',
  mod: 'api',
  transport_kind: 'transport'
)

frontend_shared_field_definitions, frontend_shared_field_names = build_js_shared_field_definitions(
  frontend_atp_staff_types +
    frontend_booking_types +
    frontend_customer_types +
    frontend_travel_group_types +
    frontend_aux_types +
    frontend_api_types
)

shared_model_outputs = {
  'generated_SchemaRuntime.js' => render_js_schema_runtime_module(frontend_shared_field_definitions, JS_OPENAPI_HEADER),
  'generated_Language.js' => render_js_language_module(frontend_language_codes, JS_OPENAPI_HEADER),
  'generated_Currency.js' => render_js_currency_module(frontend_currency_catalog, JS_OPENAPI_HEADER),
  'generated_FormConstraints.js' => render_js_form_constraints_module(frontend_traveler_constraints, JS_OPENAPI_HEADER),
  'generated_ATPStaff.js' => render_js_atp_staff_module(frontend_atp_staff_types, frontend_roles, frontend_shared_field_names, JS_OPENAPI_HEADER),
  'generated_Booking.js' => render_js_booking_module(
    frontend_booking_types,
    frontend_stages,
    frontend_payment_statuses,
    frontend_adjustment_types,
    frontend_offer_categories,
    frontend_shared_field_names,
    JS_OPENAPI_HEADER
  ),
  'generated_Customer.js' => render_js_aux_module(
    frontend_customer_types,
    frontend_shared_field_names,
    JS_OPENAPI_HEADER
  ),
  'generated_TravelGroup.js' => render_js_aux_module(
    frontend_travel_group_types,
    frontend_shared_field_names,
    JS_OPENAPI_HEADER
  ),
  'generated_Aux.js' => render_js_aux_module(
    frontend_aux_types,
    frontend_shared_field_names,
    JS_OPENAPI_HEADER
  )
}

shared_api_outputs = {
  'generated_APIRuntime.js' => render_js_api_runtime_module(
    openapi_endpoint_list,
    openapi_doc.dig('info', 'version'),
    frontend_shared_parameter_definitions,
    frontend_shared_parameter_names,
    JS_OPENAPI_HEADER
  ),
  'generated_APIModels.js' => render_js_api_models_module(
    frontend_api_types,
    openapi_endpoint_list,
    frontend_shared_field_names,
    JS_OPENAPI_HEADER
  ),
  'generated_APIRequestFactory.js' => render_js_request_factory_module(openapi_endpoint_list, openapi_doc.dig('info', 'version'), JS_OPENAPI_HEADER),
  'generated_APIClient.js' => render_js_api_client_module(openapi_endpoint_list, JS_OPENAPI_HEADER)
}

frontend_model_outputs = shared_model_outputs.keys.each_with_object({}) do |filename, acc|
  target = File.join(SHARED_GENERATED_MODELS_DIR, filename)
  acc[filename] = render_js_reexport_module(relative_module_path(FRONTEND_GENERATED_MODELS_DIR, target))
end

backend_model_outputs = shared_model_outputs.keys.each_with_object({}) do |filename, acc|
  target = File.join(SHARED_GENERATED_MODELS_DIR, filename)
  acc[filename] = render_js_reexport_module(relative_module_path(BACKEND_GENERATED_MODELS_DIR, target))
end

frontend_api_outputs = shared_api_outputs.keys.each_with_object({}) do |filename, acc|
  target = File.join(SHARED_GENERATED_API_DIR, filename)
  acc[filename] = render_js_reexport_module(relative_module_path(FRONTEND_GENERATED_API_DIR, target))
end

backend_api_outputs = shared_api_outputs.keys.each_with_object({}) do |filename, acc|
  target = File.join(SHARED_GENERATED_API_DIR, filename)
  acc[filename] = render_js_reexport_module(relative_module_path(BACKEND_GENERATED_API_DIR, target))
end

ios_model_outputs = {
  'generated_Enums.swift' => render_swift_generic_enums(frontend_generic_swift_enums, SWIFT_OPENAPI_HEADER),
  'generated_Language.swift' => render_swift_language(frontend_language_codes, SWIFT_OPENAPI_HEADER),
  'generated_Currency.swift' => render_swift_currency(frontend_currency_catalog, SWIFT_OPENAPI_HEADER),
  'generated_FormConstraints.swift' => render_swift_form_constraints(frontend_traveler_constraints, SWIFT_OPENAPI_HEADER),
  'generated_ATPStaff.swift' => render_swift_atp_staff(frontend_roles, frontend_atp_staff_types, SWIFT_OPENAPI_HEADER),
  'generated_Booking.swift' => render_swift_booking(
    frontend_stages,
    frontend_payment_statuses,
    frontend_adjustment_types,
    frontend_offer_categories,
    frontend_booking_types,
    SWIFT_OPENAPI_HEADER
  ),
  'generated_Customer.swift' => render_swift_aux(
    frontend_customer_types,
    SWIFT_OPENAPI_HEADER
  ),
  'generated_TravelGroup.swift' => render_swift_aux(
    frontend_travel_group_types,
    SWIFT_OPENAPI_HEADER
  ),
  'generated_Aux.swift' => render_swift_aux(
    frontend_aux_types,
    SWIFT_OPENAPI_HEADER
  )
}

ios_api_outputs = {
  'generated_APIModels.swift' => render_swift_api_models(
    frontend_api_types,
    SWIFT_OPENAPI_HEADER
  ),
  'generated_APIRequestFactory.swift' => render_swift_request_factory(openapi_endpoint_list, openapi_doc.dig('info', 'version'), SWIFT_OPENAPI_HEADER),
  'generated_APIClient.swift' => render_swift_api_client(openapi_endpoint_list, SWIFT_OPENAPI_HEADER)
}

shared_model_outputs.each do |filename, content|
  write_file(File.join(SHARED_GENERATED_MODELS_DIR, filename), content)
end
shared_api_outputs.each do |filename, content|
  write_file(File.join(SHARED_GENERATED_API_DIR, filename), content)
end
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
