import Foundation

struct UserProfile: Codable, Equatable {
    let subject: String
    let preferredUsername: String?
    let email: String?
    let roles: Set<ATPUserRole>
}
