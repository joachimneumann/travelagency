import Foundation

// Generated from the normalized model IR exported from model/ir.
// Do not edit by hand.

    struct GeneratedCustomer: Codable, Equatable, Identifiable {
    let id: String
    let display_name: String
    let first_name: String?
    let last_name: String?
    let date_of_birth: String?
    let nationality: String?
    let organization_name: String?
    let organization_address: String?
    let organization_phone_number: String?
    let organization_webpage: String?
    let organization_email: String?
    let tax_id: String?
    let phone_number: String?
    let email: String?
    let address_line_1: String?
    let address_line_2: String?
    let address_city: String?
    let address_state_region: String?
    let address_postal_code: String?
    let address_country_code: String?
    let preferred_language: String?
    let preferred_currency: String?
    let timezone: String?
    let tags: [String]?
    let notes: String?
    let can_receive_marketing: Bool
    let created_at: String
    let updated_at: String
    let archived_at: String?

        private enum CodingKeys: String, CodingKey {
        case id = "id"
        case display_name = "display_name"
        case first_name = "first_name"
        case last_name = "last_name"
        case date_of_birth = "date_of_birth"
        case nationality = "nationality"
        case organization_name = "organization_name"
        case organization_address = "organization_address"
        case organization_phone_number = "organization_phone_number"
        case organization_webpage = "organization_webpage"
        case organization_email = "organization_email"
        case tax_id = "tax_id"
        case phone_number = "phone_number"
        case email = "email"
        case address_line_1 = "address_line_1"
        case address_line_2 = "address_line_2"
        case address_city = "address_city"
        case address_state_region = "address_state_region"
        case address_postal_code = "address_postal_code"
        case address_country_code = "address_country_code"
        case preferred_language = "preferred_language"
        case preferred_currency = "preferred_currency"
        case timezone = "timezone"
        case tags = "tags"
        case notes = "notes"
        case can_receive_marketing = "can_receive_marketing"
        case created_at = "created_at"
        case updated_at = "updated_at"
        case archived_at = "archived_at"
        }
    }

    struct GeneratedCustomerConsent: Codable, Equatable, Identifiable {
    let id: String
    let customer_id: String
    let consent_type: String
    let status: String
    let captured_via: String?
    let captured_at: String
    let evidence_ref: String?
    let updated_at: String

        private enum CodingKeys: String, CodingKey {
        case id = "id"
        case customer_id = "customer_id"
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
    let customer_id: String
    let document_type: String
    let document_number: String?
    let document_picture_ref: String?
    let issuing_country: String?
    let expires_on: String?
    let created_at: String
    let updated_at: String

        private enum CodingKeys: String, CodingKey {
        case id = "id"
        case customer_id = "customer_id"
        case document_type = "document_type"
        case document_number = "document_number"
        case document_picture_ref = "document_picture_ref"
        case issuing_country = "issuing_country"
        case expires_on = "expires_on"
        case created_at = "created_at"
        case updated_at = "updated_at"
        }
    }

    struct GeneratedTravelGroup: Codable, Equatable, Identifiable {
    let id: String
    let booking_id: String
    let name: String?
    let group_type: String
    let notes: String?
    let created_at: String
    let updated_at: String

        private enum CodingKeys: String, CodingKey {
        case id = "id"
        case booking_id = "booking_id"
        case name = "name"
        case group_type = "group_type"
        case notes = "notes"
        case created_at = "created_at"
        case updated_at = "updated_at"
        }
    }

    struct GeneratedTravelGroupMember: Codable, Equatable, Identifiable {
    let id: String
    let travel_group_id: String
    let customer_id: String
    let is_traveling: Bool?
    let member_roles: [String]
    let notes: String?
    let created_at: String
    let updated_at: String

        private enum CodingKeys: String, CodingKey {
        case id = "id"
        case travel_group_id = "travel_group_id"
        case customer_id = "customer_id"
        case is_traveling = "is_traveling"
        case member_roles = "member_roles"
        case notes = "notes"
        case created_at = "created_at"
        case updated_at = "updated_at"
        }
    }

    struct GeneratedTour: Codable, Equatable, Identifiable {
    let id: String
    let title: String?
    let destinationCountries: [String]
    let styles: [String]
    let durationDays: Int?
    let priceFrom: GeneratedTourPriceFrom?

        private enum CodingKeys: String, CodingKey {
        case id = "id"
        case title = "title"
        case destinationCountries = "destination_countries"
        case styles = "styles"
        case durationDays = "duration_days"
        case priceFrom = "price_from"
        }
    }

    struct GeneratedTourPriceFrom: Codable, Equatable {
    let currency: GeneratedCurrencyCode
    let minor: Int

        private enum CodingKeys: String, CodingKey {
        case currency = "currency"
        case minor = "minor"
        }
    }

