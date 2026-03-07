import Foundation

// Generated from api/generated/openapi.yaml.
// Do not edit by hand.

    struct GeneratedTravelGroup: Codable, Equatable, Identifiable {
    let id: String
    let client_id: String
    let travel_group_hash: String?
    let group_name: String
    let preferred_language: GeneratedLanguageCode?
    let preferred_currency: GeneratedCurrencyCode?
    let timezone: GeneratedTimezoneCode?
    let notes: String?
    let created_at: String
    let updated_at: String
    let archived_at: String?

        private enum CodingKeys: String, CodingKey {
        case id = "id"
        case client_id = "client_id"
        case travel_group_hash = "travel_group_hash"
        case group_name = "group_name"
        case preferred_language = "preferred_language"
        case preferred_currency = "preferred_currency"
        case timezone = "timezone"
        case notes = "notes"
        case created_at = "created_at"
        case updated_at = "updated_at"
        case archived_at = "archived_at"
        }

    }

    struct GeneratedTravelGroupMember: Codable, Equatable, Identifiable {
    let id: String
    let travel_group_id: String
    let customer_client_id: String
    let is_traveling: Bool?
    let member_roles: [GeneratedTravelGroupMemberRole]?
    let notes: String?
    let created_at: String
    let updated_at: String

        private enum CodingKeys: String, CodingKey {
        case id = "id"
        case travel_group_id = "travel_group_id"
        case customer_client_id = "customer_client_id"
        case is_traveling = "is_traveling"
        case member_roles = "member_roles"
        case notes = "notes"
        case created_at = "created_at"
        case updated_at = "updated_at"
        }

    }

