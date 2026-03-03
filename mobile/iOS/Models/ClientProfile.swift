import Foundation

struct ClientProfile: Codable, Equatable {
    let subject: String
    let preferredUsername: String?
    let email: String?
    let roles: Set<ATPStaffRole>
}
