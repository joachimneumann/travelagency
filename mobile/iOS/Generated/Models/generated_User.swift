    import Foundation

    // Generated from the normalized model IR exported from model/ir.
// Do not edit by hand.

    enum GeneratedATPUserRole: String, CaseIterable, Codable, Hashable {
    case atpAdmin = "atp_admin"
    case atpManager = "atp_manager"
    case atpAccountant = "atp_accountant"
    case atpStaff = "atp_staff"
    }

    struct GeneratedATPUser: Codable, Equatable {
        let id: String
        let preferredUsername: String
        let displayName: String?
        let email: String?
        let roles: [GeneratedATPUserRole]
        let staffId: String?
    }

typealias ATPUserRole = GeneratedATPUserRole
typealias ATPUser = GeneratedATPUser
