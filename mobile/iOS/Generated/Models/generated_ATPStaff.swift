    import Foundation

    // Generated from the normalized model IR exported from model/ir.
// Do not edit by hand.

    enum GeneratedATPStaffRole: String, CaseIterable, Codable, Hashable {
    case atpAdmin = "atp_admin"
    case atpManager = "atp_manager"
    case atpAccountant = "atp_accountant"
    case atpStaff = "atp_staff"
    }

    struct GeneratedATPStaff: Codable, Equatable {
        let id: String
        let preferredUsername: String
        let displayName: String?
        let email: String?
        let roles: [GeneratedATPStaffRole]
        let staffId: String?
    }
