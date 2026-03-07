    import Foundation

    // Generated from api/generated/openapi.yaml.
// Do not edit by hand.

    enum GeneratedATPStaffRole: String, CaseIterable, Codable, Hashable {
    case atpAdmin = "atp_admin"
    case atpManager = "atp_manager"
    case atpAccountant = "atp_accountant"
    case atpStaff = "atp_staff"
    }

        struct GeneratedATPStaff: Codable, Equatable, Identifiable {
    let id: String
    let preferredUsername: String
    let displayName: String?
    let email: String?
    let roles: [GeneratedATPStaffRole]?
    let atpStaffId: String?

        private enum CodingKeys: String, CodingKey {
        case id = "id"
        case preferredUsername = "preferredUsername"
        case displayName = "displayName"
        case email = "email"
        case roles = "roles"
        case atpStaffId = "atpStaffId"
        }

    }

