import Foundation

struct AuthSession: Codable, Equatable {
    let accessToken: String
    let idToken: String?
    let refreshToken: String?
    let expiresAt: Date?
    let user: UserProfile

    var isExpired: Bool {
        guard let expiresAt else { return false }
        return expiresAt <= Date()
    }
}
