import Foundation

// Generated from api/generated/openapi.yaml.
// Do not edit by hand.

    struct GeneratedCustomer: Codable, Equatable {
    let client_id: String
    let customer_hash: String?
    let name: String
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
    let created_at: String
    let updated_at: String
    let archived_at: String?

        private enum CodingKeys: String, CodingKey {
        case client_id = "client_id"
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
        case created_at = "created_at"
        case updated_at = "updated_at"
        case archived_at = "archived_at"
        }

    }

    struct GeneratedCustomerConsent: Codable, Equatable, Identifiable {
    let id: String
    let customer_client_id: String
    let consent_type: GeneratedCustomerConsentType
    let status: GeneratedCustomerConsentStatus
    let captured_via: String?
    let captured_at: String
    let evidence_ref: String?
    let updated_at: String

        private enum CodingKeys: String, CodingKey {
        case id = "id"
        case customer_client_id = "customer_client_id"
        case consent_type = "consent_type"
        case status = "status"
        case captured_via = "captured_via"
        case captured_at = "captured_at"
        case evidence_ref = "evidence_ref"
        case updated_at = "updated_at"
        }

    }

    struct GeneratedCustomerDocument: Codable, Equatable, Identifiable {
    let id: String
    let customer_client_id: String
    let document_type: GeneratedCustomerDocumentType
    let document_number: String?
    let document_picture_ref: String?
    let issuing_country: GeneratedCountryCode?
    let expires_on: String?
    let created_at: String
    let updated_at: String

        private enum CodingKeys: String, CodingKey {
        case id = "id"
        case customer_client_id = "customer_client_id"
        case document_type = "document_type"
        case document_number = "document_number"
        case document_picture_ref = "document_picture_ref"
        case issuing_country = "issuing_country"
        case expires_on = "expires_on"
        case created_at = "created_at"
        case updated_at = "updated_at"
        }

    }

