import Foundation

enum ATPUserRole: String, CaseIterable, Codable, Hashable {
    case admin = "atp_admin"
    case manager = "atp_manager"
    case accountant = "atp_accountant"
    case staff = "atp_staff"
}
